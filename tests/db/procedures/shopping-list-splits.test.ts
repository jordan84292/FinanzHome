import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import {
  acceptInvitation,
  createHousehold,
  createInvitation,
  getHouseholdsForUser,
} from '@/lib/db/procedures/household';
import { createProduct, listCategories, listUnits } from '@/lib/db/procedures/products';
import {
  confirmShoppingList,
  generateOrGetShoppingList,
  getShoppingListItems,
} from '@/lib/db/procedures/shopping-list';
import { initSplit } from '@/lib/db/procedures/shopping-list-splits';
import { uniqueSuffix } from '../../helpers/db';

const CRC_ID = 1;

async function createMember(suffix: string): Promise<{
  householdId: number;
  memberId: number;
  ownerUserId: number;
}> {
  const user = await registerUser({
    email: `split_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa Split ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id, ownerUserId: user.id };
}

async function addSecondMember(params: {
  householdId: number;
  invitedByMemberId: number;
  suffix: string;
}): Promise<{ memberId: number }> {
  const secondUser = await registerUser({
    email: `split_second_${params.suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Second',
  });
  const invitation = await createInvitation({
    householdId: params.householdId,
    email: secondUser.email,
    token: `split-token-${params.suffix}`,
    invitedByMemberId: params.invitedByMemberId,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  const member = await acceptInvitation({
    token: invitation.token,
    userId: secondUser.id,
    displayName: 'Second',
  });
  return { memberId: member.id };
}

async function confirmAListWithDeficit(params: {
  householdId: number;
  memberId: number;
  suffix: string;
  optimalQuantity: number;
  currentQuantity: number;
  defaultPrice: number;
}): Promise<{ shoppingListId: number }> {
  const [category] = await listCategories();
  const [unit] = await listUnits();
  await createProduct({
    householdId: params.householdId,
    name: `Producto ${params.suffix}`,
    categoryId: category.id,
    unitId: unit.id,
    optimalQuantity: params.optimalQuantity,
    currentQuantity: params.currentQuantity,
    defaultPrice: params.defaultPrice,
    defaultPriceCurrencyId: CRC_ID,
    createdByMemberId: params.memberId,
  });
  const list = await generateOrGetShoppingList(params.householdId, params.memberId);
  const items = await getShoppingListItems(list.id, params.householdId, CRC_ID);
  await confirmShoppingList({
    shoppingListId: list.id,
    householdId: params.householdId,
    items: items.map((item) => ({
      itemId: item.id,
      quantity: item.quantity_needed,
      unitPrice: item.unit_price,
      unitPriceCurrencyId: item.unit_price_currency_id,
    })),
    displayCurrencyId: CRC_ID,
  });
  return { shoppingListId: list.id };
}

describe('sp_shopping_list_split_init', () => {
  it('splits a two-member household 50/50 with amounts summing to the total', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 10,
      currentQuantity: 0,
      defaultPrice: 1000,
    });

    const splits = await initSplit(shoppingListId, householdId);

    expect(splits).toHaveLength(2);
    expect(splits[0].percentage).toBe(50);
    expect(splits[1].percentage).toBe(50);
    const totalOwed = splits.reduce((sum, s) => sum + s.amount_owed, 0);
    expect(totalOwed).toBe(10000);
  });

  it('splits a three-member household with percentages summing to exactly 100', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    await addSecondMember({ householdId, invitedByMemberId: memberId, suffix: `${suffix}_b` });
    await addSecondMember({ householdId, invitedByMemberId: memberId, suffix: `${suffix}_c` });
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 3,
      currentQuantity: 0,
      defaultPrice: 900,
    });

    const splits = await initSplit(shoppingListId, householdId);

    expect(splits).toHaveLength(3);
    const percentageSum = splits.reduce((sum, s) => sum + s.percentage, 0);
    expect(percentageSum).toBe(100);
    expect(splits[0].percentage).toBe(33.34);
    expect(splits[1].percentage).toBe(33.33);
    expect(splits[2].percentage).toBe(33.33);
  });

  it('is idempotent: calling it twice does not duplicate rows', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 5,
      currentQuantity: 0,
      defaultPrice: 500,
    });

    await initSplit(shoppingListId, householdId);
    const second = await initSplit(shoppingListId, householdId);

    expect(second).toHaveLength(1);
    expect(second[0].percentage).toBe(100);
  });

  it('rejects a shopping list belonging to a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createMember(suffixA);
    const { householdId: householdIdB } = await createMember(suffixB);
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId: householdIdA,
      memberId: memberIdA,
      suffix: suffixA,
      optimalQuantity: 2,
      currentQuantity: 0,
      defaultPrice: 400,
    });

    await expect(initSplit(shoppingListId, householdIdB)).rejects.toThrow(/not found or not confirmed/i);
  });

  it('rejects a shopping list that is still open (not confirmed)', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    await createProduct({
      householdId,
      name: `Abierto ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 5,
      currentQuantity: 0,
      defaultPrice: 500,
      defaultPriceCurrencyId: CRC_ID,
      createdByMemberId: memberId,
    });
    const list = await generateOrGetShoppingList(householdId, memberId);

    await expect(initSplit(list.id, householdId)).rejects.toThrow(/not found or not confirmed/i);
  });
});

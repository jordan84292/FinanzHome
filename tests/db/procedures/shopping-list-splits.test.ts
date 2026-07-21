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
  getShoppingList,
  getShoppingListItems,
} from '@/lib/db/procedures/shopping-list';
import { getSplit, initSplit, updateSplit } from '@/lib/db/procedures/shopping-list-splits';
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

async function createThreeMemberHousehold(suffix: string): Promise<{
  householdId: number;
  memberId: number;
  secondMemberId: number;
  thirdMemberId: number;
}> {
  const { householdId, memberId } = await createMember(suffix);
  const { memberId: secondMemberId } = await addSecondMember({
    householdId,
    invitedByMemberId: memberId,
    suffix: `${suffix}_b`,
  });
  const { memberId: thirdMemberId } = await addSecondMember({
    householdId,
    invitedByMemberId: memberId,
    suffix: `${suffix}_c`,
  });
  return { householdId, memberId, secondMemberId, thirdMemberId };
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
  isShared?: boolean;
  actualTotal?: number;
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
  const estimatedTotal = items.reduce((sum, item) => sum + item.quantity_needed * (item.unit_price ?? 0), 0);
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
    isShared: params.isShared ?? true,
    actualTotal: params.actualTotal ?? estimatedTotal,
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

  it('splits against the actual total entered at confirm time, not the estimated total', async () => {
    // 10 units at 1000 estimates to 10000, but the user typed in what they
    // actually paid at checkout — that figure is what must get split.
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
      actualTotal: 12345,
    });

    const splits = await initSplit(shoppingListId, householdId);

    const totalOwed = splits.reduce((sum, s) => sum + s.amount_owed, 0);
    expect(totalOwed).toBe(12345);
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

  it('reconciles amount_owed to sum exactly to total_actual when the equal split leaves a residual cent', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createThreeMemberHousehold(suffix);
    // 10 units at 1.00 CRC each => total_actual defaults to 10.00 (the helper's
    // estimated-total fallback), split 33.34/33.33/33.33 independently rounds
    // to 3.33/3.33/3.33 = 9.99, a cent short of 10.00.
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 10,
      currentQuantity: 0,
      defaultPrice: 1,
    });

    const splits = await initSplit(shoppingListId, householdId);

    expect(splits).toHaveLength(3);
    const totalOwedCents = Math.round(splits.reduce((sum, s) => sum + s.amount_owed, 0) * 100);
    expect(totalOwedCents).toBe(1000);
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

describe('sp_shopping_list_split_get', () => {
  it('returns the split rows with member display names', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 4,
      currentQuantity: 0,
      defaultPrice: 800,
    });
    await initSplit(shoppingListId, householdId);

    const splits = await getSplit(shoppingListId, householdId);

    expect(splits).toHaveLength(1);
    expect(splits[0].display_name).toBe('Owner');
    expect(splits[0].percentage).toBe(100);
  });

  it('returns an empty array for a confirmed list with no split yet', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 2,
      currentQuantity: 0,
      defaultPrice: 300,
    });

    const splits = await getSplit(shoppingListId, householdId);

    expect(splits).toHaveLength(0);
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

    await expect(getSplit(shoppingListId, householdIdB)).rejects.toThrow(/not found in this household/i);
  });
});

describe('updateSplit (transactional)', () => {
  it('updates all members and validates the sum in one transaction', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const { memberId: secondMemberId } = await addSecondMember({
      householdId,
      invitedByMemberId: memberId,
      suffix,
    });
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 10,
      currentQuantity: 0,
      defaultPrice: 1000,
    });
    await initSplit(shoppingListId, householdId);

    const result = await updateSplit({
      shoppingListId,
      householdId,
      updates: [
        { memberId, percentage: 70 },
        { memberId: secondMemberId, percentage: 30 },
      ],
    });

    expect(result.find((r) => r.member_id === memberId)?.percentage).toBe(70);
    expect(result.find((r) => r.member_id === secondMemberId)?.percentage).toBe(30);
    expect(result.find((r) => r.member_id === memberId)?.amount_owed).toBe(7000);
    expect(result.find((r) => r.member_id === secondMemberId)?.amount_owed).toBe(3000);
  });

  it('rolls back all updates when the percentages do not sum to 100', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const { memberId: secondMemberId } = await addSecondMember({
      householdId,
      invitedByMemberId: memberId,
      suffix,
    });
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 10,
      currentQuantity: 0,
      defaultPrice: 1000,
    });
    await initSplit(shoppingListId, householdId);

    await expect(
      updateSplit({
        shoppingListId,
        householdId,
        updates: [
          { memberId, percentage: 60 },
          { memberId: secondMemberId, percentage: 30 },
        ],
      }),
    ).rejects.toThrow(/must sum to 100/i);

    const unchanged = await getSplit(shoppingListId, householdId);
    expect(unchanged.find((r) => r.member_id === memberId)?.percentage).toBe(50);
    expect(unchanged.find((r) => r.member_id === secondMemberId)?.percentage).toBe(50);
  });

  it('reconciles amount_owed to sum exactly to total_estimated for arbitrary percentages that leave a residual cent', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId, secondMemberId, thirdMemberId } =
      await createThreeMemberHousehold(suffix);
    // 10 units at 1.00 CRC each => total_estimated = 10.00; 33.34/33.33/33.33
    // independently rounds to 3.33/3.33/3.33 = 9.99, a cent short of 10.00.
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 10,
      currentQuantity: 0,
      defaultPrice: 1,
    });
    await initSplit(shoppingListId, householdId);

    const result = await updateSplit({
      shoppingListId,
      householdId,
      updates: [
        { memberId, percentage: 33.34 },
        { memberId: secondMemberId, percentage: 33.33 },
        { memberId: thirdMemberId, percentage: 33.33 },
      ],
    });

    expect(result).toHaveLength(3);
    const totalOwedCents = Math.round(result.reduce((sum, s) => sum + s.amount_owed, 0) * 100);
    expect(totalOwedCents).toBe(1000);
  });

  it('rejects updating a member that does not belong to the household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createMember(suffixA);
    const { householdId: householdIdB, memberId: memberIdB } = await createMember(suffixB);
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId: householdIdA,
      memberId: memberIdA,
      suffix: suffixA,
      optimalQuantity: 5,
      currentQuantity: 0,
      defaultPrice: 500,
    });
    await initSplit(shoppingListId, householdIdA);

    await expect(
      updateSplit({
        shoppingListId,
        householdId: householdIdA,
        updates: [{ memberId: memberIdB, percentage: 100 }],
      }),
    ).rejects.toThrow(/not found in this household/i);
  });
});

describe('sp_shopping_list_confirm — is_shared flag', () => {
  it('records is_shared = 1 when confirmed as shared', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 3,
      currentQuantity: 0,
      defaultPrice: 1000,
      isShared: true,
    });

    const list = await getShoppingList(shoppingListId, householdId, CRC_ID);
    expect(list.is_shared).toBe(1);
  });

  it('records is_shared = 0 when confirmed as "solo mía"', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const { shoppingListId } = await confirmAListWithDeficit({
      householdId,
      memberId,
      suffix,
      optimalQuantity: 3,
      currentQuantity: 0,
      defaultPrice: 1000,
      isShared: false,
    });

    const list = await getShoppingList(shoppingListId, householdId, CRC_ID);
    expect(list.is_shared).toBe(0);
  });
});

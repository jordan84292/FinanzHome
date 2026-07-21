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
import { initSplit, markSplitPaid } from '@/lib/db/procedures/shopping-list-splits';
import { getMemberBalances } from '@/lib/db/procedures/dashboard';
import { uniqueSuffix } from '../../helpers/db';

const CRC_ID = 1;

async function createOwner(suffix: string): Promise<{ householdId: number; memberId: number }> {
  const user = await registerUser({
    email: `dashboard_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa Dashboard ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id };
}

async function addSecondMember(params: {
  householdId: number;
  invitedByMemberId: number;
  suffix: string;
}): Promise<{ memberId: number }> {
  const secondUser = await registerUser({
    email: `dashboard_second_${params.suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Second',
  });
  const invitation = await createInvitation({
    householdId: params.householdId,
    email: secondUser.email,
    token: `dashboard-token-${params.suffix}`,
    invitedByMemberId: params.invitedByMemberId,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  const member = await acceptInvitation({ token: invitation.token, userId: secondUser.id, displayName: 'Second' });
  return { memberId: member.id };
}

async function confirmSharedPurchase(params: {
  householdId: number;
  memberId: number;
  suffix: string;
  paidByMemberId: number;
}): Promise<{ shoppingListId: number }> {
  const [category] = await listCategories();
  const [unit] = await listUnits();
  await createProduct({
    householdId: params.householdId,
    name: `Producto ${params.suffix}`,
    categoryId: category.id,
    unitId: unit.id,
    optimalQuantity: 10,
    currentQuantity: 0,
    defaultPrice: 1000,
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
    isShared: true,
    actualTotal: 10000,
    paidByMemberId: params.paidByMemberId,
  });
  return { shoppingListId: list.id };
}

describe('sp_dashboard_member_balances — shared purchases', () => {
  it('nets an unpaid shopping split into the payer/debtor net_balance', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { shoppingListId } = await confirmSharedPurchase({ householdId, memberId, suffix, paidByMemberId: memberId });
    await initSplit(shoppingListId, householdId);

    const balances = await getMemberBalances(householdId, CRC_ID);
    const payerBalance = balances.find((b) => b.member_id === memberId)!;
    const debtorBalance = balances.find((b) => b.member_id === secondMemberId)!;

    expect(payerBalance.shopping_fronted_by_them).toBe(5000);
    expect(payerBalance.shopping_owed_to_others).toBe(0);
    expect(payerBalance.net_balance).toBe(5000);

    expect(debtorBalance.shopping_owed_to_others).toBe(5000);
    expect(debtorBalance.shopping_fronted_by_them).toBe(0);
    expect(debtorBalance.net_balance).toBe(-5000);
  });

  it('clears the net_balance once the debtor marks their split as paid', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { shoppingListId } = await confirmSharedPurchase({ householdId, memberId, suffix, paidByMemberId: memberId });
    const splits = await initSplit(shoppingListId, householdId);
    const debtorSplit = splits.find((s) => s.member_id === secondMemberId)!;

    await markSplitPaid({ splitId: debtorSplit.id, householdId, isPaid: true });

    const balances = await getMemberBalances(householdId, CRC_ID);
    const payerBalance = balances.find((b) => b.member_id === memberId)!;
    const debtorBalance = balances.find((b) => b.member_id === secondMemberId)!;

    expect(payerBalance.net_balance).toBe(0);
    expect(debtorBalance.net_balance).toBe(0);
  });

  it('does not net an unshared ("solo mía") purchase into any balance', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const [category] = await listCategories();
    const [unit] = await listUnits();
    await createProduct({
      householdId,
      name: `Solo mio ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 5,
      currentQuantity: 0,
      defaultPrice: 1000,
      defaultPriceCurrencyId: CRC_ID,
      createdByMemberId: memberId,
    });
    const list = await generateOrGetShoppingList(householdId, memberId);
    const items = await getShoppingListItems(list.id, householdId, CRC_ID);
    await confirmShoppingList({
      shoppingListId: list.id,
      householdId,
      items: items.map((item) => ({
        itemId: item.id,
        quantity: item.quantity_needed,
        unitPrice: item.unit_price,
        unitPriceCurrencyId: item.unit_price_currency_id,
      })),
      displayCurrencyId: CRC_ID,
      isShared: false,
      actualTotal: 5000,
      paidByMemberId: memberId,
    });

    const balances = await getMemberBalances(householdId, CRC_ID);
    const payerBalance = balances.find((b) => b.member_id === memberId)!;
    const otherBalance = balances.find((b) => b.member_id === secondMemberId)!;

    expect(payerBalance.net_balance).toBe(0);
    expect(otherBalance.net_balance).toBe(0);
  });
});

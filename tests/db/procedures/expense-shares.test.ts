import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import {
  acceptInvitation,
  createHousehold,
  createInvitation,
  getHouseholdsForUser,
} from '@/lib/db/procedures/household';
import { createRecurringExpense, listExpenseCategories } from '@/lib/db/procedures/recurring-expenses';
import { listRecurringExpenseShares, setRecurringExpenseShares } from '@/lib/db/procedures/expense-shares';
import { uniqueSuffix } from '../../helpers/db';

const CRC_ID = 1;

async function createOwner(suffix: string): Promise<{ householdId: number; memberId: number }> {
  const user = await registerUser({
    email: `shares_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa Shares ${suffix}`,
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
    email: `shares_second_${params.suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Second',
  });
  const invitation = await createInvitation({
    householdId: params.householdId,
    email: secondUser.email,
    token: `shares-token-${params.suffix}`,
    invitedByMemberId: params.invitedByMemberId,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  const member = await acceptInvitation({ token: invitation.token, userId: secondUser.id, displayName: 'Second' });
  return { memberId: member.id };
}

async function createExpense(params: {
  householdId: number;
  memberId: number;
  suffix: string;
  amount: number;
}): Promise<{ recurringExpenseId: number }> {
  const [category] = await listExpenseCategories();
  const expense = await createRecurringExpense({
    householdId: params.householdId,
    name: `Gasto compartido ${params.suffix}`,
    categoryId: category.id,
    amount: params.amount,
    currencyId: CRC_ID,
    periodicity: 'biweekly',
    dueDayConfig: null,
    withdrawalDay: 10,
    firstDueDate: null,
    responsibleMemberId: params.memberId,
    createdByMemberId: params.memberId,
  });
  return { recurringExpenseId: expense.id };
}

describe('setRecurringExpenseShares / listRecurringExpenseShares', () => {
  it('sets a 50/50 split between two members', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { recurringExpenseId } = await createExpense({ householdId, memberId, suffix, amount: 20000 });

    const result = await setRecurringExpenseShares({
      recurringExpenseId,
      householdId,
      shares: [
        { memberId, percentage: 50 },
        { memberId: secondMemberId, percentage: 50 },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.member_id === memberId)?.percentage).toBe(50);
    expect(result.find((r) => r.member_id === secondMemberId)?.percentage).toBe(50);

    const listed = await listRecurringExpenseShares(recurringExpenseId, householdId);
    expect(listed).toHaveLength(2);
  });

  it('rolls back entirely when percentages do not sum to 100', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { recurringExpenseId } = await createExpense({ householdId, memberId, suffix, amount: 10000 });

    await expect(
      setRecurringExpenseShares({
        recurringExpenseId,
        householdId,
        shares: [
          { memberId, percentage: 60 },
          { memberId: secondMemberId, percentage: 30 },
        ],
      }),
    ).rejects.toThrow(/must sum to 100/i);

    const listed = await listRecurringExpenseShares(recurringExpenseId, householdId);
    expect(listed).toHaveLength(0);
  });

  it('allows an empty share list, meaning the expense is not shared', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { recurringExpenseId } = await createExpense({ householdId, memberId, suffix, amount: 5000 });

    const result = await setRecurringExpenseShares({ recurringExpenseId, householdId, shares: [] });

    expect(result).toHaveLength(0);
  });

  it('replaces a previous split entirely, removing members no longer selected', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { recurringExpenseId } = await createExpense({ householdId, memberId, suffix, amount: 8000 });

    await setRecurringExpenseShares({
      recurringExpenseId,
      householdId,
      shares: [
        { memberId, percentage: 50 },
        { memberId: secondMemberId, percentage: 50 },
      ],
    });

    const replaced = await setRecurringExpenseShares({
      recurringExpenseId,
      householdId,
      shares: [{ memberId, percentage: 100 }],
    });

    expect(replaced).toHaveLength(1);
    expect(replaced[0].member_id).toBe(memberId);
  });

  it('rejects a member that does not belong to the household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createOwner(suffixA);
    const { memberId: memberIdB } = await createOwner(suffixB);
    const { recurringExpenseId } = await createExpense({
      householdId: householdIdA,
      memberId: memberIdA,
      suffix: suffixA,
      amount: 4000,
    });

    await expect(
      setRecurringExpenseShares({
        recurringExpenseId,
        householdId: householdIdA,
        shares: [{ memberId: memberIdB, percentage: 100 }],
      }),
    ).rejects.toThrow(/not found in this household/i);
  });

  it('rejects a recurring expense from a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createOwner(suffixA);
    const { householdId: householdIdB } = await createOwner(suffixB);
    const { recurringExpenseId } = await createExpense({
      householdId: householdIdA,
      memberId: memberIdA,
      suffix: suffixA,
      amount: 4000,
    });

    await expect(listRecurringExpenseShares(recurringExpenseId, householdIdB)).rejects.toThrow(
      /not found in this household/i,
    );
  });
});

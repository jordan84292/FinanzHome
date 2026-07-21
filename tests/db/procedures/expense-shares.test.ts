import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import {
  acceptInvitation,
  createHousehold,
  createInvitation,
  getHouseholdsForUser,
} from '@/lib/db/procedures/household';
import {
  createRecurringExpense,
  generateNextOccurrence,
  listExpenseCategories,
  listOccurrences,
  markOccurrencePaid,
} from '@/lib/db/procedures/recurring-expenses';
import {
  listRecurringExpenseShares,
  setRecurringExpenseShares,
  listExpenseOccurrenceShares,
  markExpenseOccurrenceSharePaid,
} from '@/lib/db/procedures/expense-shares';
import { uniqueSuffix } from '../../helpers/db';
import { callProcedure } from '@/lib/db/call';
import type { RowDataPacket } from 'mysql2';

const CRC_ID = 1;

interface OccurrenceShareRow extends RowDataPacket {
  id: number;
  occurrence_id: number;
  member_id: number;
  display_name: string;
  percentage: number;
  amount_owed: number;
}

async function listOccurrenceShares(occurrenceId: number, householdId: number): Promise<OccurrenceShareRow[]> {
  return callProcedure<OccurrenceShareRow>('sp_expense_occurrence_shares_snapshot', [occurrenceId, householdId]);
}

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

describe('automatic occurrence share snapshotting', () => {
  it('snapshots the current default split onto the first occurrence when shares are set before creation is impossible — set after creation snapshots the NEXT generated occurrence', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { recurringExpenseId } = await createExpense({ householdId, memberId, suffix, amount: 10000 });

    await setRecurringExpenseShares({
      recurringExpenseId,
      householdId,
      shares: [
        { memberId, percentage: 50 },
        { memberId: secondMemberId, percentage: 50 },
      ],
    });

    const [firstOccurrence] = await listOccurrences(recurringExpenseId, householdId);
    const history = await markOccurrencePaid({ occurrenceId: firstOccurrence.id, householdId, paidByMemberId: memberId });
    const nextOccurrence = history.find((o) => o.id !== firstOccurrence.id)!;

    // The next occurrence (generated after this mark-paid) must have been
    // snapshotted with the 50/50 split that was active at generation time.
    const rows = await listOccurrenceShares(nextOccurrence.id, householdId);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.member_id === memberId)?.amount_owed).toBe(5000);
    expect(rows.find((r) => r.member_id === secondMemberId)?.amount_owed).toBe(5000);
  });

  it('does not alter a previously-snapshotted occurrence when the default split changes later', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { recurringExpenseId } = await createExpense({ householdId, memberId, suffix, amount: 10000 });
    await setRecurringExpenseShares({
      recurringExpenseId,
      householdId,
      shares: [
        { memberId, percentage: 50 },
        { memberId: secondMemberId, percentage: 50 },
      ],
    });
    const [firstOccurrence] = await listOccurrences(recurringExpenseId, householdId);
    const history = await markOccurrencePaid({ occurrenceId: firstOccurrence.id, householdId, paidByMemberId: memberId });
    const secondOccurrence = history.find((o) => o.id !== firstOccurrence.id)!;
    const secondOccurrenceRowsBefore = await listOccurrenceShares(secondOccurrence.id, householdId);
    expect(secondOccurrenceRowsBefore.find((r) => r.member_id === memberId)?.amount_owed).toBe(5000);

    // Change the default split after the second occurrence has already been snapshotted.
    await setRecurringExpenseShares({
      recurringExpenseId,
      householdId,
      shares: [
        { memberId, percentage: 80 },
        { memberId: secondMemberId, percentage: 20 },
      ],
    });

    const secondOccurrenceRowsAfter = await listOccurrenceShares(secondOccurrence.id, householdId);
    expect(secondOccurrenceRowsAfter.find((r) => r.member_id === memberId)?.amount_owed).toBe(5000);
  });

  it('reconciles amount_owed to sum exactly to the recurring expense amount when the split leaves a residual cent', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { memberId: thirdMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix: `${suffix}_c` });
    // 10.00 split 33.34/33.33/33.33 independently rounds to 3.33/3.33/3.33 = 9.99, a cent short.
    const { recurringExpenseId } = await createExpense({ householdId, memberId, suffix, amount: 10 });
    const shares = await setRecurringExpenseShares({
      recurringExpenseId,
      householdId,
      shares: [
        { memberId, percentage: 33.34 },
        { memberId: secondMemberId, percentage: 33.33 },
        { memberId: thirdMemberId, percentage: 33.33 },
      ],
    });
    expect(shares).toHaveLength(3);

    const [firstOccurrence] = await listOccurrences(recurringExpenseId, householdId);
    const rows = await listOccurrenceShares(firstOccurrence.id, householdId);

    expect(rows).toHaveLength(3);
    const totalOwedCents = Math.round(rows.reduce((sum, r) => sum + r.amount_owed, 0) * 100);
    expect(totalOwedCents).toBe(1000);
  });

  it('produces no share rows for an occurrence when the expense has no shares configured', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { recurringExpenseId } = await createExpense({ householdId, memberId, suffix, amount: 3000 });

    const [firstOccurrence] = await listOccurrences(recurringExpenseId, householdId);
    const rows = await listOccurrenceShares(firstOccurrence.id, householdId);

    expect(rows).toHaveLength(0);
  });

  it('is idempotent: generating the same occurrence again does not duplicate share rows', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { recurringExpenseId } = await createExpense({ householdId, memberId, suffix, amount: 4000 });
    await setRecurringExpenseShares({
      recurringExpenseId,
      householdId,
      shares: [
        { memberId, percentage: 50 },
        { memberId: secondMemberId, percentage: 50 },
      ],
    });

    const [firstOccurrence] = await listOccurrences(recurringExpenseId, householdId);
    const rowsBefore = await listOccurrenceShares(firstOccurrence.id, householdId);
    // generateNextOccurrence is idempotent while unpaid (Fase 5) — calling
    // markOccurrencePaid is not the way to re-trigger it here; instead confirm
    // the snapshot itself doesn't re-run by calling generateNextOccurrence directly.
    await generateNextOccurrence(recurringExpenseId, householdId);
    const rowsAfter = await listOccurrenceShares(firstOccurrence.id, householdId);

    expect(rowsBefore).toHaveLength(2);
    expect(rowsAfter).toHaveLength(2);
  });
});

async function createOneTimeExpense(params: {
  householdId: number;
  memberId: number;
  suffix: string;
  amount: number;
  dueDate: string;
}): Promise<{ recurringExpenseId: number }> {
  const [category] = await listExpenseCategories();
  const expense = await createRecurringExpense({
    householdId: params.householdId,
    name: `Gasto unico ${params.suffix}`,
    categoryId: category.id,
    amount: params.amount,
    currencyId: CRC_ID,
    periodicity: 'one_time',
    dueDayConfig: null,
    withdrawalDay: null,
    firstDueDate: params.dueDate,
    responsibleMemberId: params.memberId,
    createdByMemberId: params.memberId,
  });
  return { recurringExpenseId: expense.id };
}

describe('per-member payment tracking for shared one_time expenses', () => {
  it('populates share rows on the already-existing occurrence when shares are configured after creation', async () => {
    // one_time expenses only ever get ONE occurrence, created inline by
    // createRecurringExpense — before the "Editar" UI can ever call
    // setRecurringExpenseShares. Without re-snapshotting after the fact, this
    // occurrence would be stuck with zero share rows forever.
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { recurringExpenseId } = await createOneTimeExpense({
      householdId,
      memberId,
      suffix,
      amount: 10000,
      dueDate: '2030-01-15',
    });

    const [occurrence] = await listOccurrences(recurringExpenseId, householdId);
    const before = await listExpenseOccurrenceShares(occurrence.id, householdId);
    expect(before).toHaveLength(0);

    await setRecurringExpenseShares({
      recurringExpenseId,
      householdId,
      shares: [
        { memberId, percentage: 50 },
        { memberId: secondMemberId, percentage: 50 },
      ],
    });

    const after = await listExpenseOccurrenceShares(occurrence.id, householdId);
    expect(after).toHaveLength(2);
    expect(after.find((r) => r.member_id === memberId)?.amount_owed).toBe(5000);
    expect(after.find((r) => r.member_id === secondMemberId)?.amount_owed).toBe(5000);
    expect(after.every((r) => r.is_paid === 0)).toBe(true);
  });

  it('marks each share paid independently and only flips the occurrence to paid once every share is paid', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const { memberId: secondMemberId } = await addSecondMember({ householdId, invitedByMemberId: memberId, suffix });
    const { recurringExpenseId } = await createOneTimeExpense({
      householdId,
      memberId,
      suffix,
      amount: 8000,
      dueDate: '2030-02-01',
    });
    await setRecurringExpenseShares({
      recurringExpenseId,
      householdId,
      shares: [
        { memberId, percentage: 50 },
        { memberId: secondMemberId, percentage: 50 },
      ],
    });
    const [occurrence] = await listOccurrences(recurringExpenseId, householdId);
    const [shareA, shareB] = await listExpenseOccurrenceShares(occurrence.id, householdId);

    const afterFirst = await markExpenseOccurrenceSharePaid({ shareId: shareA.id, householdId, isPaid: true });
    expect(afterFirst.find((s) => s.id === shareA.id)?.is_paid).toBe(1);
    expect(afterFirst.find((s) => s.id === shareB.id)?.is_paid).toBe(0);
    const [occurrenceAfterFirst] = await listOccurrences(recurringExpenseId, householdId);
    expect(occurrenceAfterFirst.is_paid).toBe(0);

    const afterSecond = await markExpenseOccurrenceSharePaid({ shareId: shareB.id, householdId, isPaid: true });
    expect(afterSecond.every((s) => s.is_paid === 1)).toBe(true);
    const [occurrenceAfterSecond] = await listOccurrences(recurringExpenseId, householdId);
    expect(occurrenceAfterSecond.is_paid).toBe(1);

    // Unmarking one share reopens the occurrence.
    const afterUnmark = await markExpenseOccurrenceSharePaid({ shareId: shareA.id, householdId, isPaid: false });
    expect(afterUnmark.find((s) => s.id === shareA.id)?.is_paid).toBe(0);
    const [occurrenceAfterUnmark] = await listOccurrences(recurringExpenseId, householdId);
    expect(occurrenceAfterUnmark.is_paid).toBe(0);
  });

  it('rejects marking a share paid from a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createOwner(suffixA);
    const { householdId: householdIdB } = await createOwner(suffixB);
    const { recurringExpenseId } = await createOneTimeExpense({
      householdId: householdIdA,
      memberId: memberIdA,
      suffix: suffixA,
      amount: 4000,
      dueDate: '2030-03-01',
    });
    await setRecurringExpenseShares({
      recurringExpenseId,
      householdId: householdIdA,
      shares: [{ memberId: memberIdA, percentage: 100 }],
    });
    const [occurrence] = await listOccurrences(recurringExpenseId, householdIdA);
    const [share] = await listExpenseOccurrenceShares(occurrence.id, householdIdA);

    await expect(
      markExpenseOccurrenceSharePaid({ shareId: share.id, householdId: householdIdB, isPaid: true }),
    ).rejects.toThrow(/not found in this household/i);
  });
});

# Fase 6 — Gastos compartidos entre miembros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** let a household split any recurring expense between members by percentage — a default split that's saved once, reused automatically on every future billing cycle, and only editable going forward (never retroactively altering a cycle that already happened).

**Architecture:** DB-first, same as every prior phase. Two new tables: `recurring_expense_shares` (the editable, current default split for a recurring expense) and `expense_occurrence_shares` (an immutable per-cycle snapshot of that split, taken automatically the moment each `expense_occurrence` is generated). The snapshot SP (`sp_expense_occurrence_shares_snapshot`) is invoked from inside the exact same transaction that already calls `sp_expense_occurrence_generate_next` (in `src/lib/db/procedures/recurring-expenses.ts`, built in Fase 5) — so a recurring expense's shares can be edited freely without ever touching cycles that were already snapshotted. Setting the share list uses a full clear-then-reinsert pattern (not an in-place diff) so members can be freely added or removed from the split between saves. All arithmetic is per-member SQL calls in a loop ("loop chico" cursor pattern, identical to Fase 3's shopping-list split and Fase 5's occurrence generation) — no JSON, no window functions.

**Tech Stack:** MariaDB 10.4.32 stored procedures, Next.js 16 Server Actions, Vitest + mysql2 integration tests.

## Global Constraints

- Every stored procedure that reads/writes household-scoped rows must validate the row belongs to the given `household_id` (or, for `expense_occurrence_shares`, that its parent `expense_occurrence`'s `recurring_expense` does) via a `SELECT COUNT(*) INTO v_exists ... IF v_exists = 0 THEN SIGNAL SQLSTATE '45000' ...` check before touching any data. Hard project rule, no exceptions.
- MariaDB 10.4.32: no `JSON_TABLE`, no JSON at all in this phase — every array (the per-member share list) is handled as individual SP calls in a loop from the TS wrapper (matching Fase 3's `updateSplit` and Fase 5's per-member cursor patterns), never a JSON column or parameter.
- Percentages are `DECIMAL(5,2)`; money (`amount_owed`) is `DECIMAL(12,2)` — same as Fase 3's `shopping_list_splits`.
- SP naming: `sp_<entity>_<action>.sql`, one file per procedure in `db/procedures/`, each starting with `DROP PROCEDURE IF EXISTS <name>;`.
- TS wrapper convention: one function per SP in `src/lib/db/procedures/<file>.ts`, calling `callProcedure<T>('sp_name', [params...])`.
- Multi-SP-call flows that must succeed or fail together use `withTransaction` from `src/lib/db/transaction.ts`.
- An empty share list (no members selected) is a valid, meaningful state: "this expense is not shared." Only validate the 100% sum when at least one share row exists — mirrors how a `recurring_expense` can exist with zero shares today (Fase 5 never required sharing).
- When shares exist and a new occurrence is generated, the snapshot must reconcile any rounding residual onto the lowest-`member_id` row so `SUM(amount_owed) = recurring_expenses.amount` exactly — same reconciliation pattern already proven in `sp_shopping_list_split_init`/`sp_shopping_list_split_validate` (Fase 3) and copied verbatim here.
- Run `npx tsc --noEmit`, `npm run build`, and `npm test` after every task; all three must be clean before committing.
- Local MariaDB (XAMPP) must be running on port 3307 for `npm test` — if a task hits `ECONNREFUSED`, that is an environment problem to report, not something to work around.

---

### Task 1: `recurring_expense_shares` schema + set/clear/validate/list

**Files:**
- Create: `db/migrations/009_expense_shares.sql`
- Create: `db/procedures/sp_recurring_expense_share_clear.sql`
- Create: `db/procedures/sp_recurring_expense_share_set.sql`
- Create: `db/procedures/sp_recurring_expense_share_validate.sql`
- Create: `db/procedures/sp_recurring_expense_share_list.sql`
- Create: `src/lib/db/procedures/expense-shares.ts`
- Test: `tests/db/procedures/expense-shares.test.ts` (new file)

**Interfaces:**
- Consumes: `callProcedure`/`withTransaction`, `createRecurringExpense`/`listExpenseCategories` (`src/lib/db/procedures/recurring-expenses.ts`, Fase 5), `createHousehold`/`createInvitation`/`acceptInvitation`/`getHouseholdsForUser` (`src/lib/db/procedures/household.ts`), `registerUser` (`src/lib/db/procedures/auth.ts`), `uniqueSuffix` (`tests/helpers/db.ts`).
- Produces: `ExpenseShareRecord` type, `listRecurringExpenseShares(recurringExpenseId, householdId)`, `setRecurringExpenseShares(params)` — consumed by Task 3's UI.

- [ ] **Step 1: Write the failing tests**

Create `tests/db/procedures/expense-shares.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- expense-shares.test.ts`
Expected: FAIL — module `@/lib/db/procedures/expense-shares` does not exist yet.

- [ ] **Step 3: Create the migration**

Create `db/migrations/009_expense_shares.sql`:

```sql
CREATE TABLE recurring_expense_shares (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recurring_expense_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  CONSTRAINT fk_recurring_expense_shares_expense FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id),
  CONSTRAINT fk_recurring_expense_shares_member FOREIGN KEY (member_id) REFERENCES household_members(id),
  CONSTRAINT uq_recurring_expense_shares_expense_member UNIQUE (recurring_expense_id, member_id),
  CONSTRAINT chk_recurring_expense_shares_percentage CHECK (percentage >= 0 AND percentage <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE expense_occurrence_shares (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  occurrence_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  amount_owed DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_expense_occurrence_shares_occurrence FOREIGN KEY (occurrence_id) REFERENCES expense_occurrences(id),
  CONSTRAINT fk_expense_occurrence_shares_member FOREIGN KEY (member_id) REFERENCES household_members(id),
  CONSTRAINT uq_expense_occurrence_shares_occurrence_member UNIQUE (occurrence_id, member_id),
  CONSTRAINT chk_expense_occurrence_shares_percentage CHECK (percentage >= 0 AND percentage <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`expense_occurrence_shares` is created now (Task 1) but only populated starting in Task 2 — its `INSERT`s live entirely inside `sp_expense_occurrence_shares_snapshot`, which Task 1 does not touch.

- [ ] **Step 4: Create the SPs**

Create `db/procedures/sp_recurring_expense_share_clear.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_recurring_expense_share_clear;

CREATE PROCEDURE sp_recurring_expense_share_clear(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  DELETE FROM recurring_expense_shares WHERE recurring_expense_id = p_recurring_expense_id;
END;
```

Create `db/procedures/sp_recurring_expense_share_set.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_recurring_expense_share_set;

CREATE PROCEDURE sp_recurring_expense_share_set(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_member_id INT UNSIGNED,
  IN p_percentage DECIMAL(5,2)
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_member_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  SELECT COUNT(*) INTO v_member_exists
  FROM household_members
  WHERE id = p_member_id AND household_id = p_household_id;

  IF v_member_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member not found in this household';
  END IF;

  INSERT INTO recurring_expense_shares (recurring_expense_id, member_id, percentage)
  VALUES (p_recurring_expense_id, p_member_id, p_percentage);
END;
```

Create `db/procedures/sp_recurring_expense_share_validate.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_recurring_expense_share_validate;

CREATE PROCEDURE sp_recurring_expense_share_validate(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_share_count INT;
  DECLARE v_percentage_sum DECIMAL(6,2);

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  SELECT COUNT(*), SUM(percentage) INTO v_share_count, v_percentage_sum
  FROM recurring_expense_shares
  WHERE recurring_expense_id = p_recurring_expense_id;

  -- An empty share list (v_share_count = 0) is a valid "not shared" state and
  -- skips the sum check entirely — only validate once at least one member is selected.
  IF v_share_count > 0 AND v_percentage_sum <> 100 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Percentages must sum to 100';
  END IF;

  SELECT res.id, res.recurring_expense_id, res.member_id, hm.display_name, res.percentage
  FROM recurring_expense_shares res
  INNER JOIN household_members hm ON hm.id = res.member_id
  WHERE res.recurring_expense_id = p_recurring_expense_id
  ORDER BY hm.id ASC;
END;
```

Create `db/procedures/sp_recurring_expense_share_list.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_recurring_expense_share_list;

CREATE PROCEDURE sp_recurring_expense_share_list(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  SELECT res.id, res.recurring_expense_id, res.member_id, hm.display_name, res.percentage
  FROM recurring_expense_shares res
  INNER JOIN household_members hm ON hm.id = res.member_id
  WHERE res.recurring_expense_id = p_recurring_expense_id
  ORDER BY hm.id ASC;
END;
```

- [ ] **Step 5: Implement the TS wrapper**

Create `src/lib/db/procedures/expense-shares.ts`:

```typescript
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';
import { withTransaction } from '../transaction';

export interface ExpenseShareRecord extends RowDataPacket {
  id: number;
  recurring_expense_id: number;
  member_id: number;
  display_name: string;
  percentage: number;
}

export async function listRecurringExpenseShares(
  recurringExpenseId: number,
  householdId: number,
): Promise<ExpenseShareRecord[]> {
  return callProcedure<ExpenseShareRecord>('sp_recurring_expense_share_list', [
    recurringExpenseId,
    householdId,
  ]);
}

export async function setRecurringExpenseShares(params: {
  recurringExpenseId: number;
  householdId: number;
  shares: Array<{ memberId: number; percentage: number }>;
}): Promise<ExpenseShareRecord[]> {
  return withTransaction(async (call) => {
    await call('sp_recurring_expense_share_clear', [params.recurringExpenseId, params.householdId]);
    for (const share of params.shares) {
      await call('sp_recurring_expense_share_set', [
        params.recurringExpenseId,
        params.householdId,
        share.memberId,
        share.percentage,
      ]);
    }
    return call<ExpenseShareRecord>('sp_recurring_expense_share_validate', [
      params.recurringExpenseId,
      params.householdId,
    ]);
  });
}
```

**IMPORTANT — this file grows in Task 2.** Task 2 will add `ExpenseOccurrenceShareRecord` for the snapshot's row shape, used only internally by Task 2's tests (there is no UI-facing wrapper for the snapshot per the plan — it's triggered from inside `recurring-expenses.ts`, not called directly from any Server Action).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- expense-shares.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 7: Run full verification**

Run: `npx tsc --noEmit` — clean.
Run: `npm run build` — succeeds.
Run: `npm test` — all pass, no regressions.

- [ ] **Step 8: Commit**

```bash
git checkout -b feature/fase-6-gastos-compartidos
git add db/migrations/009_expense_shares.sql db/procedures/sp_recurring_expense_share_clear.sql db/procedures/sp_recurring_expense_share_set.sql db/procedures/sp_recurring_expense_share_validate.sql db/procedures/sp_recurring_expense_share_list.sql src/lib/db/procedures/expense-shares.ts tests/db/procedures/expense-shares.test.ts
git commit -m "feat(gastos): add recurring expense share set/clear/validate/list"
```

---

### Task 2: Automatic per-occurrence share snapshot

**Files:**
- Create: `db/procedures/sp_expense_occurrence_shares_snapshot.sql`
- Modify: `src/lib/db/procedures/expense-shares.ts` (add `ExpenseOccurrenceShareRecord`)
- Modify: `src/lib/db/procedures/recurring-expenses.ts` (wire the snapshot call into `createRecurringExpense` and `markOccurrencePaid`)
- Modify: `tests/db/procedures/expense-shares.test.ts` (append new `describe` block)

**Interfaces:**
- Consumes: `withTransaction`, `createRecurringExpense`/`markOccurrencePaid`/`listOccurrences` (`recurring-expenses.ts`, Fase 5), `setRecurringExpenseShares` (Task 1).
- Produces: automatic snapshotting — no new UI-facing wrapper function, per the plan (the snapshot SP is only ever called from inside `recurring-expenses.ts`'s existing transactions, using the raw SP name string like every other internal chained call in this codebase).

- [ ] **Step 1: Write the failing tests**

Append to `tests/db/procedures/expense-shares.test.ts` (add `listOccurrences`, `markOccurrencePaid` to the existing import from `@/lib/db/procedures/recurring-expenses`):

```typescript
import { listOccurrences, markOccurrencePaid } from '@/lib/db/procedures/recurring-expenses';

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
```

Add the missing imports at the top of the test file: `generateNextOccurrence` from `@/lib/db/procedures/recurring-expenses`, and a new `listOccurrenceShares` test-only helper — since the plan does not expose a public wrapper for reading `expense_occurrence_shares` (no UI needs it yet; Fase 8's dashboard will read this table directly later), add this ONE small helper at the top of the test file (not in `src/`, since nothing outside tests needs it yet). It calls `sp_expense_occurrence_shares_snapshot` itself rather than a separate read-only SP: since that procedure is idempotent and always ends with a `SELECT` of the current rows for the occurrence (see Step 3 below), calling it again when rows already exist is a safe no-op that still returns the existing rows — exactly what a read needs:

```typescript
import { callProcedure } from '@/lib/db/call';
import type { RowDataPacket } from 'mysql2';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- expense-shares.test.ts`
Expected: FAIL — `sp_expense_occurrence_shares_snapshot` does not exist yet, and `listOccurrences`/`markOccurrencePaid`/`generateNextOccurrence` calls won't have snapshotted anything.

- [ ] **Step 3: Implement `sp_expense_occurrence_shares_snapshot`**

Create `db/procedures/sp_expense_occurrence_shares_snapshot.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_expense_occurrence_shares_snapshot;

CREATE PROCEDURE sp_expense_occurrence_shares_snapshot(
  IN p_occurrence_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_already_snapshotted INT;
  DECLARE v_recurring_expense_id INT UNSIGNED;
  DECLARE v_amount DECIMAL(12,2);
  DECLARE v_share_count INT;
  DECLARE v_member_id INT UNSIGNED;
  DECLARE v_percentage DECIMAL(5,2);
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_amount_sum DECIMAL(12,2);
  DECLARE v_amount_diff DECIMAL(12,2);
  DECLARE v_share_cursor CURSOR FOR
    SELECT member_id, percentage FROM recurring_expense_shares WHERE recurring_expense_id = v_recurring_expense_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  SELECT COUNT(*) INTO v_exists
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eo.id = p_occurrence_id AND re.household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expense occurrence not found in this household';
  END IF;

  SELECT eo.recurring_expense_id INTO v_recurring_expense_id
  FROM expense_occurrences eo
  WHERE eo.id = p_occurrence_id;

  -- Idempotent: a second call for the same occurrence (e.g. generateNextOccurrence
  -- being called again while it's still unpaid) must not duplicate rows or
  -- re-snapshot against a since-changed default split.
  SELECT COUNT(*) INTO v_already_snapshotted
  FROM expense_occurrence_shares
  WHERE occurrence_id = p_occurrence_id;

  IF v_already_snapshotted = 0 THEN
    SELECT amount INTO v_amount FROM recurring_expenses WHERE id = v_recurring_expense_id;

    SELECT COUNT(*) INTO v_share_count
    FROM recurring_expense_shares
    WHERE recurring_expense_id = v_recurring_expense_id;

    -- A recurring expense with no configured shares is simply not shared —
    -- no rows are inserted, and that is the correct, valid final state.
    IF v_share_count > 0 THEN
      SET v_done = 0;
      OPEN v_share_cursor;
      read_loop: LOOP
        FETCH v_share_cursor INTO v_member_id, v_percentage;
        IF v_done THEN
          LEAVE read_loop;
        END IF;

        INSERT INTO expense_occurrence_shares (occurrence_id, member_id, percentage, amount_owed)
        VALUES (p_occurrence_id, v_member_id, v_percentage, ROUND(v_amount * v_percentage / 100, 2));
      END LOOP;
      CLOSE v_share_cursor;

      SELECT SUM(amount_owed) INTO v_amount_sum
      FROM expense_occurrence_shares
      WHERE occurrence_id = p_occurrence_id;

      SET v_amount_diff = v_amount - v_amount_sum;

      IF v_amount_diff <> 0 THEN
        UPDATE expense_occurrence_shares
        SET amount_owed = amount_owed + v_amount_diff
        WHERE occurrence_id = p_occurrence_id
        ORDER BY member_id ASC
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  SELECT eos.id, eos.occurrence_id, eos.member_id, hm.display_name, eos.percentage, eos.amount_owed
  FROM expense_occurrence_shares eos
  INNER JOIN household_members hm ON hm.id = eos.member_id
  WHERE eos.occurrence_id = p_occurrence_id
  ORDER BY hm.id ASC;
END;
```

- [ ] **Step 4: Wire the snapshot into `recurring-expenses.ts`'s existing transactions**

In `src/lib/db/procedures/recurring-expenses.ts`, modify `createRecurringExpense` to snapshot the first occurrence right after generating it:

```typescript
export async function createRecurringExpense(params: {
  householdId: number;
  name: string;
  categoryId: number;
  amount: number;
  currencyId: number;
  periodicity: 'weekly' | 'biweekly' | 'one_time';
  dueDayConfig: number | null;
  withdrawalDay: number | null;
  firstDueDate: string | null;
  responsibleMemberId: number;
  createdByMemberId: number;
}): Promise<RecurringExpenseRecord> {
  return withTransaction(async (call) => {
    const rows = await call<RecurringExpenseRecord>('sp_recurring_expense_create', [
      params.householdId,
      params.name,
      params.categoryId,
      params.amount,
      params.currencyId,
      params.periodicity,
      params.dueDayConfig,
      params.withdrawalDay,
      params.firstDueDate,
      params.responsibleMemberId,
      params.createdByMemberId,
    ]);
    const recurringExpense = rows[0];
    const occurrenceRows = await call<{ id: number } & RowDataPacket>('sp_expense_occurrence_generate_next', [
      recurringExpense.id,
      params.householdId,
    ]);
    await call('sp_expense_occurrence_shares_snapshot', [occurrenceRows[0].id, params.householdId]);
    return recurringExpense;
  });
}
```

Modify `markOccurrencePaid` to snapshot the newly generated next occurrence:

```typescript
export async function markOccurrencePaid(params: {
  occurrenceId: number;
  householdId: number;
  paidByMemberId: number;
}): Promise<ExpenseOccurrenceRecord[]> {
  return withTransaction(async (call) => {
    const rows = await call<ExpenseOccurrenceRecord>('sp_expense_occurrence_mark_paid', [
      params.occurrenceId,
      params.householdId,
      params.paidByMemberId,
    ]);
    const paidOccurrence = rows[0];
    const nextOccurrenceRows = await call<ExpenseOccurrenceRecord>('sp_expense_occurrence_generate_next', [
      paidOccurrence.recurring_expense_id,
      params.householdId,
    ]);
    await call('sp_expense_occurrence_shares_snapshot', [nextOccurrenceRows[0].id, params.householdId]);
    return call<ExpenseOccurrenceRecord>('sp_expense_occurrence_list', [
      paidOccurrence.recurring_expense_id,
      params.householdId,
    ]);
  });
}
```

Both call sites now capture `sp_expense_occurrence_generate_next`'s return value (previously discarded in `createRecurringExpense`, already captured as `paidOccurrence`/re-fetched via `sp_expense_occurrence_list` in `markOccurrencePaid` — only the intermediate `nextOccurrenceRows` binding is new there) purely to get the occurrence `id` to pass into the snapshot call. Since `sp_expense_occurrence_generate_next` is idempotent while an occurrence is unpaid (Fase 5), and the snapshot is idempotent once rows exist (this task), calling both unconditionally on every `createRecurringExpense`/`markOccurrencePaid` is always safe.

- [ ] **Step 5: Add `ExpenseOccurrenceShareRecord` to the wrapper (for future use, e.g. Fase 8)**

In `src/lib/db/procedures/expense-shares.ts`, add after `ExpenseShareRecord`:

```typescript
export interface ExpenseOccurrenceShareRecord extends RowDataPacket {
  id: number;
  occurrence_id: number;
  member_id: number;
  display_name: string;
  percentage: number;
  amount_owed: number;
}
```

No exported function reads this type yet — per the plan, no UI in this phase displays occurrence-level shares (Fase 8's dashboard reads this table directly later). The type is added now purely so it exists alongside its sibling `ExpenseShareRecord` for whoever needs it next; do not add a wrapper function for it in this task.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- expense-shares.test.ts`
Expected: PASS, all tests green (including Task 1's tests, unmodified).

- [ ] **Step 7: Run full verification**

Run: `npx tsc --noEmit` — clean.
Run: `npm run build` — succeeds.
Run: `npm test` — all pass, no regressions.

- [ ] **Step 8: Commit**

```bash
git add db/procedures/sp_expense_occurrence_shares_snapshot.sql src/lib/db/procedures/expense-shares.ts src/lib/db/procedures/recurring-expenses.ts tests/db/procedures/expense-shares.test.ts
git commit -m "feat(gastos): snapshot the default share split onto each generated occurrence"
```

---

### Task 3: "Compartir con" UI in the expense edit form

**Files:**
- Modify: `src/app/gastos/actions.ts` (add `getRecurringExpenseSharesAction`, `setRecurringExpenseSharesAction`)
- Modify: `src/components/gastos/RecurringExpenseForm.tsx` (add the share-editing section, edit mode only)

**Interfaces:**
- Consumes: `listRecurringExpenseShares`, `setRecurringExpenseShares` (`@/lib/db/procedures/expense-shares`, Task 1), `HouseholdMemberRecord` (already a prop on `RecurringExpenseForm`, `@/lib/db/procedures/household`).
- Produces: the finished Fase 6 feature end-to-end.

A recurring expense doesn't exist yet during `mode: 'create'`, so there's no `recurringExpenseId` to attach shares to — this section only renders in `mode: 'edit'`, exactly like Task 4 (Fase 5) already scoped the periodicity/schedule fields to `create`-only for the mirror-image reason. The share-editing section is a self-contained sub-component with its own local state and its own save action (not part of the surrounding `<form>`'s single submit), mirroring `SplitPanel`'s (`src/components/shopping-list/SplitPanel.tsx`, Fase 3) fetch-on-mount + explicit-save pattern — read that file first for the concrete style to match.

- [ ] **Step 1: Add the Server Actions**

In `src/app/gastos/actions.ts`, add this import:

```typescript
import {
  listRecurringExpenseShares,
  setRecurringExpenseShares,
  type ExpenseShareRecord,
} from '@/lib/db/procedures/expense-shares';
```

Add at the end of the file:

```typescript
export interface GetExpenseSharesState {
  shares: ExpenseShareRecord[];
  error: string | null;
}

export async function getRecurringExpenseSharesAction(recurringExpenseId: number): Promise<GetExpenseSharesState> {
  const membership = await requireMembership();
  try {
    const shares = await listRecurringExpenseShares(recurringExpenseId, membership.id);
    return { shares, error: null };
  } catch {
    return { shares: [], error: 'No se pudo cargar el reparto de este gasto.' };
  }
}

export interface SetExpenseSharesState {
  shares: ExpenseShareRecord[];
  error: string | null;
}

export async function setRecurringExpenseSharesAction(
  recurringExpenseId: number,
  shares: Array<{ memberId: number; percentage: number }>,
): Promise<SetExpenseSharesState> {
  const membership = await requireMembership();
  try {
    const result = await setRecurringExpenseShares({ recurringExpenseId, householdId: membership.id, shares });
    revalidatePath('/gastos');
    return { shares: result, error: null };
  } catch {
    return { shares: [], error: 'Los porcentajes deben sumar 100%.' };
  }
}
```

- [ ] **Step 2: Add the share-editing section to `RecurringExpenseForm`**

In `src/components/gastos/RecurringExpenseForm.tsx`, add these imports:

```typescript
import { useEffect } from 'react';
import { getRecurringExpenseSharesAction, setRecurringExpenseSharesAction } from '@/app/gastos/actions';
import { showError, showSuccess } from '@/lib/ui/alerts';
```

(`useState` is already imported from Task 4 — add `useEffect` alongside it in the same `import { useActionState, useState, useEffect } from 'react';` line rather than a separate import statement.)

Add this new component in the same file, above `RecurringExpenseForm`:

```tsx
function ExpenseSharesSection({
  recurringExpenseId,
  members,
}: {
  recurringExpenseId: number;
  members: HouseholdMemberRecord[];
}) {
  const [shares, setShares] = useState<ExpenseShareRecord[] | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [percentages, setPercentages] = useState<Record<number, number>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getRecurringExpenseSharesAction(recurringExpenseId).then((result) => {
      if (result.error) {
        showError(result.error);
        return;
      }
      setShares(result.shares);
      setSelected(Object.fromEntries(result.shares.map((s) => [s.member_id, true])));
      setPercentages(Object.fromEntries(result.shares.map((s) => [s.member_id, s.percentage])));
    });
  }, [recurringExpenseId]);

  const selectedMemberIds = members.filter((m) => selected[m.id]).map((m) => m.id);
  const sum = selectedMemberIds.reduce((acc, id) => acc + (percentages[id] ?? 0), 0);
  const sumIsValid = selectedMemberIds.length === 0 || Math.abs(sum - 100) < 0.001;

  function handleSave(): void {
    const sharesToSave = selectedMemberIds.map((memberId) => ({
      memberId,
      percentage: percentages[memberId] ?? 0,
    }));
    startTransition(() => {
      setRecurringExpenseSharesAction(recurringExpenseId, sharesToSave).then((result) => {
        if (result.error) {
          showError(result.error);
          return;
        }
        showSuccess('Reparto guardado.');
      });
    });
  }

  if (shares === null) {
    return <p className="text-body-secondary">Cargando reparto…</p>;
  }

  return (
    <div className="border rounded p-3">
      <h3 className="h6 mb-3">Compartir con</h3>
      <div className="d-flex flex-column gap-2">
        {members.map((member) => (
          <div key={member.id} className="d-flex align-items-center gap-2">
            <input
              type="checkbox"
              className="form-check-input"
              checked={selected[member.id] ?? false}
              onChange={(e) => setSelected((prev) => ({ ...prev, [member.id]: e.target.checked }))}
            />
            <span className="flex-grow-1">{member.display_name}</span>
            {selected[member.id] ? (
              <div className="input-group" style={{ maxWidth: 120 }}>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  className="form-control"
                  value={percentages[member.id] ?? 0}
                  onChange={(e) =>
                    setPercentages((prev) => ({ ...prev, [member.id]: Number(e.target.value) }))
                  }
                />
                <span className="input-group-text">%</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {selectedMemberIds.length > 0 ? (
        <div className={`mt-2 ${sumIsValid ? 'text-success' : 'text-danger'}`}>Total: {sum.toFixed(2)}%</div>
      ) : (
        <div className="mt-2 text-body-secondary">Sin compartir</div>
      )}
      <button
        type="button"
        className="btn btn-outline-primary btn-sm mt-2"
        disabled={!sumIsValid || isPending}
        onClick={handleSave}
      >
        {isPending ? 'Guardando…' : 'Guardar reparto'}
      </button>
    </div>
  );
}
```

Add the missing imports this new component needs at the top of the file: `useTransition` from `'react'`, and `type ExpenseShareRecord` from `'@/lib/db/procedures/expense-shares'`.

In `RecurringExpenseForm`'s render body, add the new section right after the closing `</select>` of the `responsibleMemberId` field and before the `mode === 'create'` periodicity block, rendered only in edit mode:

```tsx
{mode === 'edit' && expense ? (
  <ExpenseSharesSection recurringExpenseId={expense.id} members={members} />
) : null}
```

- [ ] **Step 3: Manual verification**

Run: `npx tsc --noEmit` — clean.
Run: `npm run build` — succeeds.
Run: `npm test` — all pass, no regressions (this task adds no new automated tests, matching the established convention for UI/wiring tasks — `SplitPanel`, `ExpenseDetailPanel` also have none; this section's behavior is covered indirectly by Task 1/2's SP-level tests plus this task's manual verification).

- [ ] **Step 4: Commit**

```bash
git add src/app/gastos/actions.ts src/components/gastos/RecurringExpenseForm.tsx
git commit -m "feat(gastos): add Compartir con share editor to the expense edit form"
```

---

## After all tasks: final whole-branch review

Once Tasks 1-3 are all committed on `feature/fase-6-gastos-compartidos`, dispatch a final whole-branch review (most capable model available) covering the full diff against `main`, focusing on: household-scoping completeness across every new SP, the clear-then-reinsert share-replacement semantics (no orphaned rows, no partial states survive a rollback), the snapshot's idempotency and reconciliation-cent correctness, and whether wiring the snapshot into `recurring-expenses.ts`'s two existing transactions could ever leave a `recurring_expense` or `expense_occurrence` in a state where an occurrence exists but its snapshot silently failed to run (it can't — same transaction, same commit/rollback boundary — but verify this explicitly rather than assuming it). Fix any Critical/Important findings and re-review before merging, exactly as done for Fases 3, 4, and 5.

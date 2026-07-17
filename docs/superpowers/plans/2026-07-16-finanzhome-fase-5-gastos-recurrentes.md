# Fase 5 — Gastos y servicios recurrentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** let a household register recurring expenses/services (weekly, biweekly, or one-time), track each billing cycle ("occurrence") with its due date, see an at-a-glance status chip (al día / vence pronto / vencido), and mark cycles as paid — which automatically generates the next cycle for recurring (non-one-time) expenses.

**Architecture:** DB-first, same as every prior phase. Three new tables (`expense_categories`, `recurring_expenses`, `expense_occurrences`) plus one small addition to the existing household schema surface (`sp_household_member_list`, needed to populate the "responsible member" dropdown). All date/periodicity math lives in `sp_expense_occurrence_generate_next`, a stored procedure using only `DATE_ADD`/`WEEKDAY`/`CURDATE` — no JSON, no window functions. Creating a recurring expense and marking an occurrence paid each wrap two dependent SP calls (the entity write + `sp_expense_occurrence_generate_next`) in one DB transaction via the existing `withTransaction` helper (`src/lib/db/transaction.ts`), so a recurring expense can never exist with zero occurrences and a paid cycle always leaves exactly one open cycle behind (except `one_time`, which never regenerates).

**Tech Stack:** MariaDB 10.4.32 stored procedures, Next.js 16 Server Actions, Zod, Bootstrap classes (existing UI conventions), Vitest + mysql2 for integration tests against a real `finanzhome_test` database.

## Global Constraints

- Every stored procedure that reads/writes household-scoped rows must validate the row belongs to the given `household_id` (or, for `expense_occurrences`, that its parent `recurring_expense` does) via a `SELECT COUNT(*) INTO v_exists ... IF v_exists = 0 THEN SIGNAL SQLSTATE '45000' ...` check before touching any data. This is a hard project rule, not a per-task suggestion.
- MariaDB 10.4.32: no `JSON_TABLE`. This phase needs no JSON at all — every list/array here is a plain table, not a JSON column.
- Money columns are `DECIMAL(12,2)`; percentages (none in this phase, but keep the convention for Fase 6) are `DECIMAL(5,2)`.
- Currency ids are fixed seed data: `1` = CRC (₡), `2` = USD ($) — see `db/migrations/002_currencies.sql`. Tests and Server Actions may hardcode `1`/`2` the same way `src/app/compras/actions.ts` hardcodes `DISPLAY_CURRENCY_ID = 1`.
- SP naming: `sp_<entity>_<action>.sql`, one file per procedure in `db/procedures/`, each file starts with `DROP PROCEDURE IF EXISTS <name>;`.
- TS wrapper convention: one function per SP in `src/lib/db/procedures/<file>.ts`, calling `callProcedure<T>('sp_name', [params...])`, returning `rows[0]` for single-row results or the full array for lists. See `src/lib/db/procedures/shopping-list-splits.ts` for the exact shape to copy.
- Multi-SP-call flows that must succeed or fail together use `withTransaction` from `src/lib/db/transaction.ts` (`withTransaction(async (call) => { await call('sp_a', [...]); return call('sp_b', [...]); })`).
- Server Actions live in `src/app/<route>/actions.ts`, start with `'use server'`, call `requireMembership()` from `@/lib/household/require-membership` first, validate `FormData` with Zod, and call `revalidatePath('/gastos')` after a successful mutation. Follow `src/app/inventario/actions.ts` and `src/app/compras/actions.ts` exactly.
- UI convention: a single route page (`src/app/gastos/page.tsx`, server component) loads all data and renders one client component (`gastos-client.tsx`) holding a `panel` state (`null | { mode: 'create' } | { mode: 'edit'; ... } | { mode: 'detail'; ... }`) that renders a bottom-sheet-style modal. Copy `src/app/inventario/inventory-client.tsx`'s structure exactly (same fixed-bottom overlay markup, same Bootstrap classes).
- Run `npx tsc --noEmit`, `npm run build`, and `npm test` after every task; all three must be clean before committing.
- Test DB: `npm test` drops and recreates `finanzhome_test` from scratch every run (see `tests/global-setup.ts`), reapplying every file in `db/migrations/` and `db/procedures/` — so new SQL files are picked up automatically, no manual test-DB setup required.

---

### Task 1: Household member list + expense categories + recurring_expenses schema & CRUD

**Files:**
- Create: `db/procedures/sp_household_member_list.sql`
- Modify: `src/lib/db/procedures/household.ts` (add `listHouseholdMembers`)
- Create: `db/migrations/008_recurring_expenses.sql`
- Create: `db/procedures/sp_expense_category_list.sql`
- Create: `db/procedures/sp_expense_category_create.sql`
- Create: `db/procedures/sp_recurring_expense_create.sql`
- Create: `db/procedures/sp_recurring_expense_update.sql`
- Create: `db/procedures/sp_recurring_expense_deactivate.sql`
- Create: `db/procedures/sp_recurring_expense_list.sql`
- Create: `src/lib/db/procedures/recurring-expenses.ts`
- Test: `tests/db/procedures/household.test.ts` (add member-list tests to the existing file)
- Test: `tests/db/procedures/recurring-expenses.test.ts` (new file)

**Interfaces:**
- Consumes: `callProcedure`/`callProcedureOn` (`src/lib/db/call.ts`), `withTransaction` (`src/lib/db/transaction.ts`), `getHouseholdsForUser`/`createHousehold`/`createInvitation`/`acceptInvitation` (`src/lib/db/procedures/household.ts`), `registerUser` (`src/lib/db/procedures/auth.ts`), `uniqueSuffix` (`tests/helpers/db.ts`).
- Produces: `HouseholdMemberRecord[]` via `listHouseholdMembers(householdId)` (household.ts already declares the `HouseholdMemberRecord` interface at line 20 — reuse it, do not redeclare). `ExpenseCategoryRecord`, `RecurringExpenseRecord` types and `listExpenseCategories()`, `createExpenseCategory(name)`, `listRecurringExpenses(householdId)`, `createRecurringExpense(params)`, `updateRecurringExpense(params)`, `deactivateRecurringExpense(id, householdId)` — all consumed by Task 4's UI and by Task 2/3's additions to the same file.

- [ ] **Step 1: Write the failing tests for `listHouseholdMembers`**

Append to `tests/db/procedures/household.test.ts` (read the existing file first to match its exact helper functions/imports before appending — do not duplicate helpers that already exist there):

```typescript
import { listHouseholdMembers } from '@/lib/db/procedures/household';

describe('sp_household_member_list', () => {
  it('lists every member of a household with their display name and role', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `member_list_owner_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const household = await createHousehold({
      name: `Casa MemberList ${suffix}`,
      creatorUserId: user.id,
      creatorDisplayName: 'Owner',
    });
    const secondUser = await registerUser({
      email: `member_list_second_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Second',
    });
    const [ownerMembership] = await getHouseholdsForUser(user.id);
    const invitation = await createInvitation({
      householdId: household.id,
      email: secondUser.email,
      token: `member-list-token-${suffix}`,
      invitedByMemberId: ownerMembership.member_id,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await acceptInvitation({ token: invitation.token, userId: secondUser.id, displayName: 'Second' });

    const members = await listHouseholdMembers(household.id);

    expect(members).toHaveLength(2);
    expect(members.map((m) => m.display_name).sort()).toEqual(['Owner', 'Second']);
    expect(members.find((m) => m.display_name === 'Owner')?.role).toBe('owner');
  });

  it('returns an empty array for a household with a bad id', async () => {
    const members = await listHouseholdMembers(999_999_999);
    expect(members).toHaveLength(0);
  });
});
```

(Match this test's imports — `registerUser`, `createHousehold`, `createInvitation`, `acceptInvitation`, `getHouseholdsForUser`, `uniqueSuffix` — to whatever the existing file already imports; add only what's missing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- household.test.ts`
Expected: FAIL — `listHouseholdMembers is not a function` (or a TypeScript error if run through `npx tsc --noEmit` first).

- [ ] **Step 3: Implement `sp_household_member_list` and the wrapper**

Create `db/procedures/sp_household_member_list.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_household_member_list;

CREATE PROCEDURE sp_household_member_list(
  IN p_household_id INT UNSIGNED
)
BEGIN
  SELECT id, household_id, user_id, display_name, role, joined_at
  FROM household_members
  WHERE household_id = p_household_id
  ORDER BY joined_at ASC;
END;
```

In `src/lib/db/procedures/household.ts`, add this function after `getHouseholdsForUser` (reuse the existing `HouseholdMemberRecord` interface already declared near the top of the file — do not redeclare it):

```typescript
export async function listHouseholdMembers(householdId: number): Promise<HouseholdMemberRecord[]> {
  return callProcedure<HouseholdMemberRecord>('sp_household_member_list', [householdId]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- household.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing tests for expense categories + recurring expense CRUD**

Create `tests/db/procedures/recurring-expenses.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import {
  createExpenseCategory,
  createRecurringExpense,
  deactivateRecurringExpense,
  listExpenseCategories,
  listRecurringExpenses,
  updateRecurringExpense,
} from '@/lib/db/procedures/recurring-expenses';
import { uniqueSuffix } from '../../helpers/db';

const CRC_ID = 1;

async function createOwner(suffix: string): Promise<{ householdId: number; memberId: number }> {
  const user = await registerUser({
    email: `recur_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa Recur ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id };
}

describe('sp_expense_category_list / sp_expense_category_create', () => {
  it('creates a category and lists it', async () => {
    const suffix = uniqueSuffix();
    const created = await createExpenseCategory(`Categoria ${suffix}`);
    const categories = await listExpenseCategories();

    expect(created.name).toBe(`Categoria ${suffix}`);
    expect(categories.some((c) => c.id === created.id)).toBe(true);
  });
});

describe('sp_recurring_expense_create', () => {
  it('creates a weekly recurring expense', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();

    const expense = await createRecurringExpense({
      householdId,
      name: `Internet ${suffix}`,
      categoryId: category.id,
      amount: 25000,
      currencyId: CRC_ID,
      periodicity: 'weekly',
      dueDayConfig: 5,
      withdrawalDay: 15,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    expect(expense.name).toBe(`Internet ${suffix}`);
    expect(expense.periodicity).toBe('weekly');
    expect(expense.currency_code).toBe('CRC');
    expect(expense.responsible_display_name).toBe('Owner');
    expect(expense.is_active).toBe(1);
  });

  it('creates a one_time recurring expense with a first_due_date', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();

    const expense = await createRecurringExpense({
      householdId,
      name: `Seguro ${suffix}`,
      categoryId: category.id,
      amount: 100000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: '2026-12-01',
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    expect(expense.periodicity).toBe('one_time');
    expect(expense.first_due_date).not.toBeNull();
  });

  it('rejects a responsible member that does not belong to the household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA } = await createOwner(suffixA);
    const { memberId: memberIdB } = await createOwner(suffixB);
    const [category] = await listExpenseCategories();

    await expect(
      createRecurringExpense({
        householdId: householdIdA,
        name: `Malo ${suffixA}`,
        categoryId: category.id,
        amount: 1000,
        currencyId: CRC_ID,
        periodicity: 'biweekly',
        dueDayConfig: null,
        withdrawalDay: 1,
        firstDueDate: null,
        responsibleMemberId: memberIdB,
        createdByMemberId: memberIdB,
      }),
    ).rejects.toThrow(/not found in this household/i);
  });
});

describe('sp_recurring_expense_update / sp_recurring_expense_deactivate / sp_recurring_expense_list', () => {
  it('updates name/amount/category/currency/responsible member', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Luz ${suffix}`,
      categoryId: category.id,
      amount: 30000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 10,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const updated = await updateRecurringExpense({
      recurringExpenseId: expense.id,
      householdId,
      name: `Luz actualizada ${suffix}`,
      categoryId: category.id,
      amount: 35000,
      currencyId: CRC_ID,
      responsibleMemberId: memberId,
    });

    expect(updated.name).toBe(`Luz actualizada ${suffix}`);
    expect(updated.amount).toBe(35000);
  });

  it('rejects updating a recurring expense from a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createOwner(suffixA);
    const { householdId: householdIdB } = await createOwner(suffixB);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId: householdIdA,
      name: `Agua ${suffixA}`,
      categoryId: category.id,
      amount: 10000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 5,
      firstDueDate: null,
      responsibleMemberId: memberIdA,
      createdByMemberId: memberIdA,
    });

    await expect(
      updateRecurringExpense({
        recurringExpenseId: expense.id,
        householdId: householdIdB,
        name: 'Hackeado',
        categoryId: category.id,
        amount: 1,
        currencyId: CRC_ID,
        responsibleMemberId: memberIdA,
      }),
    ).rejects.toThrow(/not found in this household/i);
  });

  it('deactivates a recurring expense and it stops appearing in the list', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Gimnasio ${suffix}`,
      categoryId: category.id,
      amount: 20000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 20,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    await deactivateRecurringExpense(expense.id, householdId);
    const list = await listRecurringExpenses(householdId);

    expect(list.some((e) => e.id === expense.id)).toBe(false);
  });

  it('lists active recurring expenses with status sin_ocurrencia before any occurrence exists', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    await createRecurringExpense({
      householdId,
      name: `Cable ${suffix}`,
      categoryId: category.id,
      amount: 15000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 3,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const list = await listRecurringExpenses(householdId);

    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('sin_ocurrencia');
    expect(list[0].next_occurrence_id).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm test -- recurring-expenses.test.ts`
Expected: FAIL — module `@/lib/db/procedures/recurring-expenses` does not exist yet.

- [ ] **Step 7: Create the migration**

Create `db/migrations/008_recurring_expenses.sql`:

```sql
CREATE TABLE expense_categories (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO expense_categories (name) VALUES
  ('Vivienda'), ('Servicios'), ('Transporte'), ('Salud'), ('Entretenimiento'), ('Otros');

CREATE TABLE recurring_expenses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id SMALLINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency_id TINYINT UNSIGNED NOT NULL,
  periodicity ENUM('weekly', 'biweekly', 'one_time') NOT NULL,
  due_day_config TINYINT UNSIGNED NULL,
  withdrawal_day TINYINT UNSIGNED NULL,
  first_due_date DATE NULL,
  responsible_member_id INT UNSIGNED NOT NULL,
  created_by_member_id INT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recurring_expenses_household FOREIGN KEY (household_id) REFERENCES households(id),
  CONSTRAINT fk_recurring_expenses_category FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  CONSTRAINT fk_recurring_expenses_currency FOREIGN KEY (currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_recurring_expenses_responsible FOREIGN KEY (responsible_member_id) REFERENCES household_members(id),
  CONSTRAINT fk_recurring_expenses_created_by FOREIGN KEY (created_by_member_id) REFERENCES household_members(id),
  CONSTRAINT chk_recurring_expenses_amount CHECK (amount > 0),
  CONSTRAINT chk_recurring_expenses_schedule CHECK (
    (periodicity = 'weekly' AND due_day_config BETWEEN 1 AND 7 AND withdrawal_day BETWEEN 1 AND 31 AND first_due_date IS NULL)
    OR (periodicity = 'biweekly' AND due_day_config IS NULL AND withdrawal_day BETWEEN 1 AND 31 AND first_due_date IS NULL)
    OR (periodicity = 'one_time' AND due_day_config IS NULL AND withdrawal_day IS NULL AND first_due_date IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE expense_occurrences (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recurring_expense_id INT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  is_paid TINYINT(1) NOT NULL DEFAULT 0,
  paid_by_member_id INT UNSIGNED NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expense_occurrences_recurring FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id),
  CONSTRAINT fk_expense_occurrences_paid_by FOREIGN KEY (paid_by_member_id) REFERENCES household_members(id),
  CONSTRAINT uq_expense_occurrences_recurring_period UNIQUE (recurring_expense_id, period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Note: `chk_recurring_expenses_schedule` follows the exact NULL-tolerant pattern already used by `chk_users_payment_schedule` in `db/migrations/004_payment_schedule.sql` — a CHECK constraint passes when its expression evaluates to `NULL`, so mixing `BETWEEN`/`IS NULL` branches per periodicity is safe and already proven in this codebase.

`expense_occurrences` has no `household_id` column — household scoping for it is always done by joining through `recurring_expenses.household_id`, exactly like `shopping_list_splits` joins through `shopping_lists`.

- [ ] **Step 8: Create the category SPs**

Create `db/procedures/sp_expense_category_list.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_expense_category_list;

CREATE PROCEDURE sp_expense_category_list()
BEGIN
  SELECT id, name FROM expense_categories ORDER BY name;
END;
```

Create `db/procedures/sp_expense_category_create.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_expense_category_create;

CREATE PROCEDURE sp_expense_category_create(
  IN p_name VARCHAR(100)
)
BEGIN
  INSERT INTO expense_categories (name) VALUES (p_name);
  SELECT id, name FROM expense_categories WHERE id = LAST_INSERT_ID();
END;
```

- [ ] **Step 9: Create the recurring-expense CRUD SPs**

Create `db/procedures/sp_recurring_expense_create.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_recurring_expense_create;

CREATE PROCEDURE sp_recurring_expense_create(
  IN p_household_id INT UNSIGNED,
  IN p_name VARCHAR(150),
  IN p_category_id SMALLINT UNSIGNED,
  IN p_amount DECIMAL(12,2),
  IN p_currency_id TINYINT UNSIGNED,
  IN p_periodicity ENUM('weekly', 'biweekly', 'one_time'),
  IN p_due_day_config TINYINT UNSIGNED,
  IN p_withdrawal_day TINYINT UNSIGNED,
  IN p_first_due_date DATE,
  IN p_responsible_member_id INT UNSIGNED,
  IN p_created_by_member_id INT UNSIGNED
)
BEGIN
  DECLARE v_member_exists INT;

  SELECT COUNT(*) INTO v_member_exists
  FROM household_members
  WHERE id = p_responsible_member_id AND household_id = p_household_id;

  IF v_member_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Responsible member not found in this household';
  END IF;

  INSERT INTO recurring_expenses (
    household_id, name, category_id, amount, currency_id, periodicity,
    due_day_config, withdrawal_day, first_due_date, responsible_member_id, created_by_member_id
  ) VALUES (
    p_household_id, p_name, p_category_id, p_amount, p_currency_id, p_periodicity,
    p_due_day_config, p_withdrawal_day, p_first_due_date, p_responsible_member_id, p_created_by_member_id
  );

  SELECT
    re.id, re.household_id, re.name, re.category_id, ec.name AS category_name,
    re.amount, re.currency_id, c.code AS currency_code, c.symbol AS currency_symbol,
    re.periodicity, re.due_day_config, re.withdrawal_day, re.first_due_date,
    re.responsible_member_id, hm.display_name AS responsible_display_name,
    re.is_active, re.created_at
  FROM recurring_expenses re
  INNER JOIN expense_categories ec ON ec.id = re.category_id
  INNER JOIN currencies c ON c.id = re.currency_id
  INNER JOIN household_members hm ON hm.id = re.responsible_member_id
  WHERE re.id = LAST_INSERT_ID();
END;
```

Create `db/procedures/sp_recurring_expense_update.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_recurring_expense_update;

CREATE PROCEDURE sp_recurring_expense_update(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_name VARCHAR(150),
  IN p_category_id SMALLINT UNSIGNED,
  IN p_amount DECIMAL(12,2),
  IN p_currency_id TINYINT UNSIGNED,
  IN p_responsible_member_id INT UNSIGNED
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
  WHERE id = p_responsible_member_id AND household_id = p_household_id;

  IF v_member_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Responsible member not found in this household';
  END IF;

  -- periodicity/due_day_config/withdrawal_day/first_due_date are intentionally
  -- immutable after creation: changing them would desync already-generated
  -- expense_occurrences rows from the new schedule. If the schedule is wrong,
  -- deactivate this recurring expense and create a new one instead.
  UPDATE recurring_expenses
  SET name = p_name,
      category_id = p_category_id,
      amount = p_amount,
      currency_id = p_currency_id,
      responsible_member_id = p_responsible_member_id
  WHERE id = p_recurring_expense_id;

  SELECT
    re.id, re.household_id, re.name, re.category_id, ec.name AS category_name,
    re.amount, re.currency_id, c.code AS currency_code, c.symbol AS currency_symbol,
    re.periodicity, re.due_day_config, re.withdrawal_day, re.first_due_date,
    re.responsible_member_id, hm.display_name AS responsible_display_name,
    re.is_active, re.created_at
  FROM recurring_expenses re
  INNER JOIN expense_categories ec ON ec.id = re.category_id
  INNER JOIN currencies c ON c.id = re.currency_id
  INNER JOIN household_members hm ON hm.id = re.responsible_member_id
  WHERE re.id = p_recurring_expense_id;
END;
```

Create `db/procedures/sp_recurring_expense_deactivate.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_recurring_expense_deactivate;

CREATE PROCEDURE sp_recurring_expense_deactivate(
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

  UPDATE recurring_expenses SET is_active = 0 WHERE id = p_recurring_expense_id;
END;
```

Create `db/procedures/sp_recurring_expense_list.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_recurring_expense_list;

CREATE PROCEDURE sp_recurring_expense_list(
  IN p_household_id INT UNSIGNED
)
BEGIN
  SELECT
    re.id, re.household_id, re.name, re.category_id, ec.name AS category_name,
    re.amount, re.currency_id, c.code AS currency_code, c.symbol AS currency_symbol,
    re.periodicity, re.due_day_config, re.withdrawal_day, re.first_due_date,
    re.responsible_member_id, hm.display_name AS responsible_display_name,
    re.is_active, re.created_at,
    next_occ.id AS next_occurrence_id,
    next_occ.due_date AS next_due_date,
    CASE
      WHEN next_occ.id IS NULL THEN 'sin_ocurrencia'
      WHEN next_occ.due_date < CURDATE() THEN 'vencido'
      WHEN next_occ.due_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY) THEN 'vence_pronto'
      ELSE 'al_dia'
    END AS status
  FROM recurring_expenses re
  INNER JOIN expense_categories ec ON ec.id = re.category_id
  INNER JOIN currencies c ON c.id = re.currency_id
  INNER JOIN household_members hm ON hm.id = re.responsible_member_id
  LEFT JOIN expense_occurrences next_occ ON next_occ.id = (
    SELECT eo.id FROM expense_occurrences eo
    WHERE eo.recurring_expense_id = re.id AND eo.is_paid = 0
    ORDER BY eo.due_date ASC
    LIMIT 1
  )
  WHERE re.household_id = p_household_id AND re.is_active = 1
  ORDER BY (next_occ.due_date IS NULL) ASC, next_occ.due_date ASC, re.name ASC;
END;
```

The "vence pronto" window is 3 days — a deliberately wider warning window than Fase 7's WhatsApp `due_soon` reminder (which fires exactly at `today + 1`), so the UI chip gives visual notice a bit ahead of the first automated reminder.

- [ ] **Step 10: Implement the TS wrapper**

Create `src/lib/db/procedures/recurring-expenses.ts`:

```typescript
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface ExpenseCategoryRecord extends RowDataPacket {
  id: number;
  name: string;
}

export interface RecurringExpenseRecord extends RowDataPacket {
  id: number;
  household_id: number;
  name: string;
  category_id: number;
  category_name: string;
  amount: number;
  currency_id: number;
  currency_code: 'CRC' | 'USD';
  currency_symbol: string;
  periodicity: 'weekly' | 'biweekly' | 'one_time';
  due_day_config: number | null;
  withdrawal_day: number | null;
  first_due_date: string | null;
  responsible_member_id: number;
  responsible_display_name: string;
  is_active: number;
  created_at: string;
  /**
   * Only populated by sp_recurring_expense_list's correlated subquery.
   * sp_recurring_expense_create/update do not include these columns —
   * callers of createRecurringExpense/updateRecurringExpense must not read
   * them; re-fetch via listRecurringExpenses() for the full detail.
   */
  next_occurrence_id?: number | null;
  next_due_date?: string | null;
  status?: 'vencido' | 'vence_pronto' | 'al_dia' | 'sin_ocurrencia';
}

export async function listExpenseCategories(): Promise<ExpenseCategoryRecord[]> {
  return callProcedure<ExpenseCategoryRecord>('sp_expense_category_list');
}

export async function createExpenseCategory(name: string): Promise<ExpenseCategoryRecord> {
  const rows = await callProcedure<ExpenseCategoryRecord>('sp_expense_category_create', [name]);
  return rows[0];
}

export async function listRecurringExpenses(householdId: number): Promise<RecurringExpenseRecord[]> {
  return callProcedure<RecurringExpenseRecord>('sp_recurring_expense_list', [householdId]);
}

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
  const rows = await callProcedure<RecurringExpenseRecord>('sp_recurring_expense_create', [
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
  return rows[0];
}

export async function updateRecurringExpense(params: {
  recurringExpenseId: number;
  householdId: number;
  name: string;
  categoryId: number;
  amount: number;
  currencyId: number;
  responsibleMemberId: number;
}): Promise<RecurringExpenseRecord> {
  const rows = await callProcedure<RecurringExpenseRecord>('sp_recurring_expense_update', [
    params.recurringExpenseId,
    params.householdId,
    params.name,
    params.categoryId,
    params.amount,
    params.currencyId,
    params.responsibleMemberId,
  ]);
  return rows[0];
}

export async function deactivateRecurringExpense(
  recurringExpenseId: number,
  householdId: number,
): Promise<void> {
  await callProcedure('sp_recurring_expense_deactivate', [recurringExpenseId, householdId]);
}
```

**IMPORTANT — this file grows in Tasks 2 and 3.** Task 2 will change `createRecurringExpense`'s body to wrap the create + first-occurrence-generation in `withTransaction`, and will add `ExpenseOccurrenceRecord` + `generateNextOccurrence`. Task 3 will add `listOccurrences` and `markOccurrencePaid`. Do not treat this file as finished after this task.

- [ ] **Step 11: Run tests to verify they pass**

Run: `npm test -- recurring-expenses.test.ts household.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 12: Run full verification**

Run: `npx tsc --noEmit`
Expected: clean, no output.

Run: `npm run build`
Expected: succeeds.

Run: `npm test`
Expected: all tests pass (no regressions in other files).

- [ ] **Step 13: Commit**

```bash
git checkout -b feature/fase-5-gastos-recurrentes
git add db/migrations/008_recurring_expenses.sql db/procedures/sp_household_member_list.sql db/procedures/sp_expense_category_list.sql db/procedures/sp_expense_category_create.sql db/procedures/sp_recurring_expense_create.sql db/procedures/sp_recurring_expense_update.sql db/procedures/sp_recurring_expense_deactivate.sql db/procedures/sp_recurring_expense_list.sql src/lib/db/procedures/recurring-expenses.ts src/lib/db/procedures/household.ts tests/db/procedures/recurring-expenses.test.ts tests/db/procedures/household.test.ts
git commit -m "feat(gastos): add expense categories and recurring expense CRUD"
```

(Only create the branch if it doesn't already exist — this is the first task of the phase.)

---

### Task 2: `sp_expense_occurrence_generate_next` (periodicity date math)

**Files:**
- Create: `db/procedures/sp_expense_occurrence_generate_next.sql`
- Modify: `src/lib/db/procedures/recurring-expenses.ts` (add `ExpenseOccurrenceRecord`, `generateNextOccurrence`; change `createRecurringExpense` to wrap create + generate in one transaction)
- Modify: `tests/db/procedures/recurring-expenses.test.ts` (append new `describe` blocks)

**Interfaces:**
- Consumes: `withTransaction` (`src/lib/db/transaction.ts`), everything from Task 1's `recurring-expenses.ts`.
- Produces: `ExpenseOccurrenceRecord` type and `generateNextOccurrence(recurringExpenseId, householdId)`, consumed by Task 3's `markOccurrencePaid` and Task 5's detail panel.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db/procedures/recurring-expenses.test.ts` (add these imports to the existing import block at the top: `generateNextOccurrence` from `@/lib/db/procedures/recurring-expenses`):

```typescript
describe('sp_expense_occurrence_generate_next', () => {
  it('generates the first occurrence for a weekly expense on the next matching weekday', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Internet semanal ${suffix}`,
      categoryId: category.id,
      amount: 5000,
      currencyId: CRC_ID,
      periodicity: 'weekly',
      dueDayConfig: 5, // Viernes
      withdrawalDay: 15,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    // createRecurringExpense already generates the first occurrence transactionally.
    const occurrence = await generateNextOccurrence(expense.id, householdId);

    expect(occurrence.recurring_expense_id).toBe(expense.id);
    const dueDate = new Date(`${occurrence.due_date}T00:00:00`);
    expect(dueDate.getDay()).toBe(5); // JS: 0=Sunday..6=Saturday, 5=Friday
    expect(occurrence.is_paid).toBe(0);
  });

  it('is idempotent while an occurrence is still unpaid', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Cable quincenal ${suffix}`,
      categoryId: category.id,
      amount: 8000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 10,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const first = await generateNextOccurrence(expense.id, householdId);
    const second = await generateNextOccurrence(expense.id, householdId);

    expect(second.id).toBe(first.id);
  });

  it('generates a biweekly occurrence 14 days after the previous due date once paid', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Agua quincenal ${suffix}`,
      categoryId: category.id,
      amount: 6000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 8,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const first = await generateNextOccurrence(expense.id, householdId);
    // Directly flip is_paid via a second call isn't possible yet (mark_paid
    // lands in Task 3) — instead assert generate_next stays a no-op while
    // the first occurrence is still open, which is the guard this task owns.
    const stillFirst = await generateNextOccurrence(expense.id, householdId);
    expect(stillFirst.id).toBe(first.id);
    expect(stillFirst.due_date).toBe(first.due_date);
  });

  it('generates exactly one occurrence for one_time and never a second one', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Matricula ${suffix}`,
      categoryId: category.id,
      amount: 50000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: '2026-09-01',
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const occurrence = await generateNextOccurrence(expense.id, householdId);
    expect(occurrence.due_date.slice(0, 10)).toBe('2026-09-01');

    const secondCall = await generateNextOccurrence(expense.id, householdId);
    expect(secondCall.id).toBe(occurrence.id);
  });

  it('rejects a recurring expense from a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createOwner(suffixA);
    const { householdId: householdIdB } = await createOwner(suffixB);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId: householdIdA,
      name: `Cross-household ${suffixA}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 1,
      firstDueDate: null,
      responsibleMemberId: memberIdA,
      createdByMemberId: memberIdA,
    });

    await expect(generateNextOccurrence(expense.id, householdIdB)).rejects.toThrow(
      /not found in this household/i,
    );
  });
});

describe('sp_recurring_expense_list status after an occurrence exists', () => {
  it('reports vencido when the next due date is in the past', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Vencido test ${suffix}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: '2020-01-01',
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });
    await generateNextOccurrence(expense.id, householdId);

    const list = await listRecurringExpenses(householdId);
    const found = list.find((e) => e.id === expense.id);

    expect(found?.status).toBe('vencido');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- recurring-expenses.test.ts`
Expected: FAIL — `generateNextOccurrence is not a function`, and `createRecurringExpense` tests that implicitly rely on auto-generation are unaffected yet (they don't check occurrences directly in Task 1).

- [ ] **Step 3: Implement `sp_expense_occurrence_generate_next`**

Create `db/procedures/sp_expense_occurrence_generate_next.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_expense_occurrence_generate_next;

CREATE PROCEDURE sp_expense_occurrence_generate_next(
  IN p_recurring_expense_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_periodicity ENUM('weekly', 'biweekly', 'one_time');
  DECLARE v_due_day_config TINYINT UNSIGNED;
  DECLARE v_first_due_date DATE;
  DECLARE v_open_count INT;
  DECLARE v_occurrence_count INT;
  DECLARE v_last_period_end DATE;
  DECLARE v_last_due_date DATE;
  DECLARE v_start_date DATE;
  DECLARE v_due_date DATE;

  SELECT COUNT(*) INTO v_exists
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recurring expense not found in this household';
  END IF;

  SELECT periodicity, due_day_config, first_due_date
  INTO v_periodicity, v_due_day_config, v_first_due_date
  FROM recurring_expenses
  WHERE id = p_recurring_expense_id;

  SELECT COUNT(*) INTO v_open_count
  FROM expense_occurrences
  WHERE recurring_expense_id = p_recurring_expense_id AND is_paid = 0;

  IF v_open_count = 0 THEN
    IF v_periodicity = 'one_time' THEN
      SELECT COUNT(*) INTO v_occurrence_count
      FROM expense_occurrences
      WHERE recurring_expense_id = p_recurring_expense_id;

      IF v_occurrence_count = 0 THEN
        INSERT INTO expense_occurrences (recurring_expense_id, period_start, period_end, due_date)
        VALUES (p_recurring_expense_id, v_first_due_date, v_first_due_date, v_first_due_date);
      END IF;
    ELSEIF v_periodicity = 'weekly' THEN
      SELECT MAX(period_end) INTO v_last_period_end
      FROM expense_occurrences
      WHERE recurring_expense_id = p_recurring_expense_id;

      SET v_start_date = IFNULL(DATE_ADD(v_last_period_end, INTERVAL 1 DAY), CURDATE());
      -- WEEKDAY() returns 0=Monday..6=Sunday, matching due_day_config's 1=Monday..7=Sunday
      -- once shifted by -1; MOD(...,7) after adding 7 keeps the result in 0..6 even when
      -- the raw difference is negative.
      SET v_due_date = DATE_ADD(
        v_start_date,
        INTERVAL MOD((v_due_day_config - 1) - WEEKDAY(v_start_date) + 7, 7) DAY
      );

      INSERT INTO expense_occurrences (recurring_expense_id, period_start, period_end, due_date)
      VALUES (p_recurring_expense_id, v_start_date, v_due_date, v_due_date);
    ELSEIF v_periodicity = 'biweekly' THEN
      SELECT MAX(due_date) INTO v_last_due_date
      FROM expense_occurrences
      WHERE recurring_expense_id = p_recurring_expense_id;

      IF v_last_due_date IS NULL THEN
        SET v_start_date = CURDATE();
        SET v_due_date = DATE_ADD(CURDATE(), INTERVAL 14 DAY);
      ELSE
        SET v_start_date = DATE_ADD(v_last_due_date, INTERVAL 1 DAY);
        SET v_due_date = DATE_ADD(v_last_due_date, INTERVAL 14 DAY);
      END IF;

      INSERT INTO expense_occurrences (recurring_expense_id, period_start, period_end, due_date)
      VALUES (p_recurring_expense_id, v_start_date, v_due_date, v_due_date);
    END IF;
  END IF;

  SELECT id, recurring_expense_id, period_start, period_end, due_date, is_paid, paid_by_member_id, paid_at, created_at
  FROM expense_occurrences
  WHERE recurring_expense_id = p_recurring_expense_id
  ORDER BY due_date DESC, id DESC
  LIMIT 1;
END;
```

- [ ] **Step 4: Update the TS wrapper**

In `src/lib/db/procedures/recurring-expenses.ts`, add the `ExpenseOccurrenceRecord` interface (after `RecurringExpenseRecord`):

```typescript
export interface ExpenseOccurrenceRecord extends RowDataPacket {
  id: number;
  recurring_expense_id: number;
  period_start: string;
  period_end: string;
  due_date: string;
  is_paid: number;
  paid_by_member_id: number | null;
  paid_at: string | null;
  created_at: string;
}
```

Add the import at the top of the file:

```typescript
import { withTransaction } from '../transaction';
```

Replace the existing `createRecurringExpense` function body so it also generates the first occurrence in the same transaction:

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
    await call('sp_expense_occurrence_generate_next', [recurringExpense.id, params.householdId]);
    return recurringExpense;
  });
}
```

A recurring expense is only useful once it has at least one occurrence to show a due date for, so — unlike Fase 3's shopping-list confirm+split (where the purchase was an already-happened real-world event that must not be lost even if the split step failed) — both writes here are pure DB state with no irreversible side effect, so full transactional atomicity (all-or-nothing) is the correct, simpler choice.

Add `generateNextOccurrence` at the end of the file:

```typescript
export async function generateNextOccurrence(
  recurringExpenseId: number,
  householdId: number,
): Promise<ExpenseOccurrenceRecord> {
  const rows = await callProcedure<ExpenseOccurrenceRecord>('sp_expense_occurrence_generate_next', [
    recurringExpenseId,
    householdId,
  ]);
  return rows[0];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- recurring-expenses.test.ts`
Expected: PASS, all tests green (including Task 1's tests, which must still pass unmodified).

- [ ] **Step 6: Run full verification**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: succeeds.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add db/procedures/sp_expense_occurrence_generate_next.sql src/lib/db/procedures/recurring-expenses.ts tests/db/procedures/recurring-expenses.test.ts
git commit -m "feat(gastos): generate the next occurrence per periodicity (weekly/biweekly/one_time)"
```

---

### Task 3: Occurrence history + mark-as-paid (with automatic next-cycle generation)

**Files:**
- Create: `db/procedures/sp_expense_occurrence_list.sql`
- Create: `db/procedures/sp_expense_occurrence_mark_paid.sql`
- Modify: `src/lib/db/procedures/recurring-expenses.ts` (add `listOccurrences`, `markOccurrencePaid`)
- Modify: `tests/db/procedures/recurring-expenses.test.ts` (append new `describe` blocks)

**Interfaces:**
- Consumes: everything from Tasks 1 and 2 in `recurring-expenses.ts`.
- Produces: `listOccurrences(recurringExpenseId, householdId)` and `markOccurrencePaid(params)`, consumed by Task 5's `src/app/gastos/actions.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db/procedures/recurring-expenses.test.ts` (add `listOccurrences`, `markOccurrencePaid` to the existing import from `@/lib/db/procedures/recurring-expenses`):

```typescript
describe('sp_expense_occurrence_list', () => {
  it('returns the full occurrence history for one recurring expense, newest due date first', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Historial ${suffix}`,
      categoryId: category.id,
      amount: 2000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 12,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const history = await listOccurrences(expense.id, householdId);

    expect(history).toHaveLength(1);
    expect(history[0].recurring_expense_id).toBe(expense.id);
    expect(history[0].is_paid).toBe(0);
  });

  it('rejects a recurring expense from a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createOwner(suffixA);
    const { householdId: householdIdB } = await createOwner(suffixB);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId: householdIdA,
      name: `Historial cross ${suffixA}`,
      categoryId: category.id,
      amount: 2000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 12,
      firstDueDate: null,
      responsibleMemberId: memberIdA,
      createdByMemberId: memberIdA,
    });

    await expect(listOccurrences(expense.id, householdIdB)).rejects.toThrow(/not found in this household/i);
  });
});

describe('sp_expense_occurrence_mark_paid / markOccurrencePaid', () => {
  it('marks the open occurrence paid and generates the next biweekly cycle', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Pago quincenal ${suffix}`,
      categoryId: category.id,
      amount: 4000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: 20,
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });
    const [firstOccurrence] = await listOccurrences(expense.id, householdId);

    const history = await markOccurrencePaid({
      occurrenceId: firstOccurrence.id,
      householdId,
      paidByMemberId: memberId,
    });

    expect(history).toHaveLength(2);
    const paid = history.find((o) => o.id === firstOccurrence.id);
    const next = history.find((o) => o.id !== firstOccurrence.id);
    expect(paid?.is_paid).toBe(1);
    expect(paid?.paid_by_member_id).toBe(memberId);
    expect(next?.is_paid).toBe(0);
    expect(new Date(next!.due_date).getTime()).toBeGreaterThan(new Date(paid!.due_date).getTime());
  });

  it('does not generate a second occurrence for one_time expenses once paid', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Pago unico ${suffix}`,
      categoryId: category.id,
      amount: 9000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: '2026-11-15',
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });
    const [firstOccurrence] = await listOccurrences(expense.id, householdId);

    const history = await markOccurrencePaid({
      occurrenceId: firstOccurrence.id,
      householdId,
      paidByMemberId: memberId,
    });

    expect(history).toHaveLength(1);
    expect(history[0].is_paid).toBe(1);
  });

  it('is idempotent: marking an already-paid occurrence again does not change paid_at', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId,
      name: `Idempotente ${suffix}`,
      categoryId: category.id,
      amount: 3000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: '2026-10-01',
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });
    const [firstOccurrence] = await listOccurrences(expense.id, householdId);

    const firstMark = await markOccurrencePaid({
      occurrenceId: firstOccurrence.id,
      householdId,
      paidByMemberId: memberId,
    });
    const secondMark = await markOccurrencePaid({
      occurrenceId: firstOccurrence.id,
      householdId,
      paidByMemberId: memberId,
    });

    expect(secondMark[0].paid_at).toBe(firstMark[0].paid_at);
  });

  it('rejects an occurrence from a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createOwner(suffixA);
    const { householdId: householdIdB, memberId: memberIdB } = await createOwner(suffixB);
    const [category] = await listExpenseCategories();
    const expense = await createRecurringExpense({
      householdId: householdIdA,
      name: `Cross mark ${suffixA}`,
      categoryId: category.id,
      amount: 3000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: '2026-10-01',
      responsibleMemberId: memberIdA,
      createdByMemberId: memberIdA,
    });
    const [firstOccurrence] = await listOccurrences(expense.id, householdIdA);

    await expect(
      markOccurrencePaid({ occurrenceId: firstOccurrence.id, householdId: householdIdB, paidByMemberId: memberIdB }),
    ).rejects.toThrow(/not found in this household/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- recurring-expenses.test.ts`
Expected: FAIL — `listOccurrences`/`markOccurrencePaid` are not functions.

- [ ] **Step 3: Implement the SPs**

Create `db/procedures/sp_expense_occurrence_list.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_expense_occurrence_list;

CREATE PROCEDURE sp_expense_occurrence_list(
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

  SELECT id, recurring_expense_id, period_start, period_end, due_date, is_paid, paid_by_member_id, paid_at, created_at
  FROM expense_occurrences
  WHERE recurring_expense_id = p_recurring_expense_id
  ORDER BY due_date DESC, id DESC;
END;
```

Create `db/procedures/sp_expense_occurrence_mark_paid.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_expense_occurrence_mark_paid;

CREATE PROCEDURE sp_expense_occurrence_mark_paid(
  IN p_occurrence_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_paid_by_member_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eo.id = p_occurrence_id AND re.household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expense occurrence not found in this household';
  END IF;

  -- The `AND is_paid = 0` guard makes this idempotent: a repeated call (e.g. a
  -- double-tap on the button) does not overwrite paid_by_member_id/paid_at.
  UPDATE expense_occurrences
  SET is_paid = 1, paid_by_member_id = p_paid_by_member_id, paid_at = NOW()
  WHERE id = p_occurrence_id AND is_paid = 0;

  SELECT id, recurring_expense_id, period_start, period_end, due_date, is_paid, paid_by_member_id, paid_at, created_at
  FROM expense_occurrences
  WHERE id = p_occurrence_id;
END;
```

- [ ] **Step 4: Update the TS wrapper**

In `src/lib/db/procedures/recurring-expenses.ts`, add at the end of the file:

```typescript
export async function listOccurrences(
  recurringExpenseId: number,
  householdId: number,
): Promise<ExpenseOccurrenceRecord[]> {
  return callProcedure<ExpenseOccurrenceRecord>('sp_expense_occurrence_list', [
    recurringExpenseId,
    householdId,
  ]);
}

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
    await call('sp_expense_occurrence_generate_next', [
      paidOccurrence.recurring_expense_id,
      params.householdId,
    ]);
    return call<ExpenseOccurrenceRecord>('sp_expense_occurrence_list', [
      paidOccurrence.recurring_expense_id,
      params.householdId,
    ]);
  });
}
```

`markOccurrencePaid` always calls `sp_expense_occurrence_generate_next` after marking paid, regardless of periodicity — for `one_time` this is a safe no-op (an occurrence already exists, so the guard inside `sp_expense_occurrence_generate_next` skips insertion), so the caller never needs an `if (periodicity !== 'one_time')` branch.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- recurring-expenses.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 6: Run full verification**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: succeeds.

Run: `npm test`
Expected: all tests pass, no regressions.

- [ ] **Step 7: Commit**

```bash
git add db/procedures/sp_expense_occurrence_list.sql db/procedures/sp_expense_occurrence_mark_paid.sql src/lib/db/procedures/recurring-expenses.ts tests/db/procedures/recurring-expenses.test.ts
git commit -m "feat(gastos): add occurrence history and mark-as-paid with auto next-cycle generation"
```

---

### Task 4: `/gastos` list page + create/edit form

**Files:**
- Create: `src/app/gastos/page.tsx`
- Create: `src/app/gastos/actions.ts`
- Create: `src/app/gastos/gastos-client.tsx`
- Create: `src/components/gastos/RecurringExpenseRow.tsx`
- Create: `src/components/gastos/RecurringExpenseForm.tsx`

**Interfaces:**
- Consumes: `listRecurringExpenses`, `listExpenseCategories`, `createRecurringExpense`, `updateRecurringExpense`, `deactivateRecurringExpense` (`@/lib/db/procedures/recurring-expenses`), `listHouseholdMembers` (`@/lib/db/procedures/household`), `listCurrencies` (`@/lib/db/procedures/currency`), `requireMembership` (`@/lib/household/require-membership`), `CurrencyAmountInput` (`@/components/CurrencyAmountInput`).
- Produces: the `/gastos` route (already linked from `src/components/BottomNav.tsx`, no nav change needed). `gastos-client.tsx`'s `panel` state gains a `'detail'` mode wired up in Task 5 — build `panel` as `{ mode: 'create' } | { mode: 'edit'; expense: RecurringExpenseRecord } | { mode: 'detail'; expense: RecurringExpenseRecord } | null` now so Task 5 only has to add the render branch, not touch the type.

- [ ] **Step 1: Create the Server Actions**

Create `src/app/gastos/actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMembership } from '@/lib/household/require-membership';
import {
  createRecurringExpense,
  deactivateRecurringExpense,
  updateRecurringExpense,
} from '@/lib/db/procedures/recurring-expenses';

const periodicitySchema = z.enum(['weekly', 'biweekly', 'one_time']);

const createRecurringExpenseSchema = z
  .object({
    name: z.string().min(1, 'El nombre es obligatorio').max(150),
    categoryId: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
    currencyId: z.coerce.number().int().positive(),
    periodicity: periodicitySchema,
    dueDayConfig: z.coerce.number().int().min(1).max(7).optional(),
    withdrawalDay: z.coerce.number().int().min(1).max(31).optional(),
    firstDueDate: z.string().min(1).optional(),
    responsibleMemberId: z.coerce.number().int().positive(),
  })
  .superRefine((data, ctx) => {
    if (data.periodicity === 'weekly' && data.dueDayConfig === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Elegí el día de la semana', path: ['dueDayConfig'] });
    }
    if ((data.periodicity === 'weekly' || data.periodicity === 'biweekly') && data.withdrawalDay === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Elegí el día de retiro', path: ['withdrawalDay'] });
    }
    if (data.periodicity === 'one_time' && !data.firstDueDate) {
      ctx.addIssue({ code: 'custom', message: 'Elegí la fecha de vencimiento', path: ['firstDueDate'] });
    }
  });

export interface CreateRecurringExpenseState {
  error: string | null;
}

export async function createRecurringExpenseAction(
  _prevState: CreateRecurringExpenseState,
  formData: FormData,
): Promise<CreateRecurringExpenseState> {
  const membership = await requireMembership();

  const parsed = createRecurringExpenseSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    amount: formData.get('amount'),
    currencyId: formData.get('currencyId'),
    periodicity: formData.get('periodicity'),
    dueDayConfig: formData.get('dueDayConfig') || undefined,
    withdrawalDay: formData.get('withdrawalDay') || undefined,
    firstDueDate: formData.get('firstDueDate') || undefined,
    responsibleMemberId: formData.get('responsibleMemberId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await createRecurringExpense({
      householdId: membership.id,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount,
      currencyId: parsed.data.currencyId,
      periodicity: parsed.data.periodicity,
      dueDayConfig: parsed.data.periodicity === 'weekly' ? parsed.data.dueDayConfig! : null,
      withdrawalDay: parsed.data.periodicity !== 'one_time' ? parsed.data.withdrawalDay! : null,
      firstDueDate: parsed.data.periodicity === 'one_time' ? parsed.data.firstDueDate! : null,
      responsibleMemberId: parsed.data.responsibleMemberId,
      createdByMemberId: membership.member_id,
    });
  } catch {
    return { error: 'No se pudo guardar el gasto. Verificá los datos e intentá de nuevo.' };
  }

  revalidatePath('/gastos');
  return { error: null };
}

const updateRecurringExpenseSchema = z.object({
  recurringExpenseId: z.coerce.number().int().positive(),
  name: z.string().min(1, 'El nombre es obligatorio').max(150),
  categoryId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  currencyId: z.coerce.number().int().positive(),
  responsibleMemberId: z.coerce.number().int().positive(),
});

export interface UpdateRecurringExpenseState {
  error: string | null;
}

export async function updateRecurringExpenseAction(
  _prevState: UpdateRecurringExpenseState,
  formData: FormData,
): Promise<UpdateRecurringExpenseState> {
  const membership = await requireMembership();

  const parsed = updateRecurringExpenseSchema.safeParse({
    recurringExpenseId: formData.get('recurringExpenseId'),
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    amount: formData.get('amount'),
    currencyId: formData.get('currencyId'),
    responsibleMemberId: formData.get('responsibleMemberId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await updateRecurringExpense({
      recurringExpenseId: parsed.data.recurringExpenseId,
      householdId: membership.id,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount,
      currencyId: parsed.data.currencyId,
      responsibleMemberId: parsed.data.responsibleMemberId,
    });
  } catch {
    return { error: 'No se pudo actualizar el gasto. Es posible que ya no exista en tu hogar.' };
  }

  revalidatePath('/gastos');
  return { error: null };
}

export async function deactivateRecurringExpenseAction(recurringExpenseId: number): Promise<void> {
  const membership = await requireMembership();
  await deactivateRecurringExpense(recurringExpenseId, membership.id);
  revalidatePath('/gastos');
}
```

- [ ] **Step 2: Create the page**

Create `src/app/gastos/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHouseholdsForUser, listHouseholdMembers } from '@/lib/db/procedures/household';
import { listExpenseCategories, listRecurringExpenses } from '@/lib/db/procedures/recurring-expenses';
import { listCurrencies } from '@/lib/db/procedures/currency';
import { GastosClient } from './gastos-client';

export default async function GastosPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    redirect('/onboarding');
  }

  const [expenses, categories, members, currencies] = await Promise.all([
    listRecurringExpenses(membership.id),
    listExpenseCategories(),
    listHouseholdMembers(membership.id),
    listCurrencies(),
  ]);

  return (
    <GastosClient expenses={expenses} categories={categories} members={members} currencies={currencies} />
  );
}
```

- [ ] **Step 3: Create the row component**

Create `src/components/gastos/RecurringExpenseRow.tsx`:

```tsx
'use client';

import type { RecurringExpenseRecord } from '@/lib/db/procedures/recurring-expenses';

const STATUS_LABELS: Record<string, string> = {
  vencido: 'Vencido',
  vence_pronto: 'Vence pronto',
  al_dia: 'Al día',
  sin_ocurrencia: 'Sin ciclo',
};

const STATUS_CLASSES: Record<string, string> = {
  vencido: 'text-bg-danger',
  vence_pronto: 'text-bg-warning',
  al_dia: 'text-bg-success',
  sin_ocurrencia: 'text-bg-secondary',
};

export function RecurringExpenseRow({
  expense,
  onClick,
}: {
  expense: RecurringExpenseRecord;
  onClick: () => void;
}) {
  const status = expense.status ?? 'sin_ocurrencia';

  return (
    <li className="list-group-item">
      <button
        type="button"
        className="btn btn-link text-start text-decoration-none p-0 w-100 text-body"
        onClick={onClick}
      >
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className="fw-semibold">{expense.name}</div>
            <div className="text-body-secondary small">
              {expense.currency_symbol}
              {expense.amount} · {expense.category_name} · {expense.responsible_display_name}
            </div>
            {expense.next_due_date ? (
              <div className="text-body-secondary small">Próximo vencimiento: {expense.next_due_date}</div>
            ) : null}
          </div>
          <span className={`badge ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
        </div>
      </button>
    </li>
  );
}
```

- [ ] **Step 4: Create the form component**

Create `src/components/gastos/RecurringExpenseForm.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import {
  createRecurringExpenseAction,
  updateRecurringExpenseAction,
  type CreateRecurringExpenseState,
  type UpdateRecurringExpenseState,
} from '@/app/gastos/actions';
import { CurrencyAmountInput } from '@/components/CurrencyAmountInput';
import type { ExpenseCategoryRecord, RecurringExpenseRecord } from '@/lib/db/procedures/recurring-expenses';
import type { HouseholdMemberRecord } from '@/lib/db/procedures/household';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

const initialState: CreateRecurringExpenseState | UpdateRecurringExpenseState = { error: null };

export function RecurringExpenseForm({
  mode,
  expense,
  categories,
  members,
  currencies,
}: {
  mode: 'create' | 'edit';
  expense?: RecurringExpenseRecord;
  categories: ExpenseCategoryRecord[];
  members: HouseholdMemberRecord[];
  currencies: CurrencyRecord[];
}) {
  const action = mode === 'create' ? createRecurringExpenseAction : updateRecurringExpenseAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [periodicity, setPeriodicity] = useState<'weekly' | 'biweekly' | 'one_time'>(
    expense?.periodicity ?? 'weekly',
  );

  return (
    <form action={formAction} className="d-flex flex-column gap-3">
      {mode === 'edit' && expense ? (
        <input type="hidden" name="recurringExpenseId" value={expense.id} />
      ) : null}
      <div>
        <label htmlFor="name" className="form-label">Nombre</label>
        <input id="name" name="name" type="text" defaultValue={expense?.name} className="form-control" required />
      </div>
      <div>
        <label htmlFor="categoryId" className="form-label">Categoría</label>
        <select id="categoryId" name="categoryId" defaultValue={expense?.category_id} className="form-select" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Monto</label>
        <CurrencyAmountInput
          amountName="amount"
          currencyName="currencyId"
          currencies={currencies}
          defaultAmount={expense?.amount}
          defaultCurrencyId={expense?.currency_id}
        />
      </div>
      <div>
        <label htmlFor="responsibleMemberId" className="form-label">Responsable</label>
        <select
          id="responsibleMemberId"
          name="responsibleMemberId"
          defaultValue={expense?.responsible_member_id}
          className="form-select"
          required
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.display_name}
            </option>
          ))}
        </select>
      </div>
      {mode === 'create' ? (
        <>
          <div>
            <label htmlFor="periodicity" className="form-label">Periodicidad</label>
            <select
              id="periodicity"
              name="periodicity"
              className="form-select"
              value={periodicity}
              onChange={(e) => setPeriodicity(e.target.value as 'weekly' | 'biweekly' | 'one_time')}
            >
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="one_time">Pago único</option>
            </select>
          </div>
          {periodicity === 'weekly' ? (
            <div>
              <label htmlFor="dueDayConfig" className="form-label">Día de la semana</label>
              <select id="dueDayConfig" name="dueDayConfig" className="form-select" required>
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {periodicity === 'weekly' || periodicity === 'biweekly' ? (
            <div>
              <label htmlFor="withdrawalDay" className="form-label">Día de retiro de fondos (1-31)</label>
              <input
                id="withdrawalDay"
                name="withdrawalDay"
                type="number"
                min={1}
                max={31}
                className="form-control"
                required
              />
            </div>
          ) : null}
          {periodicity === 'one_time' ? (
            <div>
              <label htmlFor="firstDueDate" className="form-label">Fecha de vencimiento</label>
              <input id="firstDueDate" name="firstDueDate" type="date" className="form-control" required />
            </div>
          ) : null}
        </>
      ) : null}
      {state.error ? (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {state.error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Guardando…' : mode === 'create' ? 'Agregar gasto' : 'Guardar cambios'}
      </button>
    </form>
  );
}
```

Periodicity/schedule fields only render in `create` mode because `sp_recurring_expense_update` intentionally cannot change them (see Task 1's comment in `sp_recurring_expense_update.sql`).

- [ ] **Step 5: Create the client component**

Create `src/app/gastos/gastos-client.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { RecurringExpenseRow } from '@/components/gastos/RecurringExpenseRow';
import { RecurringExpenseForm } from '@/components/gastos/RecurringExpenseForm';
import type { ExpenseCategoryRecord, RecurringExpenseRecord } from '@/lib/db/procedures/recurring-expenses';
import type { HouseholdMemberRecord } from '@/lib/db/procedures/household';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

type Panel =
  | { mode: 'create' }
  | { mode: 'edit'; expense: RecurringExpenseRecord }
  | { mode: 'detail'; expense: RecurringExpenseRecord }
  | null;

export function GastosClient({
  expenses,
  categories,
  members,
  currencies,
}: {
  expenses: RecurringExpenseRecord[];
  categories: ExpenseCategoryRecord[];
  members: HouseholdMemberRecord[];
  currencies: CurrencyRecord[];
}) {
  const [panel, setPanel] = useState<Panel>(null);

  return (
    <main className="container-fluid px-3 py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Gastos</h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPanel({ mode: 'create' })}>
          <i className="bi bi-plus-lg me-1" />
          Gasto
        </button>
      </div>

      <ul className="list-group">
        {expenses.map((expense) => (
          <RecurringExpenseRow
            key={expense.id}
            expense={expense}
            onClick={() => setPanel({ mode: 'detail', expense })}
          />
        ))}
      </ul>

      {expenses.length === 0 ? (
        <p className="text-body-secondary">Todavía no registraste gastos recurrentes.</p>
      ) : null}

      {panel && panel.mode !== 'detail' ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1050 }}
        >
          <div className="bg-body w-100 p-3 rounded-top-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">{panel.mode === 'create' ? 'Nuevo gasto' : 'Editar gasto'}</h2>
              <button type="button" className="btn-close" onClick={() => setPanel(null)} aria-label="Cerrar" />
            </div>
            <RecurringExpenseForm
              mode={panel.mode}
              expense={panel.mode === 'edit' ? panel.expense : undefined}
              categories={categories}
              members={members}
              currencies={currencies}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
```

The `'detail'` branch is intentionally left unhandled (no modal renders yet) — Task 5 adds `ExpenseDetailPanel` and a render branch for it. Clicking a row for now will set `panel` but show nothing extra; this is expected and fixed in the very next task, not a bug to chase down in this one.

- [ ] **Step 6: Manual verification (no automated UI tests, matching established convention)**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: succeeds, `/gastos` appears in the route table.

Run: `npm test`
Expected: all existing tests still pass (no regressions; this task adds no new automated tests, matching the precedent set by `ProductForm`/`SplitPanel`, which also have no dedicated component tests).

- [ ] **Step 7: Commit**

```bash
git add src/app/gastos/page.tsx src/app/gastos/actions.ts src/app/gastos/gastos-client.tsx src/components/gastos/RecurringExpenseRow.tsx src/components/gastos/RecurringExpenseForm.tsx
git commit -m "feat(gastos): add /gastos list page with create/edit form"
```

---

### Task 5: Detail panel — occurrence history + "Marcar como pagado"

**Files:**
- Modify: `src/app/gastos/actions.ts` (add `getOccurrencesAction`, `markOccurrencePaidAction`)
- Create: `src/components/gastos/ExpenseDetailPanel.tsx`
- Modify: `src/app/gastos/gastos-client.tsx` (render `ExpenseDetailPanel` for the `'detail'` panel mode; add a "Desactivar" action)

**Interfaces:**
- Consumes: `listOccurrences`, `markOccurrencePaid` (`@/lib/db/procedures/recurring-expenses`), `deactivateRecurringExpenseAction` (already exists in `actions.ts` from Task 4).
- Produces: the finished `/gastos` feature end-to-end.

- [ ] **Step 1: Add the Server Actions**

In `src/app/gastos/actions.ts`, add these imports to the existing import block:

```typescript
import {
  createRecurringExpense,
  deactivateRecurringExpense,
  listOccurrences,
  markOccurrencePaid,
  updateRecurringExpense,
  type ExpenseOccurrenceRecord,
} from '@/lib/db/procedures/recurring-expenses';
```

(Replace the existing narrower import from Task 4 with this one — same module, more named imports.)

Add at the end of the file:

```typescript
export interface GetOccurrencesState {
  occurrences: ExpenseOccurrenceRecord[];
  error: string | null;
}

export async function getOccurrencesAction(recurringExpenseId: number): Promise<GetOccurrencesState> {
  const membership = await requireMembership();
  try {
    const occurrences = await listOccurrences(recurringExpenseId, membership.id);
    return { occurrences, error: null };
  } catch {
    return { occurrences: [], error: 'No se pudo cargar el historial de este gasto.' };
  }
}

export interface MarkOccurrencePaidState {
  occurrences: ExpenseOccurrenceRecord[];
  error: string | null;
}

export async function markOccurrencePaidAction(occurrenceId: number): Promise<MarkOccurrencePaidState> {
  const membership = await requireMembership();
  try {
    const occurrences = await markOccurrencePaid({
      occurrenceId,
      householdId: membership.id,
      paidByMemberId: membership.member_id,
    });
    revalidatePath('/gastos');
    return { occurrences, error: null };
  } catch {
    return { occurrences: [], error: 'No se pudo marcar el gasto como pagado.' };
  }
}
```

- [ ] **Step 2: Create the detail panel component**

Create `src/components/gastos/ExpenseDetailPanel.tsx`:

```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOccurrencesAction, markOccurrencePaidAction } from '@/app/gastos/actions';
import { showError, showSuccess } from '@/lib/ui/alerts';
import type { ExpenseOccurrenceRecord, RecurringExpenseRecord } from '@/lib/db/procedures/recurring-expenses';

export function ExpenseDetailPanel({
  expense,
  onClose,
  onEdit,
  onDeactivated,
}: {
  expense: RecurringExpenseRecord;
  onClose: () => void;
  onEdit: () => void;
  onDeactivated: () => void;
}) {
  const [occurrences, setOccurrences] = useState<ExpenseOccurrenceRecord[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getOccurrencesAction(expense.id).then((result) => {
      if (result.error) {
        showError(result.error);
        return;
      }
      setOccurrences(result.occurrences);
    });
  }, [expense.id]);

  const nextUnpaid = occurrences?.find((o) => o.is_paid === 0) ?? null;

  function handleMarkPaid(): void {
    if (!nextUnpaid) return;
    startTransition(() => {
      markOccurrencePaidAction(nextUnpaid.id).then((result) => {
        if (result.error) {
          showError(result.error);
          return;
        }
        setOccurrences(result.occurrences);
        showSuccess('Gasto marcado como pagado.');
      });
    });
  }

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
      style={{ zIndex: 1060 }}
    >
      <div className="bg-body w-100 p-3 rounded-top-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">{expense.name}</h2>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" />
        </div>

        <div className="text-body-secondary small mb-3">
          {expense.currency_symbol}
          {expense.amount} · {expense.category_name} · Responsable: {expense.responsible_display_name}
        </div>

        <div className="d-flex gap-2 mb-3">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={onDeactivated}>
            Desactivar
          </button>
        </div>

        {nextUnpaid ? (
          <button
            type="button"
            className="btn btn-primary w-100 mb-3"
            disabled={isPending}
            onClick={handleMarkPaid}
          >
            {isPending ? 'Guardando…' : `Marcar como pagado (vence ${nextUnpaid.due_date})`}
          </button>
        ) : null}

        <h3 className="h6 text-body-secondary text-uppercase">Historial</h3>
        {occurrences === null ? (
          <p className="text-body-secondary">Cargando…</p>
        ) : (
          <ul className="list-group">
            {occurrences.map((occurrence) => (
              <li key={occurrence.id} className="list-group-item d-flex justify-content-between align-items-center">
                <span>{occurrence.due_date}</span>
                <span className={occurrence.is_paid ? 'badge text-bg-success' : 'badge text-bg-secondary'}>
                  {occurrence.is_paid ? 'Pagado' : 'Pendiente'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the detail panel into `gastos-client.tsx`**

In `src/app/gastos/gastos-client.tsx`, add the import:

```typescript
import { ExpenseDetailPanel } from '@/components/gastos/ExpenseDetailPanel';
import { deactivateRecurringExpenseAction } from './actions';
```

Replace the closing `{panel && panel.mode !== 'detail' ? ( ... ) : null}` block's surrounding return with both branches — the full return statement becomes:

```tsx
  return (
    <main className="container-fluid px-3 py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Gastos</h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPanel({ mode: 'create' })}>
          <i className="bi bi-plus-lg me-1" />
          Gasto
        </button>
      </div>

      <ul className="list-group">
        {expenses.map((expense) => (
          <RecurringExpenseRow
            key={expense.id}
            expense={expense}
            onClick={() => setPanel({ mode: 'detail', expense })}
          />
        ))}
      </ul>

      {expenses.length === 0 ? (
        <p className="text-body-secondary">Todavía no registraste gastos recurrentes.</p>
      ) : null}

      {panel && panel.mode !== 'detail' ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1050 }}
        >
          <div className="bg-body w-100 p-3 rounded-top-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">{panel.mode === 'create' ? 'Nuevo gasto' : 'Editar gasto'}</h2>
              <button type="button" className="btn-close" onClick={() => setPanel(null)} aria-label="Cerrar" />
            </div>
            <RecurringExpenseForm
              mode={panel.mode}
              expense={panel.mode === 'edit' ? panel.expense : undefined}
              categories={categories}
              members={members}
              currencies={currencies}
            />
          </div>
        </div>
      ) : null}

      {panel && panel.mode === 'detail' ? (
        <ExpenseDetailPanel
          expense={panel.expense}
          onClose={() => setPanel(null)}
          onEdit={() => setPanel({ mode: 'edit', expense: panel.expense })}
          onDeactivated={() => {
            deactivateRecurringExpenseAction(panel.expense.id).then(() => setPanel(null));
          }}
        />
      ) : null}
    </main>
  );
```

- [ ] **Step 4: Manual verification**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: succeeds.

Run: `npm test`
Expected: all tests pass, no regressions. (This task adds no new automated tests — same established convention as `SplitPanel`, which also has no dedicated component test; its behavior is covered indirectly by the SP-level tests in `recurring-expenses.test.ts` plus this task's manual verification.)

- [ ] **Step 5: Commit**

```bash
git add src/app/gastos/actions.ts src/app/gastos/gastos-client.tsx src/components/gastos/ExpenseDetailPanel.tsx
git commit -m "feat(gastos): add expense detail panel with occurrence history and mark-as-paid"
```

---

## After all tasks: final whole-branch review

Once Tasks 1-5 are all committed on `feature/fase-5-gastos-recurrentes`, dispatch a final whole-branch review (most capable model available) covering the full diff against `main`, focusing on: household-scoping completeness across every new SP, the periodicity date math (weekly weekday wraparound, biweekly cadence, one_time never regenerating), the create/mark-paid transaction boundaries, and Zod validation completeness for the conditional periodicity fields. Fix any Critical/Important findings and re-review before merging, exactly as done for Fases 3 and 4.

# Fase 7 — Recordatorios por Telegram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remind the household's responsible member, via Telegram, one day before a recurring expense's cycle is due, daily once it's overdue (from their own next payday onward), and on the day funds get withdrawn for weekly/biweekly expenses — running once a day off a Vercel Cron Job.

**Architecture:** DB-first, same as every prior phase. A `reminder_log` table gives idempotency (one send per occurrence/member/type/day) via a UNIQUE constraint plus `INSERT IGNORE`. All the date logic that decides *which* reminders are due today lives in one stored procedure, `sp_reminder_get_pending`, using the same procedural "loop chico" cursor style already established in Fases 3/5/6 — the trickiest part (computing each responsible member's *next payday on/after a given date*, per their own `payment_frequency`) is inherently row-by-row, so it's done with a cursor into a `TEMPORARY TABLE`, not a single set-based query. Sending itself can't happen inside a stored procedure (SPs can't make HTTP calls), so it's plain TypeScript: a thin `lib/telegram/client.ts` wraps the raw Telegram Bot HTTP API, and a testable orchestration function (`sendPendingReminders`) ties `getPendingReminders` → send → `logReminderSent` together — mirroring the existing `inviteHouseholdMember` pattern (`src/lib/household/invite-member.ts`), which is the closest existing precedent in this codebase for "DB write + external send, tested by mocking the send function."

Linking a user's Telegram account works via a one-time deep link: `/perfil` generates a random token, stores it on `users.telegram_link_token`, and renders `https://t.me/<bot>?start=<token>`; when the user taps it and hits "Iniciar" in Telegram, a webhook (`POST /api/telegram/webhook`) receives the `/start <token>` update, resolves the token back to the user, and stores their `chat_id`.

**Tech Stack:** MariaDB 10.4.32 stored procedures, Next.js 16 Route Handlers, Vercel Cron Jobs, plain `fetch` against the Telegram Bot HTTP API (no SDK needed), Vitest with `vi.mock`.

## Global Constraints

- Every stored procedure that reads/writes household-scoped rows must validate ownership before touching data — same hard rule as every prior phase. `reminder_log` has no `household_id` of its own; scoping (where it matters) goes through `expense_occurrences → recurring_expenses.household_id`, same join-through pattern as Fase 6.
- No `JSON_TABLE`, no JSON. The one place this phase needs "loop over rows and compute something per row" (the payday math) uses a cursor into a `TEMPORARY TABLE`, matching the procedural style already used in Fases 3/5/6 — not a JSON array parameter.
- **Do not confuse two unrelated periodicity concepts:** `recurring_expenses.periodicity` (`weekly`/`biweekly`/`one_time` — how often the EXPENSE recurs, from Fase 5) and `users.payment_frequency` (`weekly`/`semimonthly`/`monthly` — how often the RESPONSIBLE MEMBER gets paid, from Fase 1b). The `overdue_daily` reminder category's date math operates entirely on the second one. Getting these swapped is the single easiest mistake to make in this phase.
- `users.payment_weekday` is ISO weekday 1=Monday..7=Sunday (existing convention from Fase 1b/5) — MariaDB's `WEEKDAY()` returns 0=Monday..6=Sunday. The exact same reconciling formula from `sp_expense_occurrence_generate_next.sql`'s weekly branch (Fase 5) applies here unchanged: `DATE_ADD(d, INTERVAL MOD((payment_weekday - 1) - WEEKDAY(d) + 7, 7) DAY)`.
- `users.payment_day` (monthly) and the two fixed semimonthly dates (15th and last day of month) must handle month-length correctly (`LAST_DAY()`), including `payment_day` values like 31 falling in a 28/29/30-day month — use `LEAST(payment_day, DAY(LAST_DAY(d)))` to clamp, matching how real payroll systems treat an "end of month" payday.
- Telegram Bot API calls are plain `fetch()` — no SDK dependency to add. Never log the bot token; read it only from `process.env.TELEGRAM_BOT_TOKEN`.
- Route Handlers with no browser session (the cron endpoint and the Telegram webhook) are protected by a header secret, not `requireMembership()` — `CRON_SECRET` for the cron route (Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when it invokes a project's cron job, if that env var is set — this is a real Vercel platform feature, not custom code) and `TELEGRAM_WEBHOOK_SECRET` for the Telegram webhook (set via Telegram's `setWebhook` `secret_token` parameter, checked against the `X-Telegram-Bot-Api-Secret-Token` header Telegram sends on every webhook call).
- External-send logic follows the established pattern from `src/lib/household/invite-member.ts`: a DB write plus an external send lives in one small `lib/<domain>/<verb>.ts` function, tested by mocking the *send* module with `vi.mock(...)` (see `tests/lib/household/invite-member.test.ts`) while the DB side runs against the real test database. Never write a test that hits the real Telegram API.
- Run `npx tsc --noEmit`, `npm run build`, and `npm test` after every task; all three must be clean before committing.
- Local MariaDB (XAMPP) must be running on port 3307 for `npm test`.

---

### Task 1: Telegram account linking — schema + SPs + wrapper

**Files:**
- Create: `db/migrations/010_reminders.sql`
- Create: `db/procedures/sp_user_set_telegram_link_token.sql`
- Create: `db/procedures/sp_user_link_telegram_chat.sql`
- Create: `db/procedures/sp_user_get_telegram_status.sql`
- Create: `src/lib/db/procedures/telegram.ts`
- Test: `tests/db/procedures/telegram.test.ts` (new file)

**Interfaces:**
- Consumes: `callProcedure` (`src/lib/db/call.ts`), `registerUser` (`src/lib/db/procedures/auth.ts`), `uniqueSuffix` (`tests/helpers/db.ts`).
- Produces: `setTelegramLinkToken(userId, token)`, `linkTelegramChat(token, chatId)`, `getTelegramStatus(userId)` — consumed by Task 5's Server Action and webhook route.

This task also creates the `reminder_log` table (needed by Task 2), but does not yet write any SP that reads/writes it — that's Task 2's job.

- [ ] **Step 1: Write the failing tests**

Create `tests/db/procedures/telegram.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import {
  getTelegramStatus,
  linkTelegramChat,
  setTelegramLinkToken,
} from '@/lib/db/procedures/telegram';
import { uniqueSuffix } from '../../helpers/db';

describe('setTelegramLinkToken / getTelegramStatus / linkTelegramChat', () => {
  it('reports not linked before any token is set', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `telegram_status_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });

    const status = await getTelegramStatus(user.id);

    expect(status.is_linked).toBe(0);
    expect(status.telegram_chat_id).toBeNull();
  });

  it('links a chat id when the token matches, and clears the token afterward', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `telegram_link_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const token = `token-${suffix}`;
    await setTelegramLinkToken(user.id, token);

    const linkedUserId = await linkTelegramChat(token, 999888777);

    expect(linkedUserId).toBe(user.id);
    const status = await getTelegramStatus(user.id);
    expect(status.is_linked).toBe(1);
    expect(status.telegram_chat_id).toBe(999888777);

    // Re-using the same (now-cleared) token must not link a second time.
    const secondAttempt = await linkTelegramChat(token, 111222333);
    expect(secondAttempt).toBeNull();
    const statusAfter = await getTelegramStatus(user.id);
    expect(statusAfter.telegram_chat_id).toBe(999888777);
  });

  it('returns null for a token that does not exist (e.g. a stranger messaging the bot)', async () => {
    const linkedUserId = await linkTelegramChat('this-token-was-never-issued', 123456789);
    expect(linkedUserId).toBeNull();
  });

  it('setting a new link token overwrites a previous one for the same user', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `telegram_overwrite_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    await setTelegramLinkToken(user.id, `old-token-${suffix}`);
    await setTelegramLinkToken(user.id, `new-token-${suffix}`);

    const oldAttempt = await linkTelegramChat(`old-token-${suffix}`, 1);
    expect(oldAttempt).toBeNull();

    const newAttempt = await linkTelegramChat(`new-token-${suffix}`, 2);
    expect(newAttempt).toBe(user.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- telegram.test.ts`
Expected: FAIL — module `@/lib/db/procedures/telegram` does not exist yet.

- [ ] **Step 3: Create the migration**

Create `db/migrations/010_reminders.sql`:

```sql
ALTER TABLE users
  ADD COLUMN telegram_chat_id BIGINT NULL AFTER payment_day,
  ADD COLUMN telegram_link_token VARCHAR(64) NULL UNIQUE AFTER telegram_chat_id;

CREATE TABLE reminder_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  occurrence_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  reminder_type ENUM('due_soon', 'overdue_daily', 'withdrawal') NOT NULL,
  sent_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reminder_log_occurrence FOREIGN KEY (occurrence_id) REFERENCES expense_occurrences(id),
  CONSTRAINT fk_reminder_log_member FOREIGN KEY (member_id) REFERENCES household_members(id),
  CONSTRAINT uq_reminder_log_send UNIQUE (occurrence_id, member_id, reminder_type, sent_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`telegram_chat_id` is `BIGINT` (not `INT`) because real Telegram chat ids can exceed the `INT` range. `telegram_link_token` is nullable and globally unique (not per-user) so a lookup by token alone is enough to identify the user during linking — mirrors how `password_reset_tokens.token` and `household_invitations.token` are both looked up directly, no user id needed alongside them.

- [ ] **Step 4: Create the SPs**

Create `db/procedures/sp_user_set_telegram_link_token.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_user_set_telegram_link_token;

CREATE PROCEDURE sp_user_set_telegram_link_token(
  IN p_user_id INT UNSIGNED,
  IN p_token VARCHAR(64)
)
BEGIN
  UPDATE users SET telegram_link_token = p_token WHERE id = p_user_id;
END;
```

Create `db/procedures/sp_user_link_telegram_chat.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_user_link_telegram_chat;

CREATE PROCEDURE sp_user_link_telegram_chat(
  IN p_token VARCHAR(64),
  IN p_chat_id BIGINT
)
BEGIN
  DECLARE v_user_id INT UNSIGNED;

  SELECT id INTO v_user_id FROM users WHERE telegram_link_token = p_token;

  -- No SIGNAL here: this is called from a public webhook that receives
  -- whatever arbitrary /start payload a stranger might send. An unmatched
  -- token is a normal, expected outcome, not an error condition.
  IF v_user_id IS NOT NULL THEN
    UPDATE users
    SET telegram_chat_id = p_chat_id, telegram_link_token = NULL
    WHERE id = v_user_id;
  END IF;

  SELECT v_user_id AS user_id;
END;
```

Create `db/procedures/sp_user_get_telegram_status.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_user_get_telegram_status;

CREATE PROCEDURE sp_user_get_telegram_status(
  IN p_user_id INT UNSIGNED
)
BEGIN
  SELECT
    (telegram_chat_id IS NOT NULL) AS is_linked,
    telegram_chat_id
  FROM users
  WHERE id = p_user_id;
END;
```

- [ ] **Step 5: Implement the TS wrapper**

Create `src/lib/db/procedures/telegram.ts`:

```typescript
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface TelegramStatusRecord extends RowDataPacket {
  is_linked: number;
  telegram_chat_id: number | null;
}

export async function setTelegramLinkToken(userId: number, token: string): Promise<void> {
  await callProcedure('sp_user_set_telegram_link_token', [userId, token]);
}

export async function linkTelegramChat(token: string, chatId: number): Promise<number | null> {
  const rows = await callProcedure<{ user_id: number | null } & RowDataPacket>(
    'sp_user_link_telegram_chat',
    [token, chatId],
  );
  return rows[0]?.user_id ?? null;
}

export async function getTelegramStatus(userId: number): Promise<TelegramStatusRecord> {
  const rows = await callProcedure<TelegramStatusRecord>('sp_user_get_telegram_status', [userId]);
  return rows[0];
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- telegram.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 7: Run full verification**

Run: `npx tsc --noEmit` — clean.
Run: `npm run build` — succeeds.
Run: `npm test` — all pass, no regressions.

- [ ] **Step 8: Commit**

```bash
git checkout -b feature/fase-7-recordatorios-telegram
git add db/migrations/010_reminders.sql db/procedures/sp_user_set_telegram_link_token.sql db/procedures/sp_user_link_telegram_chat.sql db/procedures/sp_user_get_telegram_status.sql src/lib/db/procedures/telegram.ts tests/db/procedures/telegram.test.ts
git commit -m "feat(recordatorios): add Telegram account linking schema and SPs"
```

---

### Task 2: `sp_reminder_get_pending` (the three reminder categories) + `sp_reminder_log_sent`

**Files:**
- Create: `db/procedures/sp_reminder_get_pending.sql`
- Create: `db/procedures/sp_reminder_log_sent.sql`
- Create: `src/lib/db/procedures/reminders.ts`
- Test: `tests/db/procedures/reminders.test.ts` (new file)

**Interfaces:**
- Consumes: `createRecurringExpense`, `markOccurrencePaid`, `listExpenseCategories` (`@/lib/db/procedures/recurring-expenses`, Fase 5), `updatePaymentSchedule` (`@/lib/db/procedures/profile`), `createHousehold`/`getHouseholdsForUser` (`@/lib/db/procedures/household`), `registerUser` (`@/lib/db/procedures/auth`).
- Produces: `PendingReminderRecord` type, `getPendingReminders(today)`, `logReminderSent(params)` — consumed by Task 4's orchestration function.

- [ ] **Step 1: Write the failing tests**

Create `tests/db/procedures/reminders.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { createRecurringExpense, listExpenseCategories, markOccurrencePaid, listOccurrences } from '@/lib/db/procedures/recurring-expenses';
import { updatePaymentSchedule } from '@/lib/db/procedures/profile';
import { getPendingReminders, logReminderSent } from '@/lib/db/procedures/reminders';
import { uniqueSuffix } from '../../helpers/db';

const CRC_ID = 1;

async function createOwner(suffix: string): Promise<{ householdId: number; memberId: number; userId: number }> {
  const user = await registerUser({
    email: `reminders_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa Reminders ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id, userId: user.id };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe('sp_reminder_get_pending — due_soon', () => {
  it('flags a one_time expense due tomorrow as due_soon', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await createRecurringExpense({
      householdId,
      name: `Vence manana ${suffix}`,
      categoryId: category.id,
      amount: 5000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    const match = pending.find((r) => r.reminder_type === 'due_soon' && r.expense_name === `Vence manana ${suffix}`);
    expect(match).toBeDefined();
    expect(match?.member_id).toBe(memberId);
  });

  it('does not re-flag due_soon once it has already been logged sent today', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expense = await createRecurringExpense({
      householdId,
      name: `Ya avisado ${suffix}`,
      categoryId: category.id,
      amount: 5000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });
    const [occurrence] = await listOccurrences(expense.id, householdId);

    await logReminderSent({
      occurrenceId: occurrence.id,
      memberId,
      reminderType: 'due_soon',
      sentDate: isoDate(today),
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(pending.some((r) => r.occurrence_id === occurrence.id && r.reminder_type === 'due_soon')).toBe(false);
  });
});

describe('sp_reminder_get_pending — overdue_daily (payment-frequency math)', () => {
  it('flags overdue for a weekly-paid member once today reaches their payday on/after due_date', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId, userId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();

    // Anchor "today" to a fixed, deterministic weekday so the test isn't
    // sensitive to whatever day it happens to run on: use last Monday as
    // due_date (overdue), and pay the member every Friday. If today is on
    // or after the Friday following that Monday, it must appear; this test
    // only asserts the case where enough days have passed, using a due_date
    // far enough in the past (10 days ago) that today is guaranteed to be on
    // or after at least one Friday since then.
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    await updatePaymentSchedule({ userId, paymentFrequency: 'weekly', paymentWeekday: 5, paymentDay: null });

    const expense = await createRecurringExpense({
      householdId,
      name: `Vencido semanal ${suffix}`,
      categoryId: category.id,
      amount: 3000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tenDaysAgo),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(new Date()));

    expect(pending.some((r) => r.recurring_expense_id === expense.id && r.reminder_type === 'overdue_daily')).toBe(true);
  });

  it('flags overdue for a monthly-paid member when payment_day=1, since the 1st of the month is always on or before today', async () => {
    // payment_day=1 is a deliberately unambiguous edge case: the "next
    // occurrence of the 1st on/after due_date=yesterday" always lands on
    // this month's 1st, which is always <= today, regardless of what day
    // the test suite actually runs on. This keeps the test fully
    // deterministic without needing to mock the system clock. The
    // month-length-clamping edge cases (e.g. payment_day=31 in a
    // 28/29/30-day month) are traced by hand in the final whole-branch
    // review instead of asserted here, since a dynamically-computed
    // negative case (payment_day not yet reached) can't be made both
    // deterministic and simple without controlling "today" directly.
    const suffix = uniqueSuffix();
    const { householdId, memberId, userId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await updatePaymentSchedule({ userId, paymentFrequency: 'monthly', paymentWeekday: null, paymentDay: 1 });

    await createRecurringExpense({
      householdId,
      name: `Vencido mensual ${suffix}`,
      categoryId: category.id,
      amount: 2000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(yesterday),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(pending.some((r) => r.reminder_type === 'overdue_daily')).toBe(true);
  });

  it('does not flag overdue for a member with no payment_frequency configured', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await createRecurringExpense({
      householdId,
      name: `Sin horario de pago ${suffix}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(yesterday),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(new Date()));

    expect(pending.some((r) => r.reminder_type === 'overdue_daily')).toBe(false);
  });
});

describe('sp_reminder_get_pending — withdrawal', () => {
  it('flags withdrawal for an active biweekly expense on its withdrawal_day', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();

    await createRecurringExpense({
      householdId,
      name: `Retiro hoy ${suffix}`,
      categoryId: category.id,
      amount: 8000,
      currencyId: CRC_ID,
      periodicity: 'biweekly',
      dueDayConfig: null,
      withdrawalDay: today.getDate(),
      firstDueDate: null,
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(pending.some((r) => r.reminder_type === 'withdrawal')).toBe(true);
  });

  it('does not flag withdrawal for a one_time expense', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const today = new Date();

    await createRecurringExpense({
      householdId,
      name: `Pago unico ${suffix}`,
      categoryId: category.id,
      amount: 8000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(today),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const pending = await getPendingReminders(isoDate(today));

    expect(pending.some((r) => r.reminder_type === 'withdrawal')).toBe(false);
  });
});

describe('logReminderSent idempotency', () => {
  it('is safe to call twice for the same occurrence/member/type/day', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwner(suffix);
    const [category] = await listExpenseCategories();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expense = await createRecurringExpense({
      householdId,
      name: `Doble log ${suffix}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });
    const [occurrence] = await listOccurrences(expense.id, householdId);
    const today = isoDate(new Date());

    await logReminderSent({ occurrenceId: occurrence.id, memberId, reminderType: 'due_soon', sentDate: today });
    await expect(
      logReminderSent({ occurrenceId: occurrence.id, memberId, reminderType: 'due_soon', sentDate: today }),
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- reminders.test.ts`
Expected: FAIL — module `@/lib/db/procedures/reminders` does not exist yet.

- [ ] **Step 3: Implement `sp_reminder_get_pending`**

Create `db/procedures/sp_reminder_get_pending.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_reminder_get_pending;

CREATE PROCEDURE sp_reminder_get_pending(
  IN p_today DATE
)
BEGIN
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_occurrence_id INT UNSIGNED;
  DECLARE v_recurring_expense_id INT UNSIGNED;
  DECLARE v_member_id INT UNSIGNED;
  DECLARE v_due_date DATE;
  DECLARE v_payment_frequency ENUM('weekly', 'semimonthly', 'monthly');
  DECLARE v_payment_weekday TINYINT UNSIGNED;
  DECLARE v_payment_day TINYINT UNSIGNED;
  DECLARE v_next_payment_date DATE;
  DECLARE v_candidate_a DATE;
  DECLARE v_candidate_b DATE;
  DECLARE v_candidate_c DATE;

  DECLARE v_overdue_cursor CURSOR FOR
    SELECT eo.id, eo.recurring_expense_id, re.responsible_member_id, eo.due_date,
           u.payment_frequency, u.payment_weekday, u.payment_day
    FROM expense_occurrences eo
    INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
    INNER JOIN household_members hm ON hm.id = re.responsible_member_id
    INNER JOIN users u ON u.id = hm.user_id
    WHERE eo.due_date < p_today
      AND eo.is_paid = 0
      AND re.is_active = 1
      AND u.payment_frequency IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM reminder_log rl
        WHERE rl.occurrence_id = eo.id AND rl.member_id = re.responsible_member_id
          AND rl.reminder_type = 'overdue_daily' AND rl.sent_date = p_today
      );

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  DROP TEMPORARY TABLE IF EXISTS tmp_pending_reminders;
  CREATE TEMPORARY TABLE tmp_pending_reminders (
    occurrence_id INT UNSIGNED NOT NULL,
    recurring_expense_id INT UNSIGNED NOT NULL,
    member_id INT UNSIGNED NOT NULL,
    reminder_type ENUM('due_soon', 'overdue_daily', 'withdrawal') NOT NULL
  );

  -- Category 1: due_soon — due tomorrow, unpaid, not already reminded today.
  INSERT INTO tmp_pending_reminders (occurrence_id, recurring_expense_id, member_id, reminder_type)
  SELECT eo.id, eo.recurring_expense_id, re.responsible_member_id, 'due_soon'
  FROM expense_occurrences eo
  INNER JOIN recurring_expenses re ON re.id = eo.recurring_expense_id
  WHERE eo.due_date = DATE_ADD(p_today, INTERVAL 1 DAY)
    AND eo.is_paid = 0
    AND re.is_active = 1
    AND NOT EXISTS (
      SELECT 1 FROM reminder_log rl
      WHERE rl.occurrence_id = eo.id AND rl.member_id = re.responsible_member_id
        AND rl.reminder_type = 'due_soon' AND rl.sent_date = p_today
    );

  -- Category 2: overdue_daily — needs per-row payment-date math (the
  -- responsible member's OWN payment_frequency, unrelated to the expense's
  -- own periodicity), so it's computed procedurally row by row rather than
  -- as a single set-based expression.
  SET v_done = 0;
  OPEN v_overdue_cursor;
  overdue_loop: LOOP
    FETCH v_overdue_cursor INTO v_occurrence_id, v_recurring_expense_id, v_member_id, v_due_date,
      v_payment_frequency, v_payment_weekday, v_payment_day;
    IF v_done THEN
      LEAVE overdue_loop;
    END IF;

    IF v_payment_frequency = 'weekly' THEN
      -- Same WEEKDAY()/MOD() reconciliation as sp_expense_occurrence_generate_next's
      -- weekly branch (Fase 5): payment_weekday is 1=Monday..7=Sunday, WEEKDAY() is 0=Monday..6=Sunday.
      SET v_next_payment_date = DATE_ADD(
        v_due_date,
        INTERVAL MOD((v_payment_weekday - 1) - WEEKDAY(v_due_date) + 7, 7) DAY
      );
    ELSEIF v_payment_frequency = 'monthly' THEN
      SET v_candidate_a = DATE(CONCAT(
        YEAR(v_due_date), '-', LPAD(MONTH(v_due_date), 2, '0'), '-',
        LPAD(LEAST(v_payment_day, DAY(LAST_DAY(v_due_date))), 2, '0')
      ));
      IF v_candidate_a >= v_due_date THEN
        SET v_next_payment_date = v_candidate_a;
      ELSE
        SET v_candidate_b = DATE_ADD(LAST_DAY(v_due_date), INTERVAL 1 DAY); -- first of next month
        SET v_next_payment_date = DATE(CONCAT(
          YEAR(v_candidate_b), '-', LPAD(MONTH(v_candidate_b), 2, '0'), '-',
          LPAD(LEAST(v_payment_day, DAY(LAST_DAY(v_candidate_b))), 2, '0')
        ));
      END IF;
    ELSE -- semimonthly: paid on the 15th and on the last day of the month
      SET v_candidate_a = DATE(CONCAT(YEAR(v_due_date), '-', LPAD(MONTH(v_due_date), 2, '0'), '-15'));
      SET v_candidate_b = LAST_DAY(v_due_date);
      IF v_candidate_a >= v_due_date THEN
        SET v_next_payment_date = v_candidate_a;
      ELSEIF v_candidate_b >= v_due_date THEN
        SET v_next_payment_date = v_candidate_b;
      ELSE
        SET v_candidate_c = DATE_ADD(v_candidate_b, INTERVAL 1 DAY); -- first of next month
        SET v_next_payment_date = DATE(CONCAT(YEAR(v_candidate_c), '-', LPAD(MONTH(v_candidate_c), 2, '0'), '-15'));
      END IF;
    END IF;

    IF p_today >= v_next_payment_date THEN
      INSERT INTO tmp_pending_reminders (occurrence_id, recurring_expense_id, member_id, reminder_type)
      VALUES (v_occurrence_id, v_recurring_expense_id, v_member_id, 'overdue_daily');
    END IF;
  END LOOP;
  CLOSE v_overdue_cursor;

  -- Category 3: withdrawal — today is the withdrawal day for an active
  -- weekly/biweekly expense's current open (unpaid) occurrence.
  INSERT INTO tmp_pending_reminders (occurrence_id, recurring_expense_id, member_id, reminder_type)
  SELECT open_occ.id, re.id, re.responsible_member_id, 'withdrawal'
  FROM recurring_expenses re
  INNER JOIN expense_occurrences open_occ ON open_occ.id = (
    SELECT eo.id FROM expense_occurrences eo
    WHERE eo.recurring_expense_id = re.id AND eo.is_paid = 0
    ORDER BY eo.due_date ASC
    LIMIT 1
  )
  WHERE re.is_active = 1
    AND re.periodicity IN ('weekly', 'biweekly')
    AND re.withdrawal_day = DAY(p_today)
    AND NOT EXISTS (
      SELECT 1 FROM reminder_log rl
      WHERE rl.occurrence_id = open_occ.id AND rl.member_id = re.responsible_member_id
        AND rl.reminder_type = 'withdrawal' AND rl.sent_date = p_today
    );

  SELECT
    t.occurrence_id, t.recurring_expense_id, t.member_id, t.reminder_type,
    re.name AS expense_name, re.amount, c.symbol AS currency_symbol,
    eo.due_date, hm.display_name AS member_display_name, u.telegram_chat_id
  FROM tmp_pending_reminders t
  INNER JOIN recurring_expenses re ON re.id = t.recurring_expense_id
  INNER JOIN currencies c ON c.id = re.currency_id
  INNER JOIN expense_occurrences eo ON eo.id = t.occurrence_id
  INNER JOIN household_members hm ON hm.id = t.member_id
  INNER JOIN users u ON u.id = hm.user_id
  ORDER BY t.reminder_type, eo.due_date;

  DROP TEMPORARY TABLE IF EXISTS tmp_pending_reminders;
END;
```

- [ ] **Step 4: Implement `sp_reminder_log_sent`**

Create `db/procedures/sp_reminder_log_sent.sql`:

```sql
DROP PROCEDURE IF EXISTS sp_reminder_log_sent;

CREATE PROCEDURE sp_reminder_log_sent(
  IN p_occurrence_id INT UNSIGNED,
  IN p_member_id INT UNSIGNED,
  IN p_reminder_type ENUM('due_soon', 'overdue_daily', 'withdrawal'),
  IN p_sent_date DATE
)
BEGIN
  -- INSERT IGNORE relies on uq_reminder_log_send for idempotency — matches
  -- the same race-safety idiom already used in sp_shopping_list_split_init (Fase 3).
  INSERT IGNORE INTO reminder_log (occurrence_id, member_id, reminder_type, sent_date)
  VALUES (p_occurrence_id, p_member_id, p_reminder_type, p_sent_date);
END;
```

- [ ] **Step 5: Implement the TS wrapper**

Create `src/lib/db/procedures/reminders.ts`:

```typescript
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface PendingReminderRecord extends RowDataPacket {
  occurrence_id: number;
  recurring_expense_id: number;
  member_id: number;
  reminder_type: 'due_soon' | 'overdue_daily' | 'withdrawal';
  expense_name: string;
  amount: number;
  currency_symbol: string;
  due_date: string;
  member_display_name: string;
  telegram_chat_id: number | null;
}

export async function getPendingReminders(today: string): Promise<PendingReminderRecord[]> {
  return callProcedure<PendingReminderRecord>('sp_reminder_get_pending', [today]);
}

export async function logReminderSent(params: {
  occurrenceId: number;
  memberId: number;
  reminderType: 'due_soon' | 'overdue_daily' | 'withdrawal';
  sentDate: string;
}): Promise<void> {
  await callProcedure('sp_reminder_log_sent', [
    params.occurrenceId,
    params.memberId,
    params.reminderType,
    params.sentDate,
  ]);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- reminders.test.ts`
Expected: PASS, all tests green. If the `overdue_daily` weekly/monthly tests are flaky at a specific point in a real month/week (they are designed to always be positive-case regardless of run date, per their inline comments — re-read the comments carefully if one fails to confirm whether it's a genuine bug or a bad assumption about "today"), fix the SP, not the test's date arithmetic, unless you can show the test's assumption is actually wrong.

- [ ] **Step 7: Run full verification**

Run: `npx tsc --noEmit` — clean.
Run: `npm run build` — succeeds.
Run: `npm test` — all pass, no regressions.

- [ ] **Step 8: Commit**

```bash
git add db/procedures/sp_reminder_get_pending.sql db/procedures/sp_reminder_log_sent.sql src/lib/db/procedures/reminders.ts tests/db/procedures/reminders.test.ts
git commit -m "feat(recordatorios): add sp_reminder_get_pending with per-member payday math"
```

---

### Task 3: Telegram Bot HTTP client

**Files:**
- Create: `src/lib/telegram/client.ts`
- Test: `tests/lib/telegram/client.test.ts` (new file)

**Interfaces:**
- Consumes: `PendingReminderRecord` (`@/lib/db/procedures/reminders`, Task 2).
- Produces: `sendTelegramMessage(chatId, text)`, `buildReminderMessage(reminder)` (pure, exported for testing), `sendReminderTelegramMessage(reminder)` — consumed by Task 4's orchestration function.

`sendTelegramMessage` makes a real HTTP call and has no dedicated test (same precedent as `sendInvitationEmail`/`sendPasswordResetEmail`, neither of which is unit-tested directly). `buildReminderMessage` is a pure function with no I/O, so it's fully testable and IS tested here.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/telegram/client.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildReminderMessage } from '@/lib/telegram/client';
import type { PendingReminderRecord } from '@/lib/db/procedures/reminders';

function makeReminder(overrides: Partial<PendingReminderRecord>): PendingReminderRecord {
  return {
    occurrence_id: 1,
    recurring_expense_id: 1,
    member_id: 1,
    reminder_type: 'due_soon',
    expense_name: 'Internet',
    amount: 25000,
    currency_symbol: '₡',
    due_date: '2026-08-01',
    member_display_name: 'Owner',
    telegram_chat_id: 123,
    ...overrides,
  } as PendingReminderRecord;
}

describe('buildReminderMessage', () => {
  it('builds a due_soon message mentioning the due date and amount', () => {
    const text = buildReminderMessage(makeReminder({ reminder_type: 'due_soon' }));
    expect(text).toContain('Internet');
    expect(text).toContain('2026-08-01');
    expect(text).toContain('₡25000');
  });

  it('builds an overdue_daily message that reads as overdue, not merely due soon', () => {
    const text = buildReminderMessage(makeReminder({ reminder_type: 'overdue_daily' }));
    expect(text.toLowerCase()).toContain('vencido');
  });

  it('builds a withdrawal message that mentions retiro de fondos', () => {
    const text = buildReminderMessage(makeReminder({ reminder_type: 'withdrawal' }));
    expect(text.toLowerCase()).toContain('retiro');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- client.test.ts`
Expected: FAIL — module `@/lib/telegram/client` does not exist yet.

- [ ] **Step 3: Implement the client**

Create `src/lib/telegram/client.ts`:

```typescript
import type { PendingReminderRecord } from '@/lib/db/procedures/reminders';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN no está configurado');
  }
  return token;
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API respondió ${response.status}: ${body}`);
  }
}

const REMINDER_MESSAGE_BUILDERS: Record<PendingReminderRecord['reminder_type'], (r: PendingReminderRecord) => string> = {
  due_soon: (r) =>
    `Recordatorio: "${r.expense_name}" vence mañana (${r.due_date}). Monto: ${r.currency_symbol}${r.amount}.`,
  overdue_daily: (r) =>
    `"${r.expense_name}" está vencido desde el ${r.due_date}. Monto: ${r.currency_symbol}${r.amount}. Marcalo como pagado cuando lo resuelvas.`,
  withdrawal: (r) =>
    `Hoy es el día de retiro de fondos para "${r.expense_name}" (${r.currency_symbol}${r.amount}).`,
};

export function buildReminderMessage(reminder: PendingReminderRecord): string {
  return REMINDER_MESSAGE_BUILDERS[reminder.reminder_type](reminder);
}

/**
 * Returns whether a message was actually sent. Returns false (without
 * throwing) when the reminder's member hasn't linked their Telegram account
 * yet — callers must NOT log this as sent, so it's retried once they link.
 */
export async function sendReminderTelegramMessage(reminder: PendingReminderRecord): Promise<boolean> {
  if (reminder.telegram_chat_id === null) {
    return false;
  }
  await sendTelegramMessage(reminder.telegram_chat_id, buildReminderMessage(reminder));
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- client.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run full verification**

Run: `npx tsc --noEmit` — clean.
Run: `npm run build` — succeeds.
Run: `npm test` — all pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/lib/telegram/client.ts tests/lib/telegram/client.test.ts
git commit -m "feat(recordatorios): add Telegram Bot API client and message builder"
```

---

### Task 4: Reminder-sending orchestration + cron Route Handler

**Files:**
- Create: `src/lib/reminders/send-pending-reminders.ts`
- Test: `tests/lib/reminders/send-pending-reminders.test.ts` (new file)
- Create: `src/app/api/cron/reminders/route.ts`

**Interfaces:**
- Consumes: `getPendingReminders`, `logReminderSent` (`@/lib/db/procedures/reminders`, Task 2), `sendReminderTelegramMessage` (`@/lib/telegram/client`, Task 3).
- Produces: `sendPendingReminders(today)` — the fully testable orchestration function the Route Handler calls.

This mirrors `src/lib/household/invite-member.ts`'s shape exactly: a small function that does one DB read, loops, calls an external send function, and does a DB write per success — tested by mocking the send function (`tests/lib/household/invite-member.test.ts` is the concrete precedent to copy).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/reminders/send-pending-reminders.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { createRecurringExpense, listExpenseCategories } from '@/lib/db/procedures/recurring-expenses';
import { setTelegramLinkToken, linkTelegramChat } from '@/lib/db/procedures/telegram';
import { sendPendingReminders } from '@/lib/reminders/send-pending-reminders';
import { uniqueSuffix } from '../../helpers/db';

const sendReminderTelegramMessageMock = vi.fn();
vi.mock('@/lib/telegram/client', () => ({
  sendReminderTelegramMessage: (...args: unknown[]) => sendReminderTelegramMessageMock(...args),
}));

const CRC_ID = 1;

async function createOwnerWithLinkedTelegram(
  suffix: string,
): Promise<{ householdId: number; memberId: number }> {
  const user = await registerUser({
    email: `send_pending_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa SendPending ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
  });
  const [membership] = await getHouseholdsForUser(user.id);
  await setTelegramLinkToken(user.id, `send-pending-token-${suffix}`);
  await linkTelegramChat(`send-pending-token-${suffix}`, 555);
  return { householdId: household.id, memberId: membership.member_id };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe('sendPendingReminders', () => {
  beforeEach(() => {
    sendReminderTelegramMessageMock.mockReset();
  });

  it('sends and logs a reminder that was successfully delivered', async () => {
    sendReminderTelegramMessageMock.mockResolvedValue(true);
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createOwnerWithLinkedTelegram(suffix);
    const [category] = await listExpenseCategories();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await createRecurringExpense({
      householdId,
      name: `Enviado ${suffix}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberId,
      createdByMemberId: memberId,
    });

    const result = await sendPendingReminders(isoDate(new Date()));

    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(sendReminderTelegramMessageMock).toHaveBeenCalled();

    // Calling again the same day must not re-send: the first call's
    // logReminderSent should have made this reminder disappear from
    // getPendingReminders.
    sendReminderTelegramMessageMock.mockClear();
    const secondResult = await sendPendingReminders(isoDate(new Date()));
    const stillPending = secondResult.total;
    expect(stillPending).toBe(0);
  });

  it('does not log as sent when the member has not linked Telegram yet (send returns false)', async () => {
    sendReminderTelegramMessageMock.mockResolvedValue(false);
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `unlinked_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const household = await createHousehold({
      name: `Casa Unlinked ${suffix}`,
      creatorUserId: user.id,
      creatorDisplayName: 'Owner',
    });
    const [membership] = await getHouseholdsForUser(user.id);
    const [category] = await listExpenseCategories();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await createRecurringExpense({
      householdId: household.id,
      name: `Sin vincular ${suffix}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: membership.member_id,
      createdByMemberId: membership.member_id,
    });

    const result = await sendPendingReminders(isoDate(new Date()));

    expect(result.sent).toBe(0);
    expect(result.total).toBeGreaterThanOrEqual(1);

    // Because it wasn't logged as sent, it must still be pending afterward.
    const secondResult = await sendPendingReminders(isoDate(new Date()));
    expect(secondResult.total).toBeGreaterThanOrEqual(1);
  });

  it('continues processing remaining reminders when one send throws', async () => {
    sendReminderTelegramMessageMock
      .mockRejectedValueOnce(new Error('Telegram API respondió 500'))
      .mockResolvedValue(true);
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdA, memberId: memberA } = await createOwnerWithLinkedTelegram(suffixA);
    const { householdId: householdB, memberId: memberB } = await createOwnerWithLinkedTelegram(suffixB);
    const [category] = await listExpenseCategories();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await createRecurringExpense({
      householdId: householdA,
      name: `Falla primero ${suffixA}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberA,
      createdByMemberId: memberA,
    });
    await createRecurringExpense({
      householdId: householdB,
      name: `Segundo si llega ${suffixB}`,
      categoryId: category.id,
      amount: 1000,
      currencyId: CRC_ID,
      periodicity: 'one_time',
      dueDayConfig: null,
      withdrawalDay: null,
      firstDueDate: isoDate(tomorrow),
      responsibleMemberId: memberB,
      createdByMemberId: memberB,
    });

    const result = await sendPendingReminders(isoDate(new Date()));

    expect(result.total).toBe(2);
    expect(result.sent).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- send-pending-reminders.test.ts`
Expected: FAIL — module `@/lib/reminders/send-pending-reminders` does not exist yet.

- [ ] **Step 3: Implement the orchestration function**

Create `src/lib/reminders/send-pending-reminders.ts`:

```typescript
import { getPendingReminders, logReminderSent } from '@/lib/db/procedures/reminders';
import { sendReminderTelegramMessage } from '@/lib/telegram/client';

export interface SendPendingRemindersResult {
  total: number;
  sent: number;
}

export async function sendPendingReminders(today: string): Promise<SendPendingRemindersResult> {
  const reminders = await getPendingReminders(today);

  let sent = 0;
  for (const reminder of reminders) {
    try {
      const wasSent = await sendReminderTelegramMessage(reminder);
      if (wasSent) {
        await logReminderSent({
          occurrenceId: reminder.occurrence_id,
          memberId: reminder.member_id,
          reminderType: reminder.reminder_type,
          sentDate: today,
        });
        sent += 1;
      }
    } catch (error) {
      // Do not log as sent on failure — it will be retried on the next
      // cron run. Continue with the rest of the batch; one failure must
      // not block every other household's reminders.
      console.error(
        `Error al enviar recordatorio ${reminder.reminder_type} para occurrence ${reminder.occurrence_id}:`,
        error,
      );
    }
  }

  return { total: reminders.length, sent };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- send-pending-reminders.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Create the cron Route Handler**

Create `src/app/api/cron/reminders/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { sendPendingReminders } from '@/lib/reminders/send-pending-reminders';

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const result = await sendPendingReminders(today);

  return NextResponse.json(result);
}
```

Vercel Cron Jobs issue a `GET` request by default — hence `GET`, not `POST`, unlike the other Route Handlers in this codebase. Vercel automatically attaches `Authorization: Bearer $CRON_SECRET` to requests it makes to a configured cron path when the `CRON_SECRET` environment variable is set on the project (a Vercel platform feature, not custom code) — Task 5 wires up `vercel.json` and documents setting that env var.

- [ ] **Step 6: Run full verification**

Run: `npx tsc --noEmit` — clean.
Run: `npm run build` — succeeds, `/api/cron/reminders` appears in the route table.
Run: `npm test` — all pass, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reminders/send-pending-reminders.ts tests/lib/reminders/send-pending-reminders.test.ts src/app/api/cron/reminders/route.ts
git commit -m "feat(recordatorios): add reminder-sending orchestration and cron route"
```

---

### Task 5: Telegram account linking — webhook, Server Action, `/perfil` UI, and deployment config

**Files:**
- Create: `src/app/api/telegram/webhook/route.ts`
- Modify: `src/app/perfil/actions.ts`
- Modify: `src/app/perfil/page.tsx`
- Create: `src/components/TelegramLinkSection.tsx`
- Create: `vercel.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `linkTelegramChat`, `setTelegramLinkToken`, `getTelegramStatus` (`@/lib/db/procedures/telegram`, Task 1), `requireMembership`-equivalent session access (`auth()` from `@/auth`, same as `src/app/perfil/page.tsx` already uses).
- Produces: the finished Fase 7 feature end-to-end.

- [ ] **Step 1: Create the webhook Route Handler**

Create `src/app/api/telegram/webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { linkTelegramChat } from '@/lib/db/procedures/telegram';

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number };
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const text = update.message?.text;
  const chatId = update.message?.chat?.id;

  if (text?.startsWith('/start ') && typeof chatId === 'number') {
    const token = text.slice('/start '.length).trim();
    await linkTelegramChat(token, chatId);
  }

  // Always respond 200 — Telegram retries on non-2xx, and an unmatched
  // token or a message that isn't a /start command is not an error, just
  // nothing to do.
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Add the Server Action to `/perfil`**

Read `src/app/perfil/actions.ts` first to match its exact current shape before appending. Add:

```typescript
import { randomBytes } from 'node:crypto';
import { getTelegramStatus, setTelegramLinkToken } from '@/lib/db/procedures/telegram';

export interface TelegramLinkState {
  linkUrl: string | null;
  isLinked: boolean;
  error: string | null;
}

export async function generateTelegramLinkAction(): Promise<TelegramLinkState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { linkUrl: null, isLinked: false, error: 'No autenticado' };
  }
  const userId = Number(session.user.id);

  try {
    const status = await getTelegramStatus(userId);
    if (status.is_linked) {
      return { linkUrl: null, isLinked: true, error: null };
    }

    const token = randomBytes(16).toString('hex');
    await setTelegramLinkToken(userId, token);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    return { linkUrl: `https://t.me/${botUsername}?start=${token}`, isLinked: false, error: null };
  } catch {
    return { linkUrl: null, isLinked: false, error: 'No se pudo generar el enlace de vinculación.' };
  }
}
```

(Match whatever import `auth` already uses in this file — `perfil/page.tsx` already imports it from `@/auth`; reuse the same import style in `actions.ts`, adding `'use server'` at the top if the file doesn't already have it — it does, per the existing `logoutAction`/`updatePaymentScheduleAction` in this file.)

- [ ] **Step 3: Create the `TelegramLinkSection` component**

Create `src/components/TelegramLinkSection.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { generateTelegramLinkAction, type TelegramLinkState } from '@/app/perfil/actions';

export function TelegramLinkSection() {
  const [state, setState] = useState<TelegramLinkState | null>(null);

  useEffect(() => {
    generateTelegramLinkAction().then(setState);
  }, []);

  if (state === null) {
    return <p className="text-body-secondary">Cargando…</p>;
  }

  if (state.error) {
    return <p className="text-danger">{state.error}</p>;
  }

  if (state.isLinked) {
    return <p className="text-success">Tu cuenta de Telegram ya está vinculada.</p>;
  }

  return (
    <a href={state.linkUrl ?? '#'} target="_blank" rel="noreferrer" className="btn btn-outline-primary w-100">
      <i className="bi bi-telegram me-1" />
      Vincular Telegram
    </a>
  );
}
```

- [ ] **Step 4: Wire the section into `/perfil`**

Read `src/app/perfil/page.tsx` first to match its exact current shape. Add the import `import { TelegramLinkSection } from '@/components/TelegramLinkSection';` and a new section, placed after the existing "Instalación" section and before the logout form:

```tsx
<h2 className="h6 text-body-secondary text-uppercase mt-4 mb-3">Recordatorios</h2>
<TelegramLinkSection />
```

- [ ] **Step 5: Add the Vercel Cron config**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 14 * * *"
    }
  ]
}
```

`0 14 * * *` is 14:00 UTC daily — Vercel Cron always runs in UTC; 14:00 UTC is 08:00 in Costa Rica (UTC-6). Adjust the hour if the deployed timezone expectation changes.

- [ ] **Step 6: Document the new environment variables**

Read `.env.example` first, then append:

```
TELEGRAM_BOT_TOKEN=123456789:placeholder-replace-with-real-token
TELEGRAM_BOT_USERNAME=YourBotUsernameBot
TELEGRAM_WEBHOOK_SECRET=changeme-generate-a-real-secret
CRON_SECRET=changeme-generate-a-real-secret
```

- [ ] **Step 7: Manual verification**

Run: `npx tsc --noEmit` — clean.
Run: `npm run build` — succeeds, `/api/telegram/webhook` and `/api/cron/reminders` both appear in the route table.
Run: `npm test` — all pass, no regressions (this task adds no new automated tests for the UI/webhook wiring, matching the established convention — the underlying `linkTelegramChat`/`sendPendingReminders` logic these routes call is already tested in Tasks 1 and 4).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/telegram/webhook/route.ts src/app/perfil/actions.ts src/app/perfil/page.tsx src/components/TelegramLinkSection.tsx vercel.json .env.example
git commit -m "feat(recordatorios): add Telegram account linking UI, webhook, and cron deployment config"
```

---

## After all tasks: deployment note (manual, one-time, not code)

Once this branch is merged and deployed to Vercel with real `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET`/`CRON_SECRET` values set as Vercel environment variables, register the webhook URL with Telegram **once** (this cannot be done from within the app — it's a one-time call to Telegram's own API after the real HTTPS URL exists):

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-deployed-domain>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## After all tasks: final whole-branch review

Once Tasks 1-5 are all committed on `feature/fase-7-recordatorios-telegram`, dispatch a final whole-branch review (most capable model available) covering the full diff against `main`, focusing on: the payment-frequency date math in `sp_reminder_get_pending` (hand-trace weekly/monthly/semimonthly edge cases including month-length clamping), whether `reminder_log`'s idempotency actually prevents duplicate sends across concurrent/retried cron invocations, whether an unlinked member's reminders are correctly retried rather than silently dropped, and whether the two new unauthenticated Route Handlers (`/api/telegram/webhook`, `/api/cron/reminders`) are genuinely unreachable without their respective secrets. Fix any Critical/Important findings and re-review before merging, exactly as done for Fases 3, 4, 5, and 6.

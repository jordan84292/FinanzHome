# FinanzHome — Fase 1b: Rediseño visual + Perfil de pago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic Bootstrap-default look with a deliberate, dark, glossy fintech visual identity (deep indigo-violet surfaces, a purple→pink gradient accent used as the one signature move) across every existing page, and move payment scheduling out of household creation/joining into a new user profile — replacing a single "día de pago" number with a proper periodicity (semanal/quincenal/mensual) model.

**Architecture:** The visual identity is implemented as Bootstrap 5 CSS-variable overrides on top of Bootstrap's built-in `data-bs-theme="dark"` mode (not a from-scratch dark palette or a rewrite) plus one added display font, so every existing `btn`/`form-control`/`card` class across the app inherits the new look with zero component-level changes. `--bs-primary` stays a solid color (Bootstrap's internals — focus rings, `text-primary`, subtle-bg helpers — expect a solid value); the purple→pink gradient is a separate `--gradient-accent` token applied explicitly to the handful of elements that carry it (primary buttons, the active bottom-nav item). The payment-schedule change follows the exact same DB-first pattern as every prior phase: a stored procedure validates and normalizes the periodicity/day combination, invoked only via `callProcedure`.

**Design direction (revised mid-phase — see note):** The user reviewed an initial light palette (implemented and approved as this plan's original Task 1) and then explicitly asked to pivot to a dark theme with purple/pink gradients, referencing a stock fintech-app mockup. Task 1 below reflects the **final, dark** direction — it supersedes the light tokens from the first Task 1 commit on this branch with a new commit, rather than amending history. If you're executing this plan fresh (not continuing an in-progress branch), you'll simply never see the light version.

**Tech Stack (added this phase):** `next/font/google`'s `Fraunces` (display face for page titles only). No new npm dependency — `next/font` ships with Next.js.

## Global Constraints

- **DB-first, no ORM** (carried over): the new profile procedures live in stored procedures; `src/lib/db/procedures/profile.ts` only calls `callProcedure`.
- **This phase edits already-merged code from Fase 0a and Fase 0b.** Specifically: `sp_household_create`/`sp_household_invitation_accept` (Fase 0a) drop their `payment_day` parameter, and `src/app/onboarding/actions.ts`/`page.tsx`/`src/lib/validation/onboarding.ts` (Fase 0b) drop the "día de pago" field. Treat these as intentional, plan-mandated edits to existing files — read the current file first, don't guess its shape.
- **Payment periodicity model (confirmed this session):** `weekly` asks for a weekday (1–7). `monthly` asks for a day of month (1–31). `semimonthly` ("quincenal") asks for nothing — it's fixed to the 15th and the last day of the month, which is what "quincenal" means in everyday Costa Rican usage, not a floating 14-day cycle. A user's payment schedule is optional and lives on `users`, settable anytime from `/perfil` — never required at registration or household creation/join time.
- **Visual system is CSS-variable-driven, not a component rewrite.** Every page keeps its existing Bootstrap classes (`btn btn-primary`, `card`, `form-control`, etc.) — the new palette/radius/font apply automatically once the root variables and font are set up in Task 1. Later tasks only touch markup where the design calls for something a variable override can't reach (e.g., the low-stock indicator's accent border, the bottom-nav active-item glow).
- **Spend the gradient/glow in exactly two places: primary buttons and the active bottom-nav item.** Everything else (cards, list items, form controls, secondary text) stays a flat, quiet dark surface. This is deliberate restraint, not an oversight — a glow on every element reads as noisy, not premium; a signature move only reads as a signature if most of the screen doesn't have one.

---

## File Structure

```
FinanzHome/
├── db/
│   ├── migrations/004_payment_schedule.sql
│   └── procedures/
│       ├── sp_household_create.sql            (modified)
│       ├── sp_household_invitation_accept.sql (modified)
│       ├── sp_user_get_profile.sql
│       └── sp_user_update_payment_schedule.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx                (modified — Fraunces font)
│   │   ├── globals.css               (modified — palette + type tokens)
│   │   ├── login/page.tsx            (modified — visual only)
│   │   ├── register/page.tsx         (modified — visual only)
│   │   ├── onboarding/
│   │   │   ├── actions.ts            (modified — drop paymentDay)
│   │   │   ├── page.tsx              (modified — drop field + visual)
│   │   ├── hogar/miembros/page.tsx   (modified — visual only)
│   │   ├── inventario/
│   │   │   ├── inventory-client.tsx  (modified — visual only)
│   │   └── perfil/
│   │       ├── actions.ts
│   │       └── page.tsx
│   ├── components/
│   │   ├── BottomNav.tsx             (modified — Perfil item + active state)
│   │   └── inventory/ProductRow.tsx  (modified — low-stock accent)
│   ├── lib/
│   │   ├── db/procedures/
│   │   │   ├── household.ts          (modified — drop paymentDay params)
│   │   │   └── profile.ts
│   │   └── validation/onboarding.ts  (modified — drop paymentDay)
└── tests/
    ├── db/procedures/
    │   ├── household.test.ts         (modified — drop paymentDay args)
    │   └── profile.test.ts
    └── lib/validation/onboarding.test.ts (modified — drop paymentDay cases)
```

---

### Task 1: Sistema de diseño (paleta, tipografía, radios)

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:** none — pure CSS/font foundation every later task's visual work depends on.

- [ ] **Step 1: Add the Fraunces display font**

Modify `src/app/layout.tsx` — add the import and font instance near the top, alongside any existing font setup:
```tsx
import { Fraunces } from 'next/font/google';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-fraunces',
  display: 'swap',
});
```
Add `fraunces.variable` to the `<body>` element's `className` (alongside the existing `pb-5` class from Fase 0b — don't remove it):
```tsx
<body className={`${fraunces.variable} pb-5`}>
```

- [ ] **Step 1b: Turn on Bootstrap's dark theme**

Modify `src/app/layout.tsx` — add `data-bs-theme="dark"` to the `<html>` element:
```tsx
<html lang="es" data-bs-theme="dark">
```
This flips Bootstrap's own internal light/dark logic (form control backgrounds, default text/border contrast, etc.) before any of our own token overrides apply — doing this first means Task 2 below only has to override the handful of values that need a specific brand color, not fight Bootstrap's light-mode defaults everywhere.

- [ ] **Step 2: Palette, gradient, and type tokens**

Modify `src/app/globals.css` — replace its current content with:
```css
:root {
  --bs-body-bg: #1E1B3A;
  --bs-body-color: #F3F1FA;
  --bs-secondary-color: #A9A3C9;
  --bs-border-color: #3D3768;
  --bs-tertiary-bg: #2A2650;

  --bs-primary: #A855F7;
  --bs-primary-rgb: 168, 85, 247;
  --bs-primary-text-emphasis: #E9D5FF;
  --bs-primary-bg-subtle: #382B5C;
  --bs-primary-border-subtle: #5B4A8A;

  --bs-warning: #FB923C;
  --bs-warning-rgb: 251, 146, 60;
  --bs-warning-text-emphasis: #FED7AA;
  --bs-warning-bg-subtle: rgba(251, 146, 60, 0.16);
  --bs-warning-border-subtle: rgba(251, 146, 60, 0.35);

  --bs-danger: #F87171;
  --bs-danger-rgb: 248, 113, 113;

  --bs-border-radius: 0.75rem;
  --bs-border-radius-sm: 0.5rem;
  --bs-border-radius-lg: 1rem;

  --ff-display: var(--font-fraunces), Georgia, serif;

  --gradient-accent: linear-gradient(135deg, #A855F7 0%, #EC4899 100%);
  --glow-accent: 0 0 20px rgba(168, 85, 247, 0.45);
}

body {
  background-color: var(--bs-body-bg);
}

.card,
.list-group,
.list-group-item:first-child,
.list-group-item:last-child {
  border-radius: var(--bs-border-radius);
}

.card,
.list-group-item {
  background-color: var(--bs-tertiary-bg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 6px 16px rgba(0, 0, 0, 0.25);
}

.btn {
  border-radius: var(--bs-border-radius-sm);
}

/* The one signature move: primary buttons carry the gradient + glow.
   Nothing else on the page does — see Global Constraints on restraint. */
.btn-primary {
  background: var(--gradient-accent);
  border: none;
  box-shadow: var(--glow-accent);
}
.btn-primary:hover,
.btn-primary:focus {
  background: var(--gradient-accent);
  filter: brightness(1.08);
  box-shadow: var(--glow-accent);
}

h1,
.page-title {
  font-family: var(--ff-display);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--bs-primary-text-emphasis);
}
```
Note `.btn-primary` overriding `background`/`box-shadow` directly (rather than relying only on `--bs-primary`) is intentional — Bootstrap derives several other things (`text-primary`, `border-primary`, focus-ring color) from the solid `--bs-primary` value, and those must stay a real solid color for Bootstrap's own contrast math to keep working. The gradient is layered on top for this one component, not baked into the primary token itself.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Open `http://localhost:3000/login`. Confirm: the page background is deep indigo-violet (not white, not pure black), any primary button renders the purple→pink gradient with a soft glow (not a flat color), form inputs/cards read correctly against the dark background (light text, visible borders — this is Bootstrap's `data-bs-theme="dark"` doing its job, not something we hand-coded), and any `<h1>` renders in the serif display font in a light lavender tone distinct from body text. Use browser dev tools at ~390px width to confirm nothing looks broken at mobile size and that form text remains legible (sufficient contrast against the dark background — this matters more in dark mode than light, check it for real). Stop the dev server when done.

- [ ] **Step 4: Run full suite and build, then commit**

Run: `npm test` — expected: passing at whatever count this branch is currently at (pure CSS/font change, no logic touched — if a Task 1 commit already exists on this branch from before the dark-theme pivot, this step replaces its diff, not adds to it).

Run: `npm run build` — expected: succeeds.

```bash
git add -A
git commit -m "feat(ui): rework design system as dark theme with gradient accent (per updated direction)"
```

---

### Task 2: Quitar día de pago del hogar (esquema + SPs + wrapper + tests)

**Files:**
- Create: `db/migrations/004_payment_schedule.sql`
- Modify: `db/procedures/sp_household_create.sql`
- Modify: `db/procedures/sp_household_invitation_accept.sql` (INSERT and trailing SELECT)
- Modify: `db/procedures/sp_household_get_for_user.sql` (SELECT column list only — this file wasn't part of the original plan and was found to break at runtime otherwise)
- Modify: `src/lib/db/procedures/household.ts`
- Modify: `tests/db/procedures/household.test.ts`

**Interfaces:**
- Produce: `createHousehold`/`acceptInvitation` with `paymentDay` removed from both — Task 4's `onboarding/actions.ts` and `onboarding/page.tsx` depend on this new (shorter) signature.
- Produce: `users.payment_frequency`/`payment_weekday`/`payment_day` columns — consumed by Task 3's new profile procedures.

- [ ] **Step 1: Migration — drop from households, add to users**

Create `db/migrations/004_payment_schedule.sql`:
```sql
ALTER TABLE household_members
  DROP CHECK chk_household_members_payment_day,
  DROP COLUMN payment_day;

ALTER TABLE users
  ADD COLUMN payment_frequency ENUM('weekly', 'semimonthly', 'monthly') NULL AFTER name,
  ADD COLUMN payment_weekday TINYINT UNSIGNED NULL AFTER payment_frequency,
  ADD COLUMN payment_day TINYINT UNSIGNED NULL AFTER payment_weekday,
  ADD CONSTRAINT chk_users_payment_schedule CHECK (
    (payment_frequency = 'weekly' AND payment_weekday BETWEEN 1 AND 7 AND payment_day IS NULL)
    OR (payment_frequency = 'monthly' AND payment_day BETWEEN 1 AND 31 AND payment_weekday IS NULL)
    OR (payment_frequency = 'semimonthly' AND payment_weekday IS NULL AND payment_day IS NULL)
    OR (payment_frequency IS NULL AND payment_weekday IS NULL AND payment_day IS NULL)
  );
```
**Known MariaDB 10.4 syntax note (confirmed during execution):** `DROP CHECK <name>` combined with another clause (`DROP COLUMN ...`) in the same `ALTER TABLE` statement is not valid MariaDB 10.4 syntax — use `DROP CONSTRAINT <name>` instead (same constraint name, `chk_household_members_payment_day`), which works when combined with other clauses. If `npm run db:migrate` still reports the constraint name doesn't match what's actually in the DB, run `SHOW CREATE TABLE household_members;` against `finanzhome` to find the real name and use that.

Run: `npm run db:migrate` — expected: `applied migration: 004_payment_schedule.sql`.

Verify: `"/c/xampp/mysql/bin/mysql.exe" -h 127.0.0.1 -P 3307 -u root finanzhome -e "DESCRIBE household_members; DESCRIBE users;"` — `household_members` must no longer list `payment_day`; `users` must now list `payment_frequency`, `payment_weekday`, `payment_day`.

- [ ] **Step 2: Update the household SPs**

Modify `db/procedures/sp_household_create.sql` — read the current file first. Remove the `IN p_creator_payment_day TINYINT UNSIGNED` parameter, and remove `payment_day`/its value from the `INSERT INTO household_members (...)` column list and `VALUES (...)` list. Leave everything else (the household INSERT, the final SELECT) unchanged.

Modify `db/procedures/sp_household_invitation_accept.sql` — same treatment: remove `IN p_payment_day TINYINT UNSIGNED`, remove `payment_day` from the `INSERT INTO household_members` column/values lists **and from its trailing `SELECT`'s column list** (it returns the newly-created membership row — that SELECT still names `payment_day` and must drop it too, or the query will fail once the column doesn't exist). Leave the SIGNAL-based invitation-status checks and everything else unchanged.

**Also modify `db/procedures/sp_household_get_for_user.sql`** (not touched in Fase 0a/0b since it was written, but it `SELECT`s `payment_day` from `household_members` — confirmed during execution to break at runtime otherwise, since it's called by `getHouseholdsForUser`, itself called from nearly every Server Action in the app to derive the caller's household). Read it first, then remove `payment_day` from its `SELECT` column list only — nothing else in that procedure changes.

Run: `npm run db:migrate` — expected: all three procedures reload cleanly (`loaded procedure: sp_household_create.sql`, `sp_household_invitation_accept.sql`, `sp_household_get_for_user.sql`).

- [ ] **Step 3: Update the wrapper**

Modify `src/lib/db/procedures/household.ts` — read the current file first. Remove `creatorPaymentDay: number` from `createHousehold`'s params type and from its `callProcedure(...)` array. Remove `paymentDay: number` from `acceptInvitation`'s params type and array. Do not touch anything else in this file (invitation creation, `getHouseholdsForUser`, etc.).

- [ ] **Step 4: Update the existing tests (TDD: confirm the new shape, don't just delete assertions)**

Modify `tests/db/procedures/household.test.ts` — read the current file first. Every call site that currently passes `creatorPaymentDay: <number>` to `createHousehold(...)` or `paymentDay: <number>` to `acceptInvitation(...)` must drop that field. Do not add a replacement assertion about `payment_day` anywhere in this file — the column no longer exists on `household_members`, so there is nothing to assert about it here (Task 3's `profile.test.ts` covers the new schedule fields on `users` instead).

Run: `npm test -- household.test.ts` — expected: all cases in this file pass with the updated call shape (same test count as before this task, since no cases were added or removed — only their argument lists changed).

- [ ] **Step 5: Run full suite and commit**

Run: `npm test` — expected: 38/38 (test count unchanged — this task only reshapes existing calls, doesn't add/remove test cases).

```bash
git add -A
git commit -m "feat(db): move payment scheduling off household membership onto the user"
```

---

### Task 3: Procedimientos de perfil de pago + wrapper + tests

**Files:**
- Create: `db/procedures/sp_user_get_profile.sql`
- Create: `db/procedures/sp_user_update_payment_schedule.sql`
- Create: `src/lib/db/procedures/profile.ts`
- Test: `tests/db/procedures/profile.test.ts`

**Interfaces:**
- Consume: `registerUser` (Fase 0a) — tests need a real user
- Produce: `getUserProfile(userId)`, `updatePaymentSchedule(params)` — consumed by Task 5's `/perfil` Server Action

- [ ] **Step 1: SPs**

Create `db/procedures/sp_user_get_profile.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_user_get_profile;

CREATE PROCEDURE sp_user_get_profile(
  IN p_user_id INT UNSIGNED
)
BEGIN
  SELECT id, email, name, payment_frequency, payment_weekday, payment_day
  FROM users
  WHERE id = p_user_id;
END;
```

Create `db/procedures/sp_user_update_payment_schedule.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_user_update_payment_schedule;

CREATE PROCEDURE sp_user_update_payment_schedule(
  IN p_user_id INT UNSIGNED,
  IN p_payment_frequency VARCHAR(20),
  IN p_payment_weekday TINYINT UNSIGNED,
  IN p_payment_day TINYINT UNSIGNED
)
BEGIN
  IF p_payment_frequency = 'weekly' AND (p_payment_weekday IS NULL OR p_payment_weekday NOT BETWEEN 1 AND 7) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seleccioná el día de la semana';
  ELSEIF p_payment_frequency = 'monthly' AND (p_payment_day IS NULL OR p_payment_day NOT BETWEEN 1 AND 31) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seleccioná el día del mes';
  ELSEIF p_payment_frequency NOT IN ('weekly', 'monthly', 'semimonthly') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Periodicidad inválida';
  END IF;

  UPDATE users
  SET
    payment_frequency = p_payment_frequency,
    payment_weekday = IF(p_payment_frequency = 'weekly', p_payment_weekday, NULL),
    payment_day = IF(p_payment_frequency = 'monthly', p_payment_day, NULL)
  WHERE id = p_user_id;

  SELECT id, email, name, payment_frequency, payment_weekday, payment_day
  FROM users
  WHERE id = p_user_id;
END;
```
Note the `IF(...)` in the `UPDATE` forces the irrelevant field to `NULL` regardless of what was passed — this is deliberate defense-in-depth alongside the table's `CHECK` constraint from Task 2, not redundant: it means even a buggy caller that sends a stray `payment_day` alongside `frequency='weekly'` can't corrupt the row.

Run: `npm run db:migrate` — expected: both procedures load cleanly.

- [ ] **Step 2: Wrapper (TDD)**

Create `tests/db/procedures/profile.test.ts` first:
```ts
import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { getUserProfile, updatePaymentSchedule } from '@/lib/db/procedures/profile';
import { uniqueSuffix } from '../../helpers/db';

describe('user profile / payment schedule procedures', () => {
  it('returns a profile with no payment schedule set by default', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `profile_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Profile Tester',
    });

    const profile = await getUserProfile(user.id);
    expect(profile?.payment_frequency).toBeNull();
    expect(profile?.payment_weekday).toBeNull();
    expect(profile?.payment_day).toBeNull();
  });

  it('sets a weekly schedule and clears payment_day', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `profile2_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Profile Tester 2',
    });

    const updated = await updatePaymentSchedule({
      userId: user.id,
      paymentFrequency: 'weekly',
      paymentWeekday: 5,
      paymentDay: null,
    });

    expect(updated.payment_frequency).toBe('weekly');
    expect(updated.payment_weekday).toBe(5);
    expect(updated.payment_day).toBeNull();
  });

  it('switching to monthly clears a previously-set weekday', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `profile3_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Profile Tester 3',
    });

    await updatePaymentSchedule({
      userId: user.id,
      paymentFrequency: 'weekly',
      paymentWeekday: 2,
      paymentDay: null,
    });

    const updated = await updatePaymentSchedule({
      userId: user.id,
      paymentFrequency: 'monthly',
      paymentWeekday: null,
      paymentDay: 20,
    });

    expect(updated.payment_frequency).toBe('monthly');
    expect(updated.payment_day).toBe(20);
    expect(updated.payment_weekday).toBeNull();
  });

  it('semimonthly requires neither a weekday nor a day', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `profile4_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Profile Tester 4',
    });

    const updated = await updatePaymentSchedule({
      userId: user.id,
      paymentFrequency: 'semimonthly',
      paymentWeekday: null,
      paymentDay: null,
    });

    expect(updated.payment_frequency).toBe('semimonthly');
    expect(updated.payment_weekday).toBeNull();
    expect(updated.payment_day).toBeNull();
  });

  it('rejects a weekly schedule with no weekday', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `profile5_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Profile Tester 5',
    });

    await expect(
      updatePaymentSchedule({
        userId: user.id,
        paymentFrequency: 'weekly',
        paymentWeekday: null,
        paymentDay: null,
      }),
    ).rejects.toThrow(/día de la semana/);
  });
});
```

Run: `npm test -- profile.test.ts` — expected: FAIL, module doesn't exist.

Create `src/lib/db/procedures/profile.ts`:
```ts
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export type PaymentFrequency = 'weekly' | 'semimonthly' | 'monthly';

export interface UserProfileRecord extends RowDataPacket {
  id: number;
  email: string;
  name: string;
  payment_frequency: PaymentFrequency | null;
  payment_weekday: number | null;
  payment_day: number | null;
}

export async function getUserProfile(userId: number): Promise<UserProfileRecord | null> {
  const rows = await callProcedure<UserProfileRecord>('sp_user_get_profile', [userId]);
  return rows[0] ?? null;
}

export async function updatePaymentSchedule(params: {
  userId: number;
  paymentFrequency: PaymentFrequency;
  paymentWeekday: number | null;
  paymentDay: number | null;
}): Promise<UserProfileRecord> {
  const rows = await callProcedure<UserProfileRecord>('sp_user_update_payment_schedule', [
    params.userId,
    params.paymentFrequency,
    params.paymentWeekday,
    params.paymentDay,
  ]);
  return rows[0];
}
```

Run: `npm test -- profile.test.ts` — expected: PASS (5/5).

- [ ] **Step 3: Run full suite and commit**

Run: `npm test` — expected: 38 + 5 = 43/43.

```bash
git add -A
git commit -m "feat(db): add user payment-schedule procedures (weekly/semimonthly/monthly) with tests"
```

---

### Task 4: Quitar día de pago del onboarding + rediseño visual de esas páginas

**Files:**
- Modify: `src/lib/validation/onboarding.ts`
- Modify: `tests/lib/validation/onboarding.test.ts`
- Modify: `src/app/onboarding/actions.ts`
- Modify: `src/app/onboarding/page.tsx`

**Interfaces:**
- Consume: `createHousehold`/`acceptInvitation` (Task 2's new, shorter signature)

- [ ] **Step 1: Validation schema (TDD)**

Modify `tests/lib/validation/onboarding.test.ts` — read the current file first. Remove every `paymentDay` field from both `createHouseholdSchema` and `acceptInvitationSchema` test cases' input objects, and remove any test case whose entire purpose was validating `paymentDay` bounds (e.g. "rejects a payment day outside 1-31") — that rule no longer applies to this schema.

Run: `npm test -- tests/lib/validation/onboarding.test.ts` — expected: FAIL, since `src/lib/validation/onboarding.ts` still requires `paymentDay` and the test no longer provides it.

Modify `src/lib/validation/onboarding.ts` — remove `paymentDay: z.coerce.number().int().min(1).max(31)` from both `createHouseholdSchema` and `acceptInvitationSchema`.

Run: `npm test -- tests/lib/validation/onboarding.test.ts` — expected: PASS.

- [ ] **Step 2: Server Actions**

Modify `src/app/onboarding/actions.ts` — read the current file first. In `createHouseholdAction`, remove `paymentDay: formData.get('paymentDay')` from the `safeParse(...)` input object, and remove `creatorPaymentDay: parsed.data.paymentDay` from the `createHousehold({...})` call. In `acceptInvitationAction`, remove `paymentDay: formData.get('paymentDay')` from its `safeParse(...)` input, and remove `paymentDay: parsed.data.paymentDay` from the `acceptInvitation({...})` call.

- [ ] **Step 3: Page — remove the field, apply the visual system**

Modify `src/app/onboarding/page.tsx` — remove both "Día de pago (1-31)" `<input type="number">` blocks (one in the create-household form, one in the accept-invitation form) along with their `<label>`s. Change both `<h1>` elements to also carry `className="h4 mb-4 page-title"` if they don't already resolve to the design system's `.page-title`/`h1` styling automatically (an `<h1>` picks up Task 1's global `h1` CSS rule with no class needed — only add `page-title` if this page uses a non-`h1` heading tag for some reason; check before assuming).

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Using the established csrf+credentials curl technique, register a fresh user, get a session cookie, and confirm `GET /onboarding` no longer renders a "Día de pago" field in either form's HTML (grep the response for "paymentDay" or "Día de pago" — expect no match). Submit the create-household form the same way Fase 0b's Task 5 did (find the `$ACTION_ID_...` field, POST without any payment-day value) and confirm via a direct DB query that a `households`/`household_members` row is still created successfully with no `payment_day` column involved. Stop the dev server and clean up any throwaway scripts when done.

- [ ] **Step 5: Run full suite and build, then commit**

Run: `npm test` — expected: 43/43 (this task reshapes existing validation cases, doesn't add new ones).

Run: `npm run build` — expected: succeeds.

```bash
git add -A
git commit -m "refactor(onboarding): remove payment day from household creation/joining"
```

---

### Task 5: Página /perfil (periodicidad de pago + cerrar sesión)

**Files:**
- Create: `src/app/perfil/actions.ts`
- Create: `src/app/perfil/page.tsx`
- Modify: `src/components/BottomNav.tsx`

**Interfaces:**
- Consume: `getUserProfile`, `updatePaymentSchedule` (Task 3), `auth`/`signOut` (Fase 0b)

- [ ] **Step 1: Server Action**

Create `src/app/perfil/actions.ts`:
```ts
'use server';

import { z } from 'zod';
import { auth, signOut } from '@/auth';
import { updatePaymentSchedule } from '@/lib/db/procedures/profile';

const paymentScheduleSchema = z.discriminatedUnion('paymentFrequency', [
  z.object({
    paymentFrequency: z.literal('weekly'),
    paymentWeekday: z.coerce.number().int().min(1).max(7),
  }),
  z.object({
    paymentFrequency: z.literal('monthly'),
    paymentDay: z.coerce.number().int().min(1).max(31),
  }),
  z.object({
    paymentFrequency: z.literal('semimonthly'),
  }),
]);

export interface UpdatePaymentScheduleState {
  error: string | null;
  success: boolean;
}

export async function updatePaymentScheduleAction(
  _prevState: UpdatePaymentScheduleState,
  formData: FormData,
): Promise<UpdatePaymentScheduleState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Debés iniciar sesión', success: false };
  }

  const raw = {
    paymentFrequency: formData.get('paymentFrequency'),
    paymentWeekday: formData.get('paymentWeekday') || undefined,
    paymentDay: formData.get('paymentDay') || undefined,
  };
  const parsed = paymentScheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'Completá los datos correctamente', success: false };
  }

  try {
    await updatePaymentSchedule({
      userId: Number(session.user.id),
      paymentFrequency: parsed.data.paymentFrequency,
      paymentWeekday: parsed.data.paymentFrequency === 'weekly' ? parsed.data.paymentWeekday : null,
      paymentDay: parsed.data.paymentFrequency === 'monthly' ? parsed.data.paymentDay : null,
    });
  } catch {
    return { error: 'No se pudo guardar. Intentá de nuevo.', success: false };
  }

  return { error: null, success: true };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
```

- [ ] **Step 2: Page**

Create `src/app/perfil/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserProfile } from '@/lib/db/procedures/profile';
import { PaymentScheduleForm } from './payment-schedule-form';
import { logoutAction } from './actions';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const profile = await getUserProfile(Number(session.user.id));

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-1">Tu perfil</h1>
      <p className="text-body-secondary mb-4">{profile?.email}</p>

      <h2 className="h6 text-body-secondary text-uppercase mb-3">Periodicidad de pago</h2>
      <PaymentScheduleForm profile={profile} />

      <form action={logoutAction} className="mt-5">
        <button type="submit" className="btn btn-outline-danger w-100">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Client form with conditional fields**

Create `src/app/perfil/payment-schedule-form.tsx`:
```tsx
'use client';

import { useActionState, useState } from 'react';
import { updatePaymentScheduleAction, type UpdatePaymentScheduleState } from './actions';
import type { UserProfileRecord, PaymentFrequency } from '@/lib/db/procedures/profile';

const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

const initialState: UpdatePaymentScheduleState = { error: null, success: false };

export function PaymentScheduleForm({ profile }: { profile: UserProfileRecord | null }) {
  const [state, formAction, pending] = useActionState(updatePaymentScheduleAction, initialState);
  const [frequency, setFrequency] = useState<PaymentFrequency | ''>(profile?.payment_frequency ?? '');

  return (
    <form action={formAction} className="d-flex flex-column gap-3">
      <div>
        <label htmlFor="paymentFrequency" className="form-label">¿Cómo te pagan?</label>
        <select
          id="paymentFrequency"
          name="paymentFrequency"
          className="form-select"
          required
          value={frequency}
          onChange={(event) => setFrequency(event.target.value as PaymentFrequency)}
        >
          <option value="" disabled>Elegí una opción</option>
          <option value="weekly">Semanal</option>
          <option value="semimonthly">Quincenal (15 y fin de mes)</option>
          <option value="monthly">Mensual</option>
        </select>
      </div>

      {frequency === 'weekly' ? (
        <div>
          <label htmlFor="paymentWeekday" className="form-label">Día de la semana</label>
          <select
            id="paymentWeekday"
            name="paymentWeekday"
            className="form-select"
            defaultValue={profile?.payment_weekday ?? ''}
            required
          >
            <option value="" disabled>Elegí un día</option>
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      {frequency === 'monthly' ? (
        <div>
          <label htmlFor="paymentDay" className="form-label">Día del mes</label>
          <input
            id="paymentDay"
            name="paymentDay"
            type="number"
            min={1}
            max={31}
            className="form-control"
            defaultValue={profile?.payment_day ?? ''}
            required
          />
        </div>
      ) : null}

      {state.error ? (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="alert alert-success py-2 mb-0" role="alert">
          Guardado.
        </div>
      ) : null}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Add "Perfil" to the bottom nav with active-state styling**

Modify `src/components/BottomNav.tsx` — read the current file first. Add a 5th entry to `NAV_ITEMS`: `{ href: '/perfil', label: 'Perfil', icon: 'bi-person-circle' }`. Then make the active route carry the design system's signature gradient/glow treatment (this is the SECOND of the two places — alongside `.btn-primary` from Task 1 — where the plan's "spend it in two places" constraint says the gradient/glow is allowed to appear; every other nav item stays flat/quiet): convert the component to a client component (`'use client'`) if it isn't already, use `usePathname()` from `next/navigation` to compare against each item's `href`, and for the active link apply an inline style using the same tokens Task 1 defined:
```tsx
style={
  isActive
    ? { background: 'var(--gradient-accent)', boxShadow: 'var(--glow-accent)' }
    : undefined
}
```
applied to a small rounded wrapper around just that item's icon (not the whole nav bar), plus `text-white` on the icon/label when active vs. the default `text-body` when not. Keep the wrapper small (icon + tight padding, not full-width) so it reads as a "pill," matching the reference image's glowing-home-icon treatment.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Get a real session cookie, `curl -b <jar> http://localhost:3000/perfil` and confirm the page renders with the payment-frequency selector and no pre-filled schedule for a fresh user. Since the conditional weekday/day fields only appear after a client-side `onChange`, verify the underlying Server Action directly (same FormData-construction technique used in Fase 1's Task 6) for at least the `weekly` case: confirm via a direct `SELECT payment_frequency, payment_weekday, payment_day FROM users WHERE id = ...` that the row updates correctly, and that submitting `monthly` afterward clears `payment_weekday` back to `NULL` (proving the SP's `IF(...)` normalization works end-to-end, not just at the unit level). Clean up any throwaway scripts. Stop the dev server when done.

- [ ] **Step 6: Run full suite and build, then commit**

Run: `npm test` — expected: 43/43 (no new automated tests this task — UI/Server Action wiring over already-tested procedures, consistent with this project's established convention).

Run: `npm run build` — expected: succeeds, `/perfil` appears as a dynamic route.

```bash
git add -A
git commit -m "feat(profile): add /perfil page with payment schedule and logout"
```

---

### Task 6: Rediseño visual del resto de las páginas

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/hogar/miembros/page.tsx`
- Modify: `src/app/inventario/inventory-client.tsx`
- Modify: `src/components/inventory/ProductRow.tsx`

**Interfaces:** none new — this task only touches className/markup on already-working pages; no Server Action or data-fetching logic changes anywhere in this task.

- [ ] **Step 1: Low-stock signature treatment**

Modify `src/components/inventory/ProductRow.tsx` — read the current file first. Replace the existing `isLow ? 'bg-warning-subtle' : ''` className logic with a left-border accent instead of a full-row yellow fill, using the new warning tokens from Task 1:
```tsx
<li
  className="list-group-item d-flex justify-content-between align-items-center"
  style={
    isLow
      ? {
          borderLeft: '4px solid var(--bs-warning)',
          backgroundColor: 'var(--bs-warning-bg-subtle)',
        }
      : undefined
  }
>
```
(Remove the old template-literal className that included `bg-warning-subtle`; keep the rest of the `className` string, e.g. `"list-group-item d-flex justify-content-between align-items-center"`, unconditional now since the color signal moves to inline `style`.)

- [ ] **Step 2: Pass over each remaining page**

For each of `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/hogar/miembros/page.tsx`, `src/app/inventario/inventory-client.tsx`: read the current file, then apply these changes (they already use Bootstrap utility classes that inherit Task 1's tokens automatically — this step is about the handful of things a CSS variable can't reach):
- Any `<h1>` needs no change (inherits the display font/color from Task 1's global rule).
- Primary action buttons should be `btn btn-primary` (already are, per Fase 0b/1 — confirm none were left as `btn-secondary` or unstyled).
- Card-like containers (the `/inventario` slide-up panel's `<div className="bg-body w-100 p-3 rounded-top" ...>`) should use `rounded-top-4` instead of the default `rounded-top` for a more pronounced, on-brand corner radius consistent with Task 1's `--bs-border-radius-lg: 1rem` token — Bootstrap's `rounded-top-4` utility maps to `0.5rem`-scale sizing independent of the CSS variable, so explicitly upsize it here rather than assuming the variable cascades into that specific utility class.
- Empty states (e.g. `/inventario`'s "Todavía no cargaste productos." paragraph) should use `text-body-secondary` (already does) — no change needed, just confirm it wasn't hardcoded to a Bootstrap gray class that bypasses the new secondary-text token.

This step is intentionally light-touch: the point of Task 1's CSS-variable approach is that most of this "just works" once the tokens are in place. Don't invent new layout structure here — only fix spots where a class bypasses the token system (hardcoded hex colors, `btn-secondary` where `btn-primary` was intended, etc.). If a page has no such spots, say so in the report rather than making unnecessary changes.

- [ ] **Step 2b: Fix the PWA theme-color (flagged during Task 1, deferred here)**

Modify `src/app/layout.tsx` — the `viewport` export's `themeColor` still hardcodes Bootstrap's original blue (`#0d6efd`) from the Fase 0b PWA task, predating this whole redesign. Update it to the new dark background color so the OS/browser chrome (address bar tint, task switcher card) matches the app instead of clashing with it:
```ts
export const viewport = {
  themeColor: '#1E1B3A',
};
```
(If the current value or export shape differs from this guess, read the file first and adjust the one color value only — don't restructure the `viewport`/`metadata` exports otherwise.)

- [ ] **Step 3: Manual verification (visual, across all touched pages)**

Run: `npm run dev`. Using a real session cookie, visit `/login`, `/register`, `/hogar/miembros`, and `/inventario` (with at least one low-stock product present — reuse or create one via the established script technique) via curl, and for `/inventario` specifically confirm the low-stock row's HTML now contains `border-left` / the warning CSS variables in its inline `style` attribute rather than `bg-warning-subtle` in its `class`. For the others, confirm no hardcoded Bootstrap-default color classes (`btn-secondary`, raw hex colors) remain anywhere in the rendered HTML of forms/buttons that should carry the new primary color. Stop the dev server and clean up any throwaway scripts when done.

- [ ] **Step 4: Run full suite and build, then commit**

Run: `npm test` — expected: 43/43 (visual-only task, no logic changed, no new tests).

Run: `npm run build` — expected: succeeds.

```bash
git add -A
git commit -m "feat(ui): apply the design system across login, register, hogar, and inventario"
```

---

## Self-Review

**Cobertura:** rediseño visual con paleta clara/profesional ✓ (Tasks 1, 6), día de pago quitado del hogar ✓ (Task 2, 4), periodicidad semanal/quincenal/mensual en el perfil del usuario ✓ (Tasks 3, 5), quincenal fijo en 15/fin de mes sin pedir día ✓ (Task 3's SP explicitly nulls both fields for `semimonthly`).

**Placeholders:** none — every step has complete code, including the two previously-merged files (Fase 0a's `sp_household_create.sql`/`household.ts`, Fase 0b's `onboarding/actions.ts`/`page.tsx`) that this phase intentionally edits, each with precise instructions about exactly what to remove.

**Testing honesty:** Tasks 1, 4 (partial), 5, 6 explicitly document no new automated tests where the change is UI/CSS-only or thin Server Action glue, consistent with this project's established convention. Every piece of new *logic* (the payment-schedule validation/normalization SP) has real tests against MariaDB in Task 3, including the negative case (weekly with no weekday).

**Type consistency:** `PaymentFrequency`/`UserProfileRecord` (Task 3) are consumed identically by `perfil/actions.ts`, `perfil/page.tsx`, and `payment-schedule-form.tsx` — no drifted shape. `paymentScheduleSchema`'s `z.discriminatedUnion` keys (`weekly`/`monthly`/`semimonthly`) match the SP's `ENUM` values and the `<select>` option values exactly.

## Qué sigue

With the visual identity established and payment scheduling correctly modeled per-user, Fase 2 (Lista de compras inteligente) is next per the master plan — it will read `products.optimal_quantity - products.current_quantity` and reuse `<CurrencyAmountInput>`, and this phase's design tokens mean its new pages inherit the same look with no extra design work.

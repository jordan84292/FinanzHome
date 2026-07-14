# FinanzHome — Fase 1: Inventario del Hogar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Household members can catalog products with a fixed optimal quantity, track current quantity, and see at a glance what's running low — the foundation the Fase 2 shopping list reads from.

**Architecture:** Products/categories/units live in new stored procedures, invoked only via `callProcedure`. The `/inventario` page is a server component that fetches everything needed in one pass; a client component owns only UI state (which panel is open, optimistic stepper taps). Server Actions stay thin and re-derive the caller's household from the session — never trust a client-supplied household ID, matching every prior phase's convention.

**Tech Stack (added this phase):** none — no new dependencies. This phase is the first real consumer of `zod` (already installed) for product validation, `CurrencyAmountInput` (a new shared component, first use of the multi-currency design from the master plan), and `src/lib/ui/alerts.ts`'s `showError` (built in Fase 0b, unused until now).

## Global Constraints

- **DB-first, no ORM** (carried over): all product/category/unit logic lives in stored procedures, invoked only via `callProcedure`.
- **Household scoping is always server-derived**: every action re-fetches `getHouseholdsForUser(session.user.id)` and uses `membership.id`/`membership.member_id` — never a client-supplied household ID, matching Fase 0b's `hogar/miembros` pattern exactly.
- **Multi-currency from the master plan**: `products.default_price` carries its own `default_price_currency_id` (CRC or USD, nullable — price is optional). This phase introduces the reusable `<CurrencyAmountInput>` component the master plan earmarked for reuse in Fases 2/5/9.
- **Mobile-first**: the product list and forms are single-column, large tap targets, a slide-up panel (not a separate page navigation) for add/edit — this is the screen users will have open one-handed while checking their fridge.
- **This phase's first task closes a gap flagged by Fase 0b's final review**: `src/middleware.ts` currently decorates requests with session info but never redirects unauthenticated users away from protected routes (enforcement was entirely at the Server Action layer). Fase 0b's reviewer explicitly recommended fixing this before any phase renders household-scoped data — this phase does exactly that, so it goes first.

---

## File Structure

```
FinanzHome/
├── db/
│   ├── migrations/003_inventory.sql
│   └── procedures/
│       ├── sp_category_list.sql
│       ├── sp_category_create.sql
│       ├── sp_unit_list.sql
│       ├── sp_product_list.sql
│       ├── sp_product_create.sql
│       ├── sp_product_update.sql
│       ├── sp_product_update_current_quantity.sql
│       └── sp_product_deactivate.sql
├── src/
│   ├── auth.config.ts       (modified — `authorized` callback)
│   ├── middleware.ts        (modified — matcher gains /inventario)
│   ├── lib/db/procedures/products.ts
│   ├── components/
│   │   ├── CurrencyAmountInput.tsx
│   │   └── inventory/
│   │       ├── ProductRow.tsx
│   │       └── ProductForm.tsx
│   └── app/inventario/
│       ├── page.tsx
│       ├── inventory-client.tsx
│       └── actions.ts
└── tests/db/procedures/products.test.ts
```

---

### Task 1: Middleware access-control hardening (carried over from Fase 0b's final review)

**Files:**
- Modify: `src/auth.config.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Consume: the shared `authConfig.callbacks` object (Fase 0b, Task 5) — both `src/auth.ts` and `src/middleware.ts` already import it, so adding a callback here protects both automatically with no other file changes.

- [ ] **Step 1: Add the `authorized` callback**

Read `src/auth.config.ts` first (it currently has `session`, `trustHost`, `pages`, `jwt`, `session` callbacks — no `authorized`). Add one more callback to the existing `callbacks` object:
```ts
authorized({ auth }) {
  return Boolean(auth?.user);
},
```
Place it alongside the existing `jwt`/`session` callbacks inside `authConfig.callbacks`.

- [ ] **Step 2: Extend the middleware matcher**

Modify `src/middleware.ts`'s `config.matcher` to add this phase's new protected route:
```ts
export const config = {
  matcher: ['/onboarding/:path*', '/hogar/:path*', '/inventario/:path*'],
};
```

- [ ] **Step 3: Verify the gate actually redirects**

Run: `npm run build` (must succeed — this exercises the middleware bundle same as Fase 0b did).

Run: `npm run start` in one terminal (production server, since Fase 0b established that middleware/edge behavior should be checked against a real build, not `next dev`). In another shell:
```bash
curl -i http://localhost:3000/onboarding
```
Expected: **`307`** (or `302`) redirect to `/login` (previously this returned `200` with the onboarding form, per Fase 0b's documented gap). Confirm the `Location` header points at `/login`.

Then confirm authenticated access still works exactly as before (reuse Fase 0b's verification technique): get a real session cookie via `/api/auth/csrf` + `/api/auth/callback/credentials` with a real registered user, then:
```bash
curl -i -b <cookie-jar> http://localhost:3000/onboarding
```
Expected: `200` with the onboarding form HTML (unauthenticated redirect must not also block *authenticated* access — this is the regression this step exists to catch). Stop the production server when done.

- [ ] **Step 4: Run full suite and commit**

Run: `npm test`
Expected: 29/29 still passing (no test files added — this is a config-only change verified by the manual curl checks above, consistent with how Fase 0b's own middleware fix was verified).

```bash
git add -A
git commit -m "fix(auth): add authorized callback so middleware actually redirects unauthenticated requests"
```

---

### Task 2: Esquema de inventario (categorías, unidades, productos)

**Files:**
- Create: `db/migrations/003_inventory.sql`

**Interfaces:**
- Consume: `households`, `household_members` (Fase 0a), `currencies` (Fase 0a) — `products.default_price_currency_id` is a nullable FK to `currencies(id)`.

- [ ] **Step 1: Write the migration**

Create `db/migrations/003_inventory.sql`:
```sql
CREATE TABLE product_categories (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO product_categories (name) VALUES
  ('Despensa'), ('Limpieza'), ('Higiene personal'), ('Bebidas'), ('Congelados'), ('Otros');

CREATE TABLE units_of_measure (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO units_of_measure (code, name) VALUES
  ('unidad', 'Unidad'), ('kg', 'Kilogramo'), ('g', 'Gramo'),
  ('l', 'Litro'), ('ml', 'Mililitro'), ('paquete', 'Paquete'), ('docena', 'Docena');

CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_id SMALLINT UNSIGNED NOT NULL,
  unit_id SMALLINT UNSIGNED NOT NULL,
  optimal_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  current_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  default_price DECIMAL(12,2) NULL,
  default_price_currency_id TINYINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_member_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_household FOREIGN KEY (household_id) REFERENCES households(id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES product_categories(id),
  CONSTRAINT fk_products_unit FOREIGN KEY (unit_id) REFERENCES units_of_measure(id),
  CONSTRAINT fk_products_currency FOREIGN KEY (default_price_currency_id) REFERENCES currencies(id),
  CONSTRAINT fk_products_created_by FOREIGN KEY (created_by_member_id) REFERENCES household_members(id),
  CONSTRAINT chk_products_quantities CHECK (optimal_quantity >= 0 AND current_quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Apply and verify**

Run: `npm run db:migrate`
Expected: `applied migration: 003_inventory.sql`.

Run: `"/c/xampp/mysql/bin/mysql.exe" -h 127.0.0.1 -P 3307 -u root finanzhome -e "SELECT name FROM product_categories; SELECT code FROM units_of_measure;"`
Expected: 6 category rows, 7 unit rows as seeded above.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): add inventory schema (categories, units, products) with seed data"
```

---

### Task 3: Stored procedures de catálogo (categorías/unidades) + wrapper + tests

**Files:**
- Create: `db/procedures/sp_category_list.sql`, `db/procedures/sp_category_create.sql`, `db/procedures/sp_unit_list.sql`
- Create: `src/lib/db/procedures/products.ts` (catalog portion only — product functions land in Task 4)
- Test: `tests/db/procedures/products.test.ts` (catalog portion only)

**Interfaces:**
- Produce: `listCategories`, `createCategory`, `listUnits` — consumed by Task 4's product SPs' tests and by Task 5/6's UI

- [ ] **Step 1: SPs**

Create `db/procedures/sp_category_list.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_category_list;

CREATE PROCEDURE sp_category_list()
BEGIN
  SELECT id, name FROM product_categories ORDER BY name;
END;
```

Create `db/procedures/sp_category_create.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_category_create;

CREATE PROCEDURE sp_category_create(
  IN p_name VARCHAR(100)
)
BEGIN
  INSERT INTO product_categories (name) VALUES (p_name);
  SELECT id, name FROM product_categories WHERE id = LAST_INSERT_ID();
END;
```

Create `db/procedures/sp_unit_list.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_unit_list;

CREATE PROCEDURE sp_unit_list()
BEGIN
  SELECT id, code, name FROM units_of_measure ORDER BY name;
END;
```

- [ ] **Step 2: Apply**

Run: `npm run db:migrate`
Expected: 3 lines `loaded procedure: sp_*.sql`.

- [ ] **Step 3: Wrapper (catalog portion)**

Create `src/lib/db/procedures/products.ts`:
```ts
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface ProductCategoryRecord extends RowDataPacket {
  id: number;
  name: string;
}

export interface UnitOfMeasureRecord extends RowDataPacket {
  id: number;
  code: string;
  name: string;
}

export async function listCategories(): Promise<ProductCategoryRecord[]> {
  return callProcedure<ProductCategoryRecord>('sp_category_list');
}

export async function createCategory(name: string): Promise<ProductCategoryRecord> {
  const rows = await callProcedure<ProductCategoryRecord>('sp_category_create', [name]);
  return rows[0];
}

export async function listUnits(): Promise<UnitOfMeasureRecord[]> {
  return callProcedure<UnitOfMeasureRecord>('sp_unit_list');
}
```

- [ ] **Step 4: Tests**

Create `tests/db/procedures/products.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createCategory, listCategories, listUnits } from '@/lib/db/procedures/products';
import { uniqueSuffix } from '../../helpers/db';

describe('product catalog procedures', () => {
  it('lists the seeded categories', async () => {
    const categories = await listCategories();
    expect(categories.map((c) => c.name)).toContain('Despensa');
  });

  it('lists the seeded units', async () => {
    const units = await listUnits();
    expect(units.map((u) => u.code)).toContain('kg');
  });

  it('creates a new category', async () => {
    const name = `Categoria ${uniqueSuffix()}`;
    const created = await createCategory(name);
    expect(created.name).toBe(name);

    const categories = await listCategories();
    expect(categories.map((c) => c.id)).toContain(created.id);
  });
});
```

Run: `npm test -- products.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Run full suite and commit**

Run: `npm test`
Expected: 29 + 3 = 32/32.

```bash
git add -A
git commit -m "feat(db): add product category and unit-of-measure procedures with tests"
```

---

### Task 4: Stored procedures de productos + wrapper + tests

**Files:**
- Create: `db/procedures/sp_product_list.sql`, `db/procedures/sp_product_create.sql`, `db/procedures/sp_product_update.sql`, `db/procedures/sp_product_update_current_quantity.sql`, `db/procedures/sp_product_deactivate.sql`
- Modify: `src/lib/db/procedures/products.ts` (add product functions)
- Modify: `tests/db/procedures/products.test.ts` (add product test cases)

**Interfaces:**
- Consume: `registerUser`, `createHousehold`, `getHouseholdsForUser` (Fase 0a) — tests build a real household/member to scope products to
- Produce: `listProducts`, `createProduct`, `updateProduct`, `updateCurrentQuantity`, `deactivateProduct` — consumed by Tasks 5/6's Server Actions

- [ ] **Step 1: SPs**

Create `db/procedures/sp_product_list.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_product_list;

CREATE PROCEDURE sp_product_list(
  IN p_household_id INT UNSIGNED
)
BEGIN
  SELECT
    p.id, p.household_id, p.name, p.category_id, c.name AS category_name,
    p.unit_id, u.code AS unit_code, u.name AS unit_name,
    p.optimal_quantity, p.current_quantity, p.default_price, p.default_price_currency_id,
    p.is_active, p.created_by_member_id, p.created_at
  FROM products p
  INNER JOIN product_categories c ON c.id = p.category_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE p.household_id = p_household_id AND p.is_active = 1
  ORDER BY c.name, p.name;
END;
```

Create `db/procedures/sp_product_create.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_product_create;

CREATE PROCEDURE sp_product_create(
  IN p_household_id INT UNSIGNED,
  IN p_name VARCHAR(150),
  IN p_category_id SMALLINT UNSIGNED,
  IN p_unit_id SMALLINT UNSIGNED,
  IN p_optimal_quantity DECIMAL(10,2),
  IN p_current_quantity DECIMAL(10,2),
  IN p_default_price DECIMAL(12,2),
  IN p_default_price_currency_id TINYINT UNSIGNED,
  IN p_created_by_member_id INT UNSIGNED
)
BEGIN
  INSERT INTO products (
    household_id, name, category_id, unit_id, optimal_quantity, current_quantity,
    default_price, default_price_currency_id, created_by_member_id
  ) VALUES (
    p_household_id, p_name, p_category_id, p_unit_id, p_optimal_quantity, p_current_quantity,
    p_default_price, p_default_price_currency_id, p_created_by_member_id
  );

  SELECT
    p.id, p.household_id, p.name, p.category_id, c.name AS category_name,
    p.unit_id, u.code AS unit_code, u.name AS unit_name,
    p.optimal_quantity, p.current_quantity, p.default_price, p.default_price_currency_id,
    p.is_active, p.created_by_member_id, p.created_at
  FROM products p
  INNER JOIN product_categories c ON c.id = p.category_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE p.id = LAST_INSERT_ID();
END;
```

Create `db/procedures/sp_product_update.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_product_update;

CREATE PROCEDURE sp_product_update(
  IN p_product_id INT UNSIGNED,
  IN p_name VARCHAR(150),
  IN p_category_id SMALLINT UNSIGNED,
  IN p_unit_id SMALLINT UNSIGNED,
  IN p_optimal_quantity DECIMAL(10,2),
  IN p_default_price DECIMAL(12,2),
  IN p_default_price_currency_id TINYINT UNSIGNED
)
BEGIN
  UPDATE products
  SET name = p_name,
      category_id = p_category_id,
      unit_id = p_unit_id,
      optimal_quantity = p_optimal_quantity,
      default_price = p_default_price,
      default_price_currency_id = p_default_price_currency_id
  WHERE id = p_product_id;

  SELECT
    p.id, p.household_id, p.name, p.category_id, c.name AS category_name,
    p.unit_id, u.code AS unit_code, u.name AS unit_name,
    p.optimal_quantity, p.current_quantity, p.default_price, p.default_price_currency_id,
    p.is_active, p.created_by_member_id, p.created_at
  FROM products p
  INNER JOIN product_categories c ON c.id = p.category_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE p.id = p_product_id;
END;
```

Create `db/procedures/sp_product_update_current_quantity.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_product_update_current_quantity;

CREATE PROCEDURE sp_product_update_current_quantity(
  IN p_product_id INT UNSIGNED,
  IN p_current_quantity DECIMAL(10,2)
)
BEGIN
  IF p_current_quantity < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Current quantity cannot be negative';
  END IF;

  UPDATE products SET current_quantity = p_current_quantity WHERE id = p_product_id;

  SELECT
    p.id, p.household_id, p.name, p.category_id, c.name AS category_name,
    p.unit_id, u.code AS unit_code, u.name AS unit_name,
    p.optimal_quantity, p.current_quantity, p.default_price, p.default_price_currency_id,
    p.is_active, p.created_by_member_id, p.created_at
  FROM products p
  INNER JOIN product_categories c ON c.id = p.category_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE p.id = p_product_id;
END;
```

Create `db/procedures/sp_product_deactivate.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_product_deactivate;

CREATE PROCEDURE sp_product_deactivate(
  IN p_product_id INT UNSIGNED
)
BEGIN
  UPDATE products SET is_active = 0 WHERE id = p_product_id;
END;
```

- [ ] **Step 2: Apply**

Run: `npm run db:migrate`
Expected: 5 lines `loaded procedure: sp_product_*.sql`.

- [ ] **Step 3: Extend the wrapper**

Modify `src/lib/db/procedures/products.ts`, append:
```ts
export interface ProductRecord extends RowDataPacket {
  id: number;
  household_id: number;
  name: string;
  category_id: number;
  category_name: string;
  unit_id: number;
  unit_code: string;
  unit_name: string;
  optimal_quantity: number;
  current_quantity: number;
  default_price: number | null;
  default_price_currency_id: number | null;
  is_active: number;
  created_by_member_id: number;
  created_at: string;
}

export async function listProducts(householdId: number): Promise<ProductRecord[]> {
  return callProcedure<ProductRecord>('sp_product_list', [householdId]);
}

export async function createProduct(params: {
  householdId: number;
  name: string;
  categoryId: number;
  unitId: number;
  optimalQuantity: number;
  currentQuantity: number;
  defaultPrice: number | null;
  defaultPriceCurrencyId: number | null;
  createdByMemberId: number;
}): Promise<ProductRecord> {
  const rows = await callProcedure<ProductRecord>('sp_product_create', [
    params.householdId,
    params.name,
    params.categoryId,
    params.unitId,
    params.optimalQuantity,
    params.currentQuantity,
    params.defaultPrice,
    params.defaultPriceCurrencyId,
    params.createdByMemberId,
  ]);
  return rows[0];
}

export async function updateProduct(params: {
  productId: number;
  name: string;
  categoryId: number;
  unitId: number;
  optimalQuantity: number;
  defaultPrice: number | null;
  defaultPriceCurrencyId: number | null;
}): Promise<ProductRecord> {
  const rows = await callProcedure<ProductRecord>('sp_product_update', [
    params.productId,
    params.name,
    params.categoryId,
    params.unitId,
    params.optimalQuantity,
    params.defaultPrice,
    params.defaultPriceCurrencyId,
  ]);
  return rows[0];
}

export async function updateCurrentQuantity(
  productId: number,
  currentQuantity: number,
): Promise<ProductRecord> {
  const rows = await callProcedure<ProductRecord>('sp_product_update_current_quantity', [
    productId,
    currentQuantity,
  ]);
  return rows[0];
}

export async function deactivateProduct(productId: number): Promise<void> {
  await callProcedure('sp_product_deactivate', [productId]);
}
```

- [ ] **Step 4: Extend the tests**

Modify `tests/db/procedures/products.test.ts`, add a helper and new cases:
```ts
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import {
  createProduct,
  deactivateProduct,
  listProducts,
  updateCurrentQuantity,
} from '@/lib/db/procedures/products';

async function createMember(suffix: string): Promise<{ householdId: number; memberId: number }> {
  const user = await registerUser({
    email: `product_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
    creatorPaymentDay: 5,
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id };
}

describe('product procedures', () => {
  it('creates a product and lists it scoped to its household', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const product = await createProduct({
      householdId,
      name: `Arroz ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 2,
      currentQuantity: 0,
      defaultPrice: 1500,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    expect(product.name).toBe(`Arroz ${suffix}`);
    expect(product.category_name).toBe(category.name);

    const products = await listProducts(householdId);
    expect(products.map((p) => p.id)).toContain(product.id);
  });

  it('updates current quantity independently of the other fields', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const product = await createProduct({
      householdId,
      name: `Leche ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 4,
      currentQuantity: 1,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    const updated = await updateCurrentQuantity(product.id, 3);
    expect(updated.current_quantity).toBe(3);
    expect(updated.optimal_quantity).toBe(4);
  });

  it('rejects a negative current quantity', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const product = await createProduct({
      householdId,
      name: `Yogur ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 2,
      currentQuantity: 1,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    await expect(updateCurrentQuantity(product.id, -1)).rejects.toThrow();
  });

  it('deactivates a product so it no longer appears in the list', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const product = await createProduct({
      householdId,
      name: `Jabón ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 1,
      currentQuantity: 1,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    await deactivateProduct(product.id);

    const products = await listProducts(householdId);
    expect(products.map((p) => p.id)).not.toContain(product.id);
  });
});
```
(Add these `import`s to the top of the existing file alongside the ones already there from Task 3, and add this second `describe` block after the first.)

Run: `npm test -- products.test.ts`
Expected: PASS (7/7 total in this file — 3 from Task 3 + 4 new).

- [ ] **Step 5: Run full suite and commit**

Run: `npm test`
Expected: 32 + 4 = 36/36.

```bash
git add -A
git commit -m "feat(db): add product procedures (list, create, update, quantity, deactivate) with tests"
```

---

### Task 5: Página /inventario — lista agrupada por categoría con stepper de cantidad

**Files:**
- Create: `src/app/inventario/page.tsx`
- Create: `src/app/inventario/inventory-client.tsx`
- Create: `src/app/inventario/actions.ts`
- Create: `src/components/inventory/ProductRow.tsx`

**Interfaces:**
- Consume: `auth` (Fase 0b), `getHouseholdsForUser` (Fase 0a), `listProducts`/`listCategories`/`listUnits` (Task 3/4), `showError` (Fase 0b's `src/lib/ui/alerts.ts` — its first real consumer)
- Produce: `updateCurrentQuantityAction`, a `requireMembership()` helper reused by Task 6

- [ ] **Step 1: Server Actions (with the shared membership helper)**

Create `src/app/inventario/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { getHouseholdsForUser, type HouseholdForUserRecord } from '@/lib/db/procedures/household';
import { updateCurrentQuantity } from '@/lib/db/procedures/products';

export async function requireMembership(): Promise<HouseholdForUserRecord> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('No autenticado');
  }
  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    throw new Error('No pertenecés a ningún hogar todavía');
  }
  return membership;
}

export async function updateCurrentQuantityAction(productId: number, quantity: number): Promise<void> {
  await requireMembership();
  await updateCurrentQuantity(productId, Math.max(0, quantity));
  revalidatePath('/inventario');
}
```

- [ ] **Step 2: Product row with optimistic stepper**

Create `src/components/inventory/ProductRow.tsx`:
```tsx
'use client';

import { useTransition } from 'react';
import { updateCurrentQuantityAction } from '@/app/inventario/actions';
import { showError } from '@/lib/ui/alerts';
import type { ProductRecord } from '@/lib/db/procedures/products';

export function ProductRow({
  product,
  onEdit,
}: {
  product: ProductRecord;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function adjust(delta: number): void {
    const next = Math.max(0, Number(product.current_quantity) + delta);
    startTransition(() => {
      updateCurrentQuantityAction(product.id, next).catch(() => {
        showError('No se pudo actualizar la cantidad. Intentá de nuevo.');
      });
    });
  }

  const isLow = Number(product.current_quantity) < Number(product.optimal_quantity);

  return (
    <li
      className={`list-group-item d-flex justify-content-between align-items-center ${
        isLow ? 'bg-warning-subtle' : ''
      }`}
    >
      <button
        type="button"
        className="btn btn-link text-start text-decoration-none p-0 flex-grow-1 text-body"
        onClick={onEdit}
      >
        <div className="fw-semibold">{product.name}</div>
        <div className="text-body-secondary small">
          {product.current_quantity} / {product.optimal_quantity} {product.unit_code}
        </div>
      </button>
      <div className="d-flex align-items-center gap-2">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isPending}
          onClick={() => adjust(-1)}
          aria-label="Restar uno"
        >
          <i className="bi bi-dash" />
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isPending}
          onClick={() => adjust(1)}
          aria-label="Sumar uno"
        >
          <i className="bi bi-plus" />
        </button>
      </div>
    </li>
  );
}
```

- [ ] **Step 3: Client wrapper (list grouped by category — panel wiring comes in Task 6)**

Create `src/app/inventario/inventory-client.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { ProductRow } from '@/components/inventory/ProductRow';
import type { ProductCategoryRecord, ProductRecord, UnitOfMeasureRecord } from '@/lib/db/procedures/products';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

export function InventoryClient({
  products,
  categories,
  units,
  currencies,
}: {
  products: ProductRecord[];
  categories: ProductCategoryRecord[];
  units: UnitOfMeasureRecord[];
  currencies: CurrencyRecord[];
}) {
  const [panel, setPanel] = useState<{ mode: 'create' } | { mode: 'edit'; product: ProductRecord } | null>(
    null,
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ProductRecord[]>();
    for (const product of products) {
      const list = map.get(product.category_name) ?? [];
      list.push(product);
      map.set(product.category_name, list);
    }
    return map;
  }, [products]);

  return (
    <main className="container-fluid px-3 py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Inventario</h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPanel({ mode: 'create' })}>
          <i className="bi bi-plus-lg me-1" />
          Producto
        </button>
      </div>

      {[...grouped.entries()].map(([categoryName, items]) => (
        <section key={categoryName} className="mb-4">
          <h2 className="h6 text-body-secondary text-uppercase">{categoryName}</h2>
          <ul className="list-group">
            {items.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onEdit={() => setPanel({ mode: 'edit', product })}
              />
            ))}
          </ul>
        </section>
      ))}

      {products.length === 0 ? (
        <p className="text-body-secondary">Todavía no cargaste productos.</p>
      ) : null}

      {panel ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1050 }}
        >
          <div className="bg-body w-100 p-3 rounded-top" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">{panel.mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</h2>
              <button type="button" className="btn-close" onClick={() => setPanel(null)} aria-label="Cerrar" />
            </div>
            {/* ProductForm is wired in Task 6 */}
          </div>
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4: Page (server component)**

Create `src/app/inventario/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHouseholdsForUser } from '@/lib/db/procedures/household';
import { listCategories, listProducts, listUnits } from '@/lib/db/procedures/products';
import { listCurrencies } from '@/lib/db/procedures/currency';
import { InventoryClient } from './inventory-client';

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    redirect('/onboarding');
  }

  const [products, categories, units, currencies] = await Promise.all([
    listProducts(membership.id),
    listCategories(),
    listUnits(),
    listCurrencies(),
  ]);

  return (
    <InventoryClient products={products} categories={categories} units={units} currencies={currencies} />
  );
}
```

- [ ] **Step 5: Manual verification (real data, not just page render)**

Run: `npm run dev`. Using the same curl+cookie technique from Fase 0b (register/login a test user, create a household, note its ID), create at least one product directly via a short-lived script calling `createProduct` (delete the script after), then load `GET /inventario` with the authenticated cookie and confirm the product appears under its category heading with the correct `current/optimal unit` text. Then drive the stepper: since `updateCurrentQuantityAction` is a direct Server Action call (not a form), it can't be curl-driven the way Task 5 of Fase 0b drove a `$ACTION_ID_...` form — instead, verify this one by calling `updateCurrentQuantity` (the DB wrapper) directly from a short-lived script to confirm the SP behaves, AND confirm via `npm run build` that the route compiles with no server/client boundary errors (a `'use server'` action imported into a `'use client'` component is exactly the kind of thing that fails loudly at build time if miswired). Stop the dev server when done; delete any throwaway script.

- [ ] **Step 6: Run full suite and build, then commit**

Run: `npm test`
Expected: 36/36 (no new automated tests this task — UI wiring, consistent with prior UI-only tasks' documented convention).

Run: `npm run build`
Expected: succeeds; `/inventario` appears as a dynamic (`ƒ`) route (it reads the session).

```bash
git add -A
git commit -m "feat(inventory): add /inventario page with category-grouped list and quantity stepper"
```

---

### Task 6: Formulario de producto (crear + editar) con selector de moneda

**Files:**
- Create: `src/components/CurrencyAmountInput.tsx`
- Create: `src/components/inventory/ProductForm.tsx`
- Modify: `src/app/inventario/actions.ts` (add `createProductAction`, `updateProductAction`)
- Modify: `src/app/inventario/inventory-client.tsx` (mount `ProductForm` inside the panel)

**Interfaces:**
- Consume: `createProduct`, `updateProduct` (Task 4), `listCurrencies` (Fase 0a), `requireMembership` (Task 5)
- Produce: `<CurrencyAmountInput>` — the master plan's reusable component, first used here, expected to be reused by Fases 2/5/9's forms (gasto, meta de ahorro) without modification to this file

- [ ] **Step 1: Reusable currency input**

Create `src/components/CurrencyAmountInput.tsx`:
```tsx
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

export function CurrencyAmountInput({
  amountName,
  currencyName,
  currencies,
  defaultAmount,
  defaultCurrencyId,
}: {
  amountName: string;
  currencyName: string;
  currencies: CurrencyRecord[];
  defaultAmount?: number | null;
  defaultCurrencyId?: number | null;
}) {
  return (
    <div className="input-group">
      <input
        type="number"
        step="0.01"
        min={0}
        name={amountName}
        defaultValue={defaultAmount ?? undefined}
        className="form-control"
        placeholder="0.00"
      />
      <select
        name={currencyName}
        className="form-select flex-grow-0"
        style={{ maxWidth: 100 }}
        defaultValue={defaultCurrencyId ?? ''}
      >
        <option value="" disabled>
          —
        </option>
        {currencies.map((currency) => (
          <option key={currency.id} value={currency.id}>
            {currency.symbol} {currency.code}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Server Actions for create/update**

Modify `src/app/inventario/actions.ts`, append:
```ts
import { z } from 'zod';
import { createProduct, updateProduct } from '@/lib/db/procedures/products';

const createProductSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(150),
  categoryId: z.coerce.number().int().positive(),
  unitId: z.coerce.number().int().positive(),
  optimalQuantity: z.coerce.number().min(0),
  currentQuantity: z.coerce.number().min(0),
  defaultPrice: z.coerce.number().min(0).optional(),
  defaultPriceCurrencyId: z.coerce.number().int().positive().optional(),
});

export interface CreateProductState {
  error: string | null;
}

export async function createProductAction(
  _prevState: CreateProductState,
  formData: FormData,
): Promise<CreateProductState> {
  const membership = await requireMembership();

  const parsed = createProductSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    unitId: formData.get('unitId'),
    optimalQuantity: formData.get('optimalQuantity'),
    currentQuantity: formData.get('currentQuantity') || 0,
    defaultPrice: formData.get('defaultPrice') || undefined,
    defaultPriceCurrencyId: formData.get('defaultPriceCurrencyId') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  await createProduct({
    householdId: membership.id,
    name: parsed.data.name,
    categoryId: parsed.data.categoryId,
    unitId: parsed.data.unitId,
    optimalQuantity: parsed.data.optimalQuantity,
    currentQuantity: parsed.data.currentQuantity,
    defaultPrice: parsed.data.defaultPrice ?? null,
    defaultPriceCurrencyId: parsed.data.defaultPriceCurrencyId ?? null,
    createdByMemberId: membership.member_id,
  });

  revalidatePath('/inventario');
  return { error: null };
}

const updateProductSchema = z.object({
  productId: z.coerce.number().int().positive(),
  name: z.string().min(1, 'El nombre es obligatorio').max(150),
  categoryId: z.coerce.number().int().positive(),
  unitId: z.coerce.number().int().positive(),
  optimalQuantity: z.coerce.number().min(0),
  defaultPrice: z.coerce.number().min(0).optional(),
  defaultPriceCurrencyId: z.coerce.number().int().positive().optional(),
});

export interface UpdateProductState {
  error: string | null;
}

export async function updateProductAction(
  _prevState: UpdateProductState,
  formData: FormData,
): Promise<UpdateProductState> {
  await requireMembership();

  const parsed = updateProductSchema.safeParse({
    productId: formData.get('productId'),
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    unitId: formData.get('unitId'),
    optimalQuantity: formData.get('optimalQuantity'),
    defaultPrice: formData.get('defaultPrice') || undefined,
    defaultPriceCurrencyId: formData.get('defaultPriceCurrencyId') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  await updateProduct({
    productId: parsed.data.productId,
    name: parsed.data.name,
    categoryId: parsed.data.categoryId,
    unitId: parsed.data.unitId,
    optimalQuantity: parsed.data.optimalQuantity,
    defaultPrice: parsed.data.defaultPrice ?? null,
    defaultPriceCurrencyId: parsed.data.defaultPriceCurrencyId ?? null,
  });

  revalidatePath('/inventario');
  return { error: null };
}
```
`requireMembership` is already defined earlier in this same file (Task 5) — no new import needed for it.

- [ ] **Step 3: The form component**

Create `src/components/inventory/ProductForm.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import {
  createProductAction,
  updateProductAction,
  type CreateProductState,
  type UpdateProductState,
} from '@/app/inventario/actions';
import { CurrencyAmountInput } from '@/components/CurrencyAmountInput';
import type { ProductCategoryRecord, ProductRecord, UnitOfMeasureRecord } from '@/lib/db/procedures/products';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

const initialState: CreateProductState | UpdateProductState = { error: null };

export function ProductForm({
  mode,
  product,
  categories,
  units,
  currencies,
}: {
  mode: 'create' | 'edit';
  product?: ProductRecord;
  categories: ProductCategoryRecord[];
  units: UnitOfMeasureRecord[];
  currencies: CurrencyRecord[];
}) {
  const action = mode === 'create' ? createProductAction : updateProductAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="d-flex flex-column gap-3">
      {mode === 'edit' && product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <div>
        <label htmlFor="name" className="form-label">Nombre</label>
        <input id="name" name="name" type="text" defaultValue={product?.name} className="form-control" required />
      </div>
      <div>
        <label htmlFor="categoryId" className="form-label">Categoría</label>
        <select id="categoryId" name="categoryId" defaultValue={product?.category_id} className="form-select" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="unitId" className="form-label">Unidad</label>
        <select id="unitId" name="unitId" defaultValue={product?.unit_id} className="form-select" required>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="optimalQuantity" className="form-label">Cantidad óptima</label>
        <input
          id="optimalQuantity"
          name="optimalQuantity"
          type="number"
          step="0.01"
          min={0}
          defaultValue={product?.optimal_quantity}
          className="form-control"
          required
        />
      </div>
      {mode === 'create' ? (
        <div>
          <label htmlFor="currentQuantity" className="form-label">Cantidad actual</label>
          <input
            id="currentQuantity"
            name="currentQuantity"
            type="number"
            step="0.01"
            min={0}
            defaultValue={0}
            className="form-control"
          />
        </div>
      ) : null}
      <div>
        <label className="form-label">Precio de referencia (opcional)</label>
        <CurrencyAmountInput
          amountName="defaultPrice"
          currencyName="defaultPriceCurrencyId"
          currencies={currencies}
          defaultAmount={product?.default_price}
          defaultCurrencyId={product?.default_price_currency_id}
        />
      </div>
      {state.error ? (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {state.error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Guardando…' : mode === 'create' ? 'Agregar producto' : 'Guardar cambios'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Wire the form into the panel**

Modify `src/app/inventario/inventory-client.tsx`: import `ProductForm` and replace the `{/* ProductForm is wired in Task 6 */}` placeholder comment with:
```tsx
<ProductForm
  mode={panel.mode}
  product={panel.mode === 'edit' ? panel.product : undefined}
  categories={categories}
  units={units}
  currencies={currencies}
/>
```

- [ ] **Step 5: Manual verification (real form submission, real DB rows)**

Run: `npm run dev`. Reuse the Fase 0b curl technique (real session cookie via csrf+credentials) to drive the real `createProductAction`/`updateProductAction` the same way Task 5 of Fase 0b drove `createHouseholdAction` — find the rendered `$ACTION_ID_...` field for each form and POST to it with real field values, then query `finanzhome.products` directly to confirm a row was created/updated with the correct `category_id`/`unit_id`/`default_price`/`default_price_currency_id`. This is the bar: prove real rows change, not just that the panel opens. Stop the dev server and clean up any throwaway scripts when done.

- [ ] **Step 6: Run full suite and build, then commit**

Run: `npm test`
Expected: 36/36 (no new automated tests — this is UI/Server-Action wiring over already-tested DB procedures, consistent with this project's established testing boundary).

Run: `npm run build`
Expected: succeeds with no new errors.

```bash
git add -A
git commit -m "feat(inventory): add product create/edit form with reusable currency amount input"
```

---

## Self-Review

**Cobertura:** productos con categoría/unidad/cantidad óptima fija/cantidad actual editable ✓ (Tasks 2-4). UI mobile-first con lista agrupada y stepper ✓ (Task 5). Alta y edición con precio en cualquier moneda ✓ (Task 6). Middleware access-control gap from Fase 0b's final review ✓ (Task 1, done first as recommended).

**Placeholders:** none — every step has complete code. The one open item ("ProductForm is wired in Task 6") is a real placeholder comment *in the code the plan tells you to write in Task 5*, deliberately replaced in Task 6 Step 4 — not a plan placeholder.

**Testing honesty:** Tasks 5 and 6 (UI/Server Action layer) explicitly document that no new automated tests are added, consistent with the "test the core, trust the framework glue" boundary established in Fase 0b — every piece of new *logic* (category/unit/product CRUD, quantity validation) has a real test against the real MariaDB instance in Tasks 3-4.

**Type consistency:** `ProductRecord` (Task 4) is used identically by `ProductRow`, `InventoryClient`, `ProductForm`, and both page/action files — no duplicate or drifted shape. `CreateProductState`/`UpdateProductState` both follow the `{ error: string | null }` shape established by every prior phase's Server Action state type.

## Qué sigue

With Inventario done, Fase 2 (Lista de compras inteligente) is next per the master plan — it reads `products.optimal_quantity - products.current_quantity` to auto-generate the shopping list, reuses `<CurrencyAmountInput>` for item prices, and is where `zustand` finally gets installed (client-side cart-in-progress state).

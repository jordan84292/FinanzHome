# FinanzHome — Fase 2: Lista de Compras Inteligente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate a shopping list from inventory deficits (`optimal_quantity - current_quantity`), let the household edit it (add extras, adjust quantity/price, remove items) with a running total in a chosen display currency, and confirm the purchase — which atomically applies every item's quantity back onto `products.current_quantity`.

**Architecture:** Same layering as every prior phase: stored procedures own the business rules (deficit calculation, currency conversion, atomic inventory bump), a thin `src/lib/db/procedures/shopping-list.ts` wrapper calls them via `callProcedure`, Server Actions in `src/app/compras/actions.ts` derive the household from the session and re-fetch after every mutation (`revalidatePath`), and the UI reuses Fase 1's slide-up panel + `<CurrencyAmountInput>` patterns rather than inventing new ones.

**Tech Stack:** No new dependencies. `zustand` (mentioned as a maybe in the master plan) is deliberately NOT installed — every edit in this phase persists immediately via its own Server Action call (same pattern as Fase 1's quantity stepper), so there's no in-progress client-only cart state that would need a store; see Global Constraints.

## Global Constraints

- **DB-first, no ORM** (carried over): all shopping-list logic lives in stored procedures, invoked only via `callProcedure`.
- **Every mutating (and reading) shopping-list procedure is household-scoped, no exceptions.** This project has already found and fixed one real cross-tenant bug (Fase 1's inventory IDOR) and caught a near-miss in Fase 1b's final review. Every procedure in this phase that touches `shopping_lists`/`shopping_list_items` takes `p_household_id` and verifies ownership via `SELECT COUNT(*) INTO v_exists ... IF v_exists = 0 THEN SIGNAL ...` **before** any read or mutation — this is not optional per-procedure judgment, it's the estables project-wide pattern now. Every Server Action derives `householdId` from the session (`requireMembership()`), never from client input.
- **Multi-currency, correlated-subquery/local-variable pattern (carried over from Fase 0):** no stored `FUNCTION` (avoids the `log_bin_trust_function_creators` gotcha already documented). Currency IDs are hardcoded as `1 = CRC`, `2 = USD` in the conversion `CASE` expressions in this phase's procedures — confirmed stable seed data from Fase 0a (`SELECT id, code FROM currencies` → `1/CRC`, `2/USD`), never modified since. This is a deliberate simplification specific to a fixed two-currency system; flag it in a comment if a third currency is ever added.
- **The JSON+WHILE pattern is used exactly once, in `sp_shopping_list_confirm`** (the one place a variable-length array — the list's items at confirmation time — needs to reach a single atomic stored procedure call). Every other multi-item interaction (add one item, edit one item, delete one item) is its own Server Action call with its own household-scoped procedure, matching the "small N → loop wrapper calls" pattern from Fase 0/1 rather than JSON.
- **Immediate persistence, no client-side draft state:** editing an item's quantity/price, adding an extra item, or deleting an item each persists to the DB the moment the user acts (own Server Action + `revalidatePath`), exactly like Fase 1's inventory stepper. By the time "Confirmar compra" is tapped, the DB already holds the final state — the confirm action derives the items to apply from the DB itself (`getShoppingListItems`), it does not trust a client-submitted items array for the actual confirm payload (the JSON parameter into `sp_shopping_list_confirm` is server-constructed from already-validated, already-household-scoped rows).
- **Mobile-first, using the dark/gradient design system from Fase 1b** — no new visual work needed beyond reusing existing Bootstrap classes and the established slide-up panel; the gradient/glow signature stays confined to its two existing locations (`.btn-primary`, active bottom-nav item) — don't add a third.

---

## File Structure

```
FinanzHome/
├── db/
│   ├── migrations/005_shopping_lists.sql
│   └── procedures/
│       ├── sp_shopping_list_generate.sql
│       ├── sp_shopping_list_get.sql
│       ├── sp_shopping_list_items_get.sql
│       ├── sp_shopping_list_add_item.sql
│       ├── sp_shopping_list_item_update.sql
│       ├── sp_shopping_list_item_delete.sql
│       └── sp_shopping_list_confirm.sql
├── src/
│   ├── lib/
│   │   ├── db/procedures/shopping-list.ts
│   │   └── household/require-membership.ts    (new — extracted, see Task 5)
│   ├── app/
│   │   ├── inventario/actions.ts               (modified — imports the extracted helper)
│   │   └── compras/
│   │       ├── page.tsx
│   │       ├── actions.ts
│   │       └── shopping-list-client.tsx
│   └── components/shopping-list/
│       ├── ShoppingListItemRow.tsx
│       └── ShoppingListItemForm.tsx
└── tests/db/procedures/shopping-list.test.ts
```

---

### Task 1: Esquema de lista de compras

**Files:**
- Create: `db/migrations/005_shopping_lists.sql`

**Interfaces:** none — pure schema, consumed by every later task.

- [ ] **Step 1: Migration**

Create `db/migrations/005_shopping_lists.sql`:
```sql
CREATE TABLE shopping_lists (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id INT UNSIGNED NOT NULL,
  status ENUM('open', 'confirmed', 'cancelled') NOT NULL DEFAULT 'open',
  created_by_member_id INT UNSIGNED NOT NULL,
  total_estimated DECIMAL(12,2) NULL,
  total_estimated_currency_id TINYINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME NULL,
  CONSTRAINT fk_shopping_lists_household FOREIGN KEY (household_id) REFERENCES households(id),
  CONSTRAINT fk_shopping_lists_created_by FOREIGN KEY (created_by_member_id) REFERENCES household_members(id),
  CONSTRAINT fk_shopping_lists_currency FOREIGN KEY (total_estimated_currency_id) REFERENCES currencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shopping_list_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shopping_list_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity_needed DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(12,2) NULL,
  unit_price_currency_id TINYINT UNSIGNED NULL,
  is_extra TINYINT(1) NOT NULL DEFAULT 0,
  is_purchased TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shopping_list_items_list FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id),
  CONSTRAINT fk_shopping_list_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_shopping_list_items_currency FOREIGN KEY (unit_price_currency_id) REFERENCES currencies(id),
  CONSTRAINT chk_shopping_list_items_quantity CHECK (quantity_needed > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
There is deliberately no unique/partial index enforcing "one open list per household" — MariaDB 10.4 has no filtered/partial unique index support. `sp_shopping_list_generate` (Task 2) enforces this in application logic instead (check-then-create).

Run: `npm run db:migrate` — expected: `applied migration: 005_shopping_lists.sql`.

Verify: `"/c/xampp/mysql/bin/mysql.exe" -h 127.0.0.1 -P 3307 -u root finanzhome -e "DESCRIBE shopping_lists; DESCRIBE shopping_list_items;"`.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(db): add shopping list schema (lists, items)"
```

---

### Task 2: SPs de generación y lectura + wrapper + tests

**Files:**
- Create: `db/procedures/sp_shopping_list_generate.sql`, `db/procedures/sp_shopping_list_get.sql`, `db/procedures/sp_shopping_list_items_get.sql`
- Create: `src/lib/db/procedures/shopping-list.ts` (generate/get/items-get portion — Tasks 3/4 append to this same file)
- Test: `tests/db/procedures/shopping-list.test.ts` (generate/get/items-get portion)

**Interfaces:**
- Consume: `registerUser`, `createHousehold`, `getHouseholdsForUser` (Fase 0a), `createCategory`/`listCategories`/`listUnits`/`createProduct` (Fase 1)
- Produce: `generateOrGetShoppingList`, `getShoppingList`, `getShoppingListItems` — consumed by Tasks 3-6

- [ ] **Step 1: SPs**

Create `db/procedures/sp_shopping_list_generate.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_generate;

CREATE PROCEDURE sp_shopping_list_generate(
  IN p_household_id INT UNSIGNED,
  IN p_created_by_member_id INT UNSIGNED
)
BEGIN
  DECLARE v_list_id INT UNSIGNED;
  DECLARE v_open_count INT;

  SELECT COUNT(*), MIN(id) INTO v_open_count, v_list_id
  FROM shopping_lists
  WHERE household_id = p_household_id AND status = 'open';

  IF v_open_count = 0 THEN
    INSERT INTO shopping_lists (household_id, status, created_by_member_id)
    VALUES (p_household_id, 'open', p_created_by_member_id);
    SET v_list_id = LAST_INSERT_ID();

    INSERT INTO shopping_list_items (shopping_list_id, product_id, quantity_needed, unit_price, unit_price_currency_id, is_extra)
    SELECT v_list_id, id, (optimal_quantity - current_quantity), default_price, default_price_currency_id, 0
    FROM products
    WHERE household_id = p_household_id AND is_active = 1 AND optimal_quantity > current_quantity;
  END IF;

  SELECT id, household_id, status, created_by_member_id, total_estimated, total_estimated_currency_id, created_at, confirmed_at
  FROM shopping_lists
  WHERE id = v_list_id;
END;
```
Note the deficit INSERT is a single set-based `INSERT ... SELECT` — no loop needed here; this is different from `sp_shopping_list_confirm` (Task 4), which genuinely needs the JSON+WHILE pattern because its input is a client-originated array, not a server-side query result.

Create `db/procedures/sp_shopping_list_get.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_get;

CREATE PROCEDURE sp_shopping_list_get(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_display_currency_id TINYINT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_rate DECIMAL(12,4);

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found in this household';
  END IF;

  SELECT rate_crc_per_usd INTO v_rate
  FROM exchange_rates
  WHERE effective_date <= CURDATE()
  ORDER BY effective_date DESC, id DESC
  LIMIT 1;

  SELECT
    sl.id, sl.household_id, sl.status, sl.created_by_member_id,
    sl.total_estimated, sl.total_estimated_currency_id, sl.created_at, sl.confirmed_at,
    (
      SELECT ROUND(SUM(
        sli.quantity_needed * IFNULL(sli.unit_price, 0) *
        CASE
          WHEN sli.unit_price_currency_id IS NULL OR sli.unit_price_currency_id = p_display_currency_id THEN 1
          WHEN sli.unit_price_currency_id = 2 THEN IFNULL(v_rate, 1)
          WHEN sli.unit_price_currency_id = 1 THEN 1 / IFNULL(v_rate, 1)
          ELSE 1
        END
      ), 2)
      FROM shopping_list_items sli
      WHERE sli.shopping_list_id = sl.id
    ) AS total_estimated_live
  FROM shopping_lists sl
  WHERE sl.id = p_shopping_list_id;
END;
```

Create `db/procedures/sp_shopping_list_items_get.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_items_get;

CREATE PROCEDURE sp_shopping_list_items_get(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_display_currency_id TINYINT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_rate DECIMAL(12,4);

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found in this household';
  END IF;

  SELECT rate_crc_per_usd INTO v_rate
  FROM exchange_rates
  WHERE effective_date <= CURDATE()
  ORDER BY effective_date DESC, id DESC
  LIMIT 1;

  SELECT
    sli.id, sli.shopping_list_id, sli.product_id, p.name AS product_name, u.code AS unit_code,
    sli.quantity_needed, sli.unit_price, sli.unit_price_currency_id,
    c.code AS unit_price_currency_code, c.symbol AS unit_price_currency_symbol,
    sli.is_extra, sli.is_purchased,
    ROUND(
      sli.quantity_needed * IFNULL(sli.unit_price, 0) *
      CASE
        WHEN sli.unit_price_currency_id IS NULL OR sli.unit_price_currency_id = p_display_currency_id THEN 1
        WHEN sli.unit_price_currency_id = 2 THEN IFNULL(v_rate, 1)
        WHEN sli.unit_price_currency_id = 1 THEN 1 / IFNULL(v_rate, 1)
        ELSE 1
      END,
    2) AS subtotal_in_display_currency
  FROM shopping_list_items sli
  INNER JOIN products p ON p.id = sli.product_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  LEFT JOIN currencies c ON c.id = sli.unit_price_currency_id
  WHERE sli.shopping_list_id = p_shopping_list_id
  ORDER BY sli.is_extra, p.name;
END;
```

Run: `npm run db:migrate` — expected: all 3 procedures load.

- [ ] **Step 2: Wrapper**

Create `src/lib/db/procedures/shopping-list.ts`:
```ts
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface ShoppingListRecord extends RowDataPacket {
  id: number;
  household_id: number;
  status: 'open' | 'confirmed' | 'cancelled';
  created_by_member_id: number;
  total_estimated: number | null;
  total_estimated_currency_id: number | null;
  created_at: string;
  confirmed_at: string | null;
  total_estimated_live: number | null;
}

export interface ShoppingListItemRecord extends RowDataPacket {
  id: number;
  shopping_list_id: number;
  product_id: number;
  product_name: string;
  unit_code: string;
  quantity_needed: number;
  unit_price: number | null;
  unit_price_currency_id: number | null;
  unit_price_currency_code: string | null;
  unit_price_currency_symbol: string | null;
  is_extra: number;
  is_purchased: number;
  subtotal_in_display_currency: number | null;
}

export async function generateOrGetShoppingList(
  householdId: number,
  createdByMemberId: number,
): Promise<ShoppingListRecord> {
  const rows = await callProcedure<ShoppingListRecord>('sp_shopping_list_generate', [
    householdId,
    createdByMemberId,
  ]);
  return rows[0];
}

export async function getShoppingList(
  shoppingListId: number,
  householdId: number,
  displayCurrencyId: number,
): Promise<ShoppingListRecord> {
  const rows = await callProcedure<ShoppingListRecord>('sp_shopping_list_get', [
    shoppingListId,
    householdId,
    displayCurrencyId,
  ]);
  return rows[0];
}

export async function getShoppingListItems(
  shoppingListId: number,
  householdId: number,
  displayCurrencyId: number,
): Promise<ShoppingListItemRecord[]> {
  return callProcedure<ShoppingListItemRecord>('sp_shopping_list_items_get', [
    shoppingListId,
    householdId,
    displayCurrencyId,
  ]);
}
```

- [ ] **Step 3: Tests (TDD)**

Create `tests/db/procedures/shopping-list.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { createProduct, listCategories, listUnits } from '@/lib/db/procedures/products';
import {
  generateOrGetShoppingList,
  getShoppingList,
  getShoppingListItems,
} from '@/lib/db/procedures/shopping-list';
import { uniqueSuffix } from '../../helpers/db';

const CRC_ID = 1;

async function createMember(suffix: string): Promise<{ householdId: number; memberId: number }> {
  const user = await registerUser({
    email: `shop_owner_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Owner',
  });
  const household = await createHousehold({
    name: `Casa ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Owner',
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return { householdId: household.id, memberId: membership.member_id };
}

describe('shopping list generate/get/items-get procedures', () => {
  it('generates a list containing only products with a real deficit', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();

    const shortProduct = await createProduct({
      householdId,
      name: `Arroz ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 5,
      currentQuantity: 2,
      defaultPrice: 1500,
      defaultPriceCurrencyId: CRC_ID,
      createdByMemberId: memberId,
    });
    await createProduct({
      householdId,
      name: `Sal ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 1,
      currentQuantity: 1,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    const list = await generateOrGetShoppingList(householdId, memberId);
    expect(list.status).toBe('open');

    const items = await getShoppingListItems(list.id, householdId, CRC_ID);
    expect(items).toHaveLength(1);
    expect(items[0].product_id).toBe(shortProduct.id);
    expect(items[0].quantity_needed).toBe(3);
  });

  it('is idempotent: a second call while a list is open returns the same list, not a new one', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    await createProduct({
      householdId,
      name: `Cafe ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 2,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });

    const first = await generateOrGetShoppingList(householdId, memberId);
    const second = await generateOrGetShoppingList(householdId, memberId);
    expect(second.id).toBe(first.id);
  });

  it('rejects fetching a list that belongs to a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createMember(suffixA);
    const { householdId: householdIdB } = await createMember(suffixB);

    const list = await generateOrGetShoppingList(householdIdA, memberIdA);

    await expect(getShoppingList(list.id, householdIdB, CRC_ID)).rejects.toThrow(/not found/i);
    await expect(getShoppingListItems(list.id, householdIdB, CRC_ID)).rejects.toThrow(/not found/i);
  });
});
```

Run: `npm test -- shopping-list.test.ts` — expected: PASS (3/3).

- [ ] **Step 4: Run full suite and commit**

Run: `npm test` — expected: 42 + 3 = 45/45 (measure the actual current count yourself before asserting the delta — don't assume 42 is still accurate if anything changed since Fase 1b).

```bash
git add -A
git commit -m "feat(db): add shopping list generation and read procedures with tests"
```

---

### Task 3: SPs de edición de ítems + wrapper + tests

**Files:**
- Create: `db/procedures/sp_shopping_list_add_item.sql`, `db/procedures/sp_shopping_list_item_update.sql`, `db/procedures/sp_shopping_list_item_delete.sql`
- Modify: `src/lib/db/procedures/shopping-list.ts` (append)
- Modify: `tests/db/procedures/shopping-list.test.ts` (append)

**Interfaces:**
- Produce: `addShoppingListItem`, `updateShoppingListItem`, `deleteShoppingListItem` — consumed by Task 5's UI

- [ ] **Step 1: SPs**

Create `db/procedures/sp_shopping_list_add_item.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_add_item;

CREATE PROCEDURE sp_shopping_list_add_item(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_product_id INT UNSIGNED,
  IN p_quantity_needed DECIMAL(10,2),
  IN p_unit_price DECIMAL(12,2),
  IN p_unit_price_currency_id TINYINT UNSIGNED,
  IN p_is_extra TINYINT(1)
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'open';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or not open';
  END IF;

  INSERT INTO shopping_list_items (shopping_list_id, product_id, quantity_needed, unit_price, unit_price_currency_id, is_extra)
  VALUES (p_shopping_list_id, p_product_id, p_quantity_needed, p_unit_price, p_unit_price_currency_id, p_is_extra);

  SELECT
    sli.id, sli.shopping_list_id, sli.product_id, p.name AS product_name, u.code AS unit_code,
    sli.quantity_needed, sli.unit_price, sli.unit_price_currency_id, sli.is_extra, sli.is_purchased
  FROM shopping_list_items sli
  INNER JOIN products p ON p.id = sli.product_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE sli.id = LAST_INSERT_ID();
END;
```

Create `db/procedures/sp_shopping_list_item_update.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_item_update;

CREATE PROCEDURE sp_shopping_list_item_update(
  IN p_item_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_quantity_needed DECIMAL(10,2),
  IN p_unit_price DECIMAL(12,2),
  IN p_unit_price_currency_id TINYINT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_list_items sli
  INNER JOIN shopping_lists sl ON sl.id = sli.shopping_list_id
  WHERE sli.id = p_item_id AND sl.household_id = p_household_id AND sl.status = 'open';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item not found in this household or list is not open';
  END IF;

  UPDATE shopping_list_items
  SET quantity_needed = p_quantity_needed,
      unit_price = p_unit_price,
      unit_price_currency_id = p_unit_price_currency_id
  WHERE id = p_item_id;

  SELECT
    sli.id, sli.shopping_list_id, sli.product_id, p.name AS product_name, u.code AS unit_code,
    sli.quantity_needed, sli.unit_price, sli.unit_price_currency_id, sli.is_extra, sli.is_purchased
  FROM shopping_list_items sli
  INNER JOIN products p ON p.id = sli.product_id
  INNER JOIN units_of_measure u ON u.id = p.unit_id
  WHERE sli.id = p_item_id;
END;
```

Create `db/procedures/sp_shopping_list_item_delete.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_item_delete;

CREATE PROCEDURE sp_shopping_list_item_delete(
  IN p_item_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_list_items sli
  INNER JOIN shopping_lists sl ON sl.id = sli.shopping_list_id
  WHERE sli.id = p_item_id AND sl.household_id = p_household_id AND sl.status = 'open';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item not found in this household or list is not open';
  END IF;

  DELETE FROM shopping_list_items WHERE id = p_item_id;
END;
```

Run: `npm run db:migrate` — expected: all 3 new procedures load.

- [ ] **Step 2: Wrapper (append to the existing file)**

Modify `src/lib/db/procedures/shopping-list.ts`, append:
```ts
export async function addShoppingListItem(params: {
  shoppingListId: number;
  householdId: number;
  productId: number;
  quantityNeeded: number;
  unitPrice: number | null;
  unitPriceCurrencyId: number | null;
  isExtra: boolean;
}): Promise<ShoppingListItemRecord> {
  const rows = await callProcedure<ShoppingListItemRecord>('sp_shopping_list_add_item', [
    params.shoppingListId,
    params.householdId,
    params.productId,
    params.quantityNeeded,
    params.unitPrice,
    params.unitPriceCurrencyId,
    params.isExtra ? 1 : 0,
  ]);
  return rows[0];
}

export async function updateShoppingListItem(params: {
  itemId: number;
  householdId: number;
  quantityNeeded: number;
  unitPrice: number | null;
  unitPriceCurrencyId: number | null;
}): Promise<ShoppingListItemRecord> {
  const rows = await callProcedure<ShoppingListItemRecord>('sp_shopping_list_item_update', [
    params.itemId,
    params.householdId,
    params.quantityNeeded,
    params.unitPrice,
    params.unitPriceCurrencyId,
  ]);
  return rows[0];
}

export async function deleteShoppingListItem(itemId: number, householdId: number): Promise<void> {
  await callProcedure('sp_shopping_list_item_delete', [itemId, householdId]);
}
```

- [ ] **Step 3: Tests (append to the existing file, TDD)**

Modify `tests/db/procedures/shopping-list.test.ts`, add imports (`addShoppingListItem`, `updateShoppingListItem`, `deleteShoppingListItem`) and a second `describe` block:
```ts
describe('shopping list item edit procedures', () => {
  it('adds an extra item not derived from any deficit', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    const product = await createProduct({
      householdId,
      name: `Chocolate ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 0,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });
    const list = await generateOrGetShoppingList(householdId, memberId);

    const item = await addShoppingListItem({
      shoppingListId: list.id,
      householdId,
      productId: product.id,
      quantityNeeded: 2,
      unitPrice: 2500,
      unitPriceCurrencyId: CRC_ID,
      isExtra: true,
    });

    expect(item.is_extra).toBe(1);
    const items = await getShoppingListItems(list.id, householdId, CRC_ID);
    expect(items.map((i) => i.id)).toContain(item.id);
  });

  it('updates an item quantity and price', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    const product = await createProduct({
      householdId,
      name: `Pan ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 2,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });
    const list = await generateOrGetShoppingList(householdId, memberId);
    const [item] = await getShoppingListItems(list.id, householdId, CRC_ID);

    const updated = await updateShoppingListItem({
      itemId: item.id,
      householdId,
      quantityNeeded: 5,
      unitPrice: 1200,
      unitPriceCurrencyId: CRC_ID,
    });

    expect(updated.quantity_needed).toBe(5);
    expect(updated.unit_price).toBe(1200);
  });

  it('deletes an item', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    const product = await createProduct({
      householdId,
      name: `Huevos ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 1,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });
    const list = await generateOrGetShoppingList(householdId, memberId);
    const [item] = await getShoppingListItems(list.id, householdId, CRC_ID);

    await deleteShoppingListItem(item.id, householdId);

    const items = await getShoppingListItems(list.id, householdId, CRC_ID);
    expect(items.map((i) => i.id)).not.toContain(item.id);
  });

  it('rejects updating an item that belongs to a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createMember(suffixA);
    const { householdId: householdIdB } = await createMember(suffixB);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    const product = await createProduct({
      householdId: householdIdA,
      name: `Manzanas ${suffixA}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 3,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberIdA,
    });
    const list = await generateOrGetShoppingList(householdIdA, memberIdA);
    const [item] = await getShoppingListItems(list.id, householdIdA, CRC_ID);

    await expect(
      updateShoppingListItem({
        itemId: item.id,
        householdId: householdIdB,
        quantityNeeded: 99,
        unitPrice: null,
        unitPriceCurrencyId: null,
      }),
    ).rejects.toThrow(/not found/i);
  });
});
```

Run: `npm test -- shopping-list.test.ts` — expected: PASS (3 + 4 = 7/7).

- [ ] **Step 4: Run full suite and commit**

Run: `npm test` — expected: 45 + 4 = 49/49 (measured).

```bash
git add -A
git commit -m "feat(db): add shopping list item add/update/delete procedures with tests"
```

---

### Task 4: SP de confirmación de compra (JSON+WHILE, actualiza inventario)

**Files:**
- Create: `db/procedures/sp_shopping_list_confirm.sql`
- Modify: `src/lib/db/procedures/shopping-list.ts` (append)
- Modify: `tests/db/procedures/shopping-list.test.ts` (append)

**Interfaces:**
- Produce: `confirmShoppingList` — consumed by Task 6's confirm action

- [ ] **Step 1: SP (the flagged MariaDB JSON+WHILE case)**

Create `db/procedures/sp_shopping_list_confirm.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_confirm;

CREATE PROCEDURE sp_shopping_list_confirm(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_items_json JSON,
  IN p_display_currency_id TINYINT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_len INT;
  DECLARE v_i INT DEFAULT 0;
  DECLARE v_item_id INT UNSIGNED;
  DECLARE v_quantity DECIMAL(10,2);
  DECLARE v_unit_price DECIMAL(12,2);
  DECLARE v_unit_price_currency_id TINYINT UNSIGNED;
  DECLARE v_product_id INT UNSIGNED;
  DECLARE v_rate DECIMAL(12,4);
  DECLARE v_total DECIMAL(12,2) DEFAULT 0;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'open';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or already confirmed';
  END IF;

  SELECT rate_crc_per_usd INTO v_rate
  FROM exchange_rates
  WHERE effective_date <= CURDATE()
  ORDER BY effective_date DESC, id DESC
  LIMIT 1;

  SET v_len = JSON_LENGTH(p_items_json);

  WHILE v_i < v_len DO
    SET v_item_id = CAST(JSON_EXTRACT(p_items_json, CONCAT('$[', v_i, '].itemId')) AS UNSIGNED);
    SET v_quantity = CAST(JSON_EXTRACT(p_items_json, CONCAT('$[', v_i, '].quantity')) AS DECIMAL(10,2));
    SET v_unit_price = CAST(JSON_EXTRACT(p_items_json, CONCAT('$[', v_i, '].unitPrice')) AS DECIMAL(12,2));
    SET v_unit_price_currency_id = CAST(JSON_EXTRACT(p_items_json, CONCAT('$[', v_i, '].unitPriceCurrencyId')) AS UNSIGNED);

    SET v_product_id = NULL;
    SELECT product_id INTO v_product_id
    FROM shopping_list_items
    WHERE id = v_item_id AND shopping_list_id = p_shopping_list_id;

    IF v_product_id IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item does not belong to this shopping list';
    END IF;

    UPDATE shopping_list_items
    SET quantity_needed = v_quantity,
        unit_price = v_unit_price,
        unit_price_currency_id = v_unit_price_currency_id,
        is_purchased = 1
    WHERE id = v_item_id;

    UPDATE products
    SET current_quantity = current_quantity + v_quantity
    WHERE id = v_product_id;

    SET v_total = v_total + ROUND(
      v_quantity * IFNULL(v_unit_price, 0) *
      CASE
        WHEN v_unit_price_currency_id IS NULL OR v_unit_price_currency_id = p_display_currency_id THEN 1
        WHEN v_unit_price_currency_id = 2 THEN IFNULL(v_rate, 1)
        WHEN v_unit_price_currency_id = 1 THEN 1 / IFNULL(v_rate, 1)
        ELSE 1
      END,
    2);

    SET v_i = v_i + 1;
  END WHILE;

  UPDATE shopping_lists
  SET status = 'confirmed',
      total_estimated = v_total,
      total_estimated_currency_id = p_display_currency_id,
      confirmed_at = NOW()
  WHERE id = p_shopping_list_id;

  SELECT id, household_id, status, created_by_member_id, total_estimated, total_estimated_currency_id, created_at, confirmed_at
  FROM shopping_lists
  WHERE id = p_shopping_list_id;
END;
```
This is the flagged MariaDB-compatibility case from the master plan: `JSON_LENGTH` + `WHILE` + `JSON_EXTRACT` per array element, with explicit `CAST(... AS UNSIGNED/DECIMAL)` on each extracted scalar (a bare `JSON_EXTRACT` result is a JSON value, not a SQL number — the `CAST` is required, not decorative). No `JSON_TABLE` anywhere (unavailable until MariaDB 10.6). The per-item "does this item genuinely belong to this list" check (`v_product_id IS NULL` after the lookup) is a second layer of the same household-scoping discipline — even though `p_shopping_list_id` was already verified to belong to `p_household_id` above, a malformed/tampered `itemId` in the JSON payload pointing at a different list's item is still caught here before it can bump the wrong product's inventory.

Run: `npm run db:migrate` — expected: procedure loads.

- [ ] **Step 2: Wrapper (append)**

Modify `src/lib/db/procedures/shopping-list.ts`, append:
```ts
export async function confirmShoppingList(params: {
  shoppingListId: number;
  householdId: number;
  items: Array<{
    itemId: number;
    quantity: number;
    unitPrice: number | null;
    unitPriceCurrencyId: number | null;
  }>;
  displayCurrencyId: number;
}): Promise<ShoppingListRecord> {
  const rows = await callProcedure<ShoppingListRecord>('sp_shopping_list_confirm', [
    params.shoppingListId,
    params.householdId,
    JSON.stringify(params.items),
    params.displayCurrencyId,
  ]);
  return rows[0];
}
```

- [ ] **Step 3: Tests (append, TDD) — the security- and correctness-critical case**

Modify `tests/db/procedures/shopping-list.test.ts`, add `confirmShoppingList` to imports and a third `describe` block:
```ts
describe('shopping list confirm procedure', () => {
  it('confirms the list, bumps product current_quantity, and marks items purchased', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    const product = await createProduct({
      householdId,
      name: `Yogur ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 4,
      currentQuantity: 1,
      defaultPrice: 1000,
      defaultPriceCurrencyId: CRC_ID,
      createdByMemberId: memberId,
    });
    const list = await generateOrGetShoppingList(householdId, memberId);
    const items = await getShoppingListItems(list.id, householdId, CRC_ID);
    expect(items).toHaveLength(1);
    expect(items[0].quantity_needed).toBe(3);

    const confirmed = await confirmShoppingList({
      shoppingListId: list.id,
      householdId,
      items: items.map((item) => ({
        itemId: item.id,
        quantity: item.quantity_needed,
        unitPrice: item.unit_price,
        unitPriceCurrencyId: item.unit_price_currency_id,
      })),
      displayCurrencyId: CRC_ID,
    });

    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.total_estimated).toBe(3000);
    expect(confirmed.total_estimated_currency_id).toBe(CRC_ID);

    const updatedItems = await getShoppingListItems(list.id, householdId, CRC_ID);
    expect(updatedItems[0].is_purchased).toBe(1);

    const productsAfter = await listProducts(householdId);
    const updatedProduct = productsAfter.find((p) => p.id === product.id);
    expect(updatedProduct?.current_quantity).toBe(4);
  });

  it('rejects confirming a list that belongs to a different household', async () => {
    const suffixA = uniqueSuffix();
    const suffixB = uniqueSuffix();
    const { householdId: householdIdA, memberId: memberIdA } = await createMember(suffixA);
    const { householdId: householdIdB } = await createMember(suffixB);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    await createProduct({
      householdId: householdIdA,
      name: `Te ${suffixA}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 2,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberIdA,
    });
    const list = await generateOrGetShoppingList(householdIdA, memberIdA);
    const items = await getShoppingListItems(list.id, householdIdA, CRC_ID);

    await expect(
      confirmShoppingList({
        shoppingListId: list.id,
        householdId: householdIdB,
        items: items.map((item) => ({
          itemId: item.id,
          quantity: item.quantity_needed,
          unitPrice: item.unit_price,
          unitPriceCurrencyId: item.unit_price_currency_id,
        })),
        displayCurrencyId: CRC_ID,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects confirming the same list twice', async () => {
    const suffix = uniqueSuffix();
    const { householdId, memberId } = await createMember(suffix);
    const [category] = await listCategories();
    const [unit] = await listUnits();
    await createProduct({
      householdId,
      name: `Miel ${suffix}`,
      categoryId: category.id,
      unitId: unit.id,
      optimalQuantity: 1,
      currentQuantity: 0,
      defaultPrice: null,
      defaultPriceCurrencyId: null,
      createdByMemberId: memberId,
    });
    const list = await generateOrGetShoppingList(householdId, memberId);
    const items = await getShoppingListItems(list.id, householdId, CRC_ID);
    const payload = items.map((item) => ({
      itemId: item.id,
      quantity: item.quantity_needed,
      unitPrice: item.unit_price,
      unitPriceCurrencyId: item.unit_price_currency_id,
    }));

    await confirmShoppingList({ shoppingListId: list.id, householdId, items: payload, displayCurrencyId: CRC_ID });

    await expect(
      confirmShoppingList({ shoppingListId: list.id, householdId, items: payload, displayCurrencyId: CRC_ID }),
    ).rejects.toThrow(/not found or already confirmed/i);
  });
});
```
Add `listProducts` to the file's existing `@/lib/db/procedures/products` import for the first test's inventory-bump assertion.

Run: `npm test -- shopping-list.test.ts` — expected: PASS (7 + 3 = 10/10).

- [ ] **Step 4: Run full suite and commit**

Run: `npm test` — expected: 49 + 3 = 52/52 (measured).

```bash
git add -A
git commit -m "feat(db): add shopping list confirmation procedure (JSON+WHILE, updates inventory)"
```

---

### Task 5: Página /compras — lista, edición inline, agregar extra, eliminar

**Files:**
- Create: `src/lib/household/require-membership.ts` (extracted — see below)
- Modify: `src/app/inventario/actions.ts` (import the extracted helper instead of its own copy)
- Create: `src/app/compras/page.tsx`, `src/app/compras/actions.ts`, `src/app/compras/shopping-list-client.tsx`
- Create: `src/components/shopping-list/ShoppingListItemRow.tsx`, `src/components/shopping-list/ShoppingListItemForm.tsx`

**Interfaces:**
- Consume: `generateOrGetShoppingList`, `getShoppingList`, `getShoppingListItems`, `addShoppingListItem`, `updateShoppingListItem`, `deleteShoppingListItem` (Tasks 2-4), `listProducts`/`listCategories`/`listUnits` (Fase 1), `listCurrencies` (Fase 0a)
- Produce: `requireMembership()` (extracted, shared) — consumed by Task 6's confirm action too

- [ ] **Step 1: Extract the shared membership helper (DRY — this is now needed by a second route)**

Create `src/lib/household/require-membership.ts`:
```ts
import { auth } from '@/auth';
import { getHouseholdsForUser, type HouseholdForUserRecord } from '@/lib/db/procedures/household';

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
```

Modify `src/app/inventario/actions.ts` — read it first, then delete its own local `requireMembership` function definition and replace it with `import { requireMembership } from '@/lib/household/require-membership';` at the top of the file. Every call site inside that file that already calls `requireMembership()` stays exactly as-is — only the definition moves, not its usage.

Run: `npm run build` — expected: still succeeds (confirms the extraction didn't break the inventory module's existing call sites).

- [ ] **Step 2: Server Actions**

Create `src/app/compras/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMembership } from '@/lib/household/require-membership';
import {
  addShoppingListItem,
  deleteShoppingListItem,
  updateShoppingListItem,
} from '@/lib/db/procedures/shopping-list';

const addItemSchema = z.object({
  shoppingListId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  quantityNeeded: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0).optional(),
  unitPriceCurrencyId: z.coerce.number().int().positive().optional(),
});

export interface AddItemState {
  error: string | null;
}

export async function addItemAction(
  _prevState: AddItemState,
  formData: FormData,
): Promise<AddItemState> {
  const membership = await requireMembership();

  const parsed = addItemSchema.safeParse({
    shoppingListId: formData.get('shoppingListId'),
    productId: formData.get('productId'),
    quantityNeeded: formData.get('quantityNeeded'),
    unitPrice: formData.get('unitPrice') || undefined,
    unitPriceCurrencyId: formData.get('unitPriceCurrencyId') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await addShoppingListItem({
      shoppingListId: parsed.data.shoppingListId,
      householdId: membership.id,
      productId: parsed.data.productId,
      quantityNeeded: parsed.data.quantityNeeded,
      unitPrice: parsed.data.unitPrice ?? null,
      unitPriceCurrencyId: parsed.data.unitPriceCurrencyId ?? null,
      isExtra: true,
    });
  } catch {
    return { error: 'No se pudo agregar el producto. Intentá de nuevo.' };
  }

  revalidatePath('/compras');
  return { error: null };
}

const updateItemSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  quantityNeeded: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0).optional(),
  unitPriceCurrencyId: z.coerce.number().int().positive().optional(),
});

export interface UpdateItemState {
  error: string | null;
}

export async function updateItemAction(
  _prevState: UpdateItemState,
  formData: FormData,
): Promise<UpdateItemState> {
  const membership = await requireMembership();

  const parsed = updateItemSchema.safeParse({
    itemId: formData.get('itemId'),
    quantityNeeded: formData.get('quantityNeeded'),
    unitPrice: formData.get('unitPrice') || undefined,
    unitPriceCurrencyId: formData.get('unitPriceCurrencyId') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await updateShoppingListItem({
      itemId: parsed.data.itemId,
      householdId: membership.id,
      quantityNeeded: parsed.data.quantityNeeded,
      unitPrice: parsed.data.unitPrice ?? null,
      unitPriceCurrencyId: parsed.data.unitPriceCurrencyId ?? null,
    });
  } catch {
    return { error: 'No se pudo actualizar el producto. Intentá de nuevo.' };
  }

  revalidatePath('/compras');
  return { error: null };
}

export async function deleteItemAction(itemId: number): Promise<void> {
  const membership = await requireMembership();
  await deleteShoppingListItem(itemId, membership.id);
  revalidatePath('/compras');
}
```

- [ ] **Step 3: Item row and form components**

Create `src/components/shopping-list/ShoppingListItemRow.tsx`:
```tsx
'use client';

import { useTransition } from 'react';
import { deleteItemAction } from '@/app/compras/actions';
import { showError } from '@/lib/ui/alerts';
import type { ShoppingListItemRecord } from '@/lib/db/procedures/shopping-list';

export function ShoppingListItemRow({
  item,
  onEdit,
}: {
  item: ShoppingListItemRecord;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(): void {
    startTransition(() => {
      deleteItemAction(item.id).catch(() => {
        showError('No se pudo eliminar el producto. Intentá de nuevo.');
      });
    });
  }

  return (
    <li className="list-group-item d-flex justify-content-between align-items-center">
      <button
        type="button"
        className="btn btn-link text-start text-decoration-none p-0 flex-grow-1 text-body"
        onClick={onEdit}
      >
        <div className="fw-semibold">
          {item.product_name}
          {item.is_extra ? <span className="badge text-bg-secondary ms-2">Extra</span> : null}
        </div>
        <div className="text-body-secondary small">
          {item.quantity_needed} {item.unit_code}
          {item.unit_price !== null
            ? ` · ${item.unit_price_currency_symbol ?? ''}${item.unit_price} c/u`
            : ' · sin precio'}
        </div>
      </button>
      <button
        type="button"
        className="btn btn-outline-danger btn-sm"
        disabled={isPending}
        onClick={handleDelete}
        aria-label="Eliminar"
      >
        <i className="bi bi-trash" />
      </button>
    </li>
  );
}
```

Create `src/components/shopping-list/ShoppingListItemForm.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import {
  addItemAction,
  updateItemAction,
  type AddItemState,
  type UpdateItemState,
} from '@/app/compras/actions';
import { CurrencyAmountInput } from '@/components/CurrencyAmountInput';
import type { ProductRecord } from '@/lib/db/procedures/products';
import type { ShoppingListItemRecord } from '@/lib/db/procedures/shopping-list';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

const initialState: AddItemState | UpdateItemState = { error: null };

export function ShoppingListItemForm({
  mode,
  shoppingListId,
  item,
  products,
  currencies,
}: {
  mode: 'add' | 'edit';
  shoppingListId: number;
  item?: ShoppingListItemRecord;
  products: ProductRecord[];
  currencies: CurrencyRecord[];
}) {
  const action = mode === 'add' ? addItemAction : updateItemAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="d-flex flex-column gap-3">
      {mode === 'add' ? (
        <>
          <input type="hidden" name="shoppingListId" value={shoppingListId} />
          <div>
            <label htmlFor="productId" className="form-label">Producto</label>
            <select id="productId" name="productId" className="form-select" required>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <input type="hidden" name="itemId" value={item?.id} />
      )}
      <div>
        <label htmlFor="quantityNeeded" className="form-label">Cantidad</label>
        <input
          id="quantityNeeded"
          name="quantityNeeded"
          type="number"
          step="0.01"
          min={0.01}
          defaultValue={item?.quantity_needed}
          className="form-control"
          required
        />
      </div>
      <div>
        <label className="form-label">Precio (opcional)</label>
        <CurrencyAmountInput
          amountName="unitPrice"
          currencyName="unitPriceCurrencyId"
          currencies={currencies}
          defaultAmount={item?.unit_price}
          defaultCurrencyId={item?.unit_price_currency_id}
        />
      </div>
      {state.error ? (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {state.error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Guardando…' : mode === 'add' ? 'Agregar' : 'Guardar cambios'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Client wrapper and page**

Create `src/app/compras/shopping-list-client.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { ShoppingListItemRow } from '@/components/shopping-list/ShoppingListItemRow';
import { ShoppingListItemForm } from '@/components/shopping-list/ShoppingListItemForm';
import type { ProductRecord } from '@/lib/db/procedures/products';
import type { ShoppingListItemRecord, ShoppingListRecord } from '@/lib/db/procedures/shopping-list';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

export function ShoppingListClient({
  list,
  items,
  products,
  currencies,
  displayCurrencySymbol,
}: {
  list: ShoppingListRecord;
  items: ShoppingListItemRecord[];
  products: ProductRecord[];
  currencies: CurrencyRecord[];
  displayCurrencySymbol: string;
}) {
  const [panel, setPanel] = useState<{ mode: 'add' } | { mode: 'edit'; item: ShoppingListItemRecord } | null>(
    null,
  );

  return (
    <main className="container-fluid px-3 py-4 pb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Lista de compras</h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPanel({ mode: 'add' })}>
          <i className="bi bi-plus-lg me-1" />
          Producto
        </button>
      </div>

      <ul className="list-group mb-4">
        {items.map((item) => (
          <ShoppingListItemRow key={item.id} item={item} onEdit={() => setPanel({ mode: 'edit', item })} />
        ))}
      </ul>

      {items.length === 0 ? (
        <p className="text-body-secondary">No falta nada por ahora — tu inventario está al día.</p>
      ) : null}

      {panel ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1050 }}
        >
          <div className="bg-body w-100 p-3 rounded-top-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">{panel.mode === 'add' ? 'Agregar producto' : 'Editar producto'}</h2>
              <button type="button" className="btn-close" onClick={() => setPanel(null)} aria-label="Cerrar" />
            </div>
            <ShoppingListItemForm
              mode={panel.mode}
              shoppingListId={list.id}
              item={panel.mode === 'edit' ? panel.item : undefined}
              products={products}
              currencies={currencies}
            />
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div
          className="position-fixed bottom-0 start-0 w-100 bg-body border-top p-3 d-flex justify-content-between align-items-center"
          style={{ zIndex: 1040 }}
        >
          <div>
            <div className="text-body-secondary small">Total estimado</div>
            <div className="h5 mb-0">
              {displayCurrencySymbol}
              {list.total_estimated_live ?? 0}
            </div>
          </div>
          {/* ConfirmPurchaseButton is wired in Task 6 */}
        </div>
      ) : null}
    </main>
  );
}
```
Leave the `{/* ConfirmPurchaseButton is wired in Task 6 */}` comment exactly as shown — Task 6 replaces it with the real component. This mirrors the same placeholder pattern Fase 1's `inventory-client.tsx` used for its create/edit panel, for the same reason: the confirm button's component file doesn't exist until the next task, so referencing it here would break this task's own build.

- [ ] **Step 5: Page (server component)**

Create `src/app/compras/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { requireMembership } from '@/lib/household/require-membership';
import { listCurrencies } from '@/lib/db/procedures/currency';
import { listProducts } from '@/lib/db/procedures/products';
import {
  generateOrGetShoppingList,
  getShoppingList,
  getShoppingListItems,
} from '@/lib/db/procedures/shopping-list';
import { ShoppingListClient } from './shopping-list-client';

const DISPLAY_CURRENCY_ID = 1; // CRC — see Global Constraints for the fixed-ID rationale

export default async function ComprasPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const membership = await requireMembership();
  const generated = await generateOrGetShoppingList(membership.id, membership.member_id);

  const [list, items, products, currencies] = await Promise.all([
    getShoppingList(generated.id, membership.id, DISPLAY_CURRENCY_ID),
    getShoppingListItems(generated.id, membership.id, DISPLAY_CURRENCY_ID),
    listProducts(membership.id),
    listCurrencies(),
  ]);

  const displayCurrency = currencies.find((c) => c.id === DISPLAY_CURRENCY_ID);

  return (
    <ShoppingListClient
      list={list}
      items={items}
      products={products}
      currencies={currencies}
      displayCurrencySymbol={displayCurrency?.symbol ?? ''}
    />
  );
}
```
Note `requireMembership()` is called even though `auth()` was already checked — this is intentional and matches Fase 1's inventory page: the top-level `auth()` check gives a clean `/login` redirect for "no session at all", while `requireMembership()` (called after) throws for "session exists but no household," which Next.js's error boundary surfaces — if you want a friendlier `/onboarding` redirect for that specific case instead of an error page, wrap the `requireMembership()` call in a try/catch and `redirect('/onboarding')` on failure, matching the exact pattern already used in `src/app/inventario/page.tsx`. Read that file to copy its precise redirect structure rather than inventing a new one here.

- [ ] **Step 6: Manual verification (real data, not just page render)**

Run: `npm run dev`. Using the established csrf+credentials curl technique, register a user, create a household, create at least one product with a real deficit (`optimal_quantity > current_quantity`) via a short-lived script (delete after use). `curl -b <jar> http://localhost:3000/compras` and confirm the deficit product appears in the rendered HTML with the correct quantity. Since `addItemAction`/`updateItemAction`/`deleteItemAction` include both form-bound and direct-call actions, reuse the FormData-construction/temporary-route technique from prior phases to drive at least one add and one delete through the real Server Action path, confirming via direct DB queries that `shopping_list_items` rows actually change. Clean up any throwaway scripts/routes. Stop the dev server when done.

- [ ] **Step 7: Run full suite and build, then commit**

Run: `npm test` — expected: 52/52 (no new automated tests this task — UI/Server Action wiring, consistent with this project's established convention).

Run: `npm run build` — expected: succeeds; `/compras` appears as a dynamic route.

```bash
git add -A
git commit -m "feat(shopping-list): add /compras page with item add/edit/delete"
```

---

### Task 6: Confirmar compra

**Files:**
- Modify: `src/app/compras/actions.ts` (append `confirmPurchaseAction`)
- Create: `src/app/compras/confirm-purchase-button.tsx`
- Modify: `src/app/compras/shopping-list-client.tsx` (wire in the button, replacing Task 5's placeholder)

**Interfaces:**
- Consume: `confirmShoppingList` (Task 4), `getShoppingListItems` (Task 2)

- [ ] **Step 1: Server Action — derives the items payload server-side from already-persisted rows**

Modify `src/app/compras/actions.ts`: add `confirmShoppingList` and `getShoppingListItems` to the existing `@/lib/db/procedures/shopping-list` import at the top of the file (alongside `addShoppingListItem`, `updateShoppingListItem`, `deleteShoppingListItem` from Task 5 — one combined import statement, not a second separate one), then append:
```ts
const DISPLAY_CURRENCY_ID = 1; // CRC — matches page.tsx's constant; see Global Constraints

export interface ConfirmPurchaseState {
  error: string | null;
}

export async function confirmPurchaseAction(shoppingListId: number): Promise<ConfirmPurchaseState> {
  const membership = await requireMembership();

  const items = await getShoppingListItems(shoppingListId, membership.id, DISPLAY_CURRENCY_ID);
  if (items.length === 0) {
    return { error: 'La lista está vacía' };
  }

  try {
    await confirmShoppingList({
      shoppingListId,
      householdId: membership.id,
      items: items.map((item) => ({
        itemId: item.id,
        quantity: item.quantity_needed,
        unitPrice: item.unit_price,
        unitPriceCurrencyId: item.unit_price_currency_id,
      })),
      displayCurrencyId: DISPLAY_CURRENCY_ID,
    });
  } catch {
    return { error: 'No se pudo confirmar la compra. Intentá de nuevo.' };
  }

  revalidatePath('/compras');
  return { error: null };
}
```
Note this action takes only `shoppingListId` from the caller — the actual item quantities/prices applied come from `getShoppingListItems`' fresh read of the database, not from anything the client could have tampered with in a request body. Combined with `confirmShoppingList`'s own household-ownership check (Task 4), this closes the same class of gap Fase 1's IDOR fix addressed, from the start rather than as a follow-up fix.

- [ ] **Step 2: Confirm button component**

Create `src/app/compras/confirm-purchase-button.tsx`:
```tsx
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPurchaseAction } from './actions';
import { showError, showSuccess } from '@/lib/ui/alerts';

export function ConfirmPurchaseButton({ shoppingListId }: { shoppingListId: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm(): void {
    startTransition(() => {
      confirmPurchaseAction(shoppingListId)
        .then((result) => {
          if (result.error) {
            showError(result.error);
            return;
          }
          showSuccess('Compra confirmada. Tu inventario se actualizó.');
          router.refresh();
        })
        .catch(() => {
          showError('No se pudo confirmar la compra. Intentá de nuevo.');
        });
    });
  }

  return (
    <button type="button" className="btn btn-primary" disabled={isPending} onClick={handleConfirm}>
      {isPending ? 'Confirmando…' : 'Confirmar compra'}
    </button>
  );
}
```

- [ ] **Step 2b: Wire the button into the client component**

Modify `src/app/compras/shopping-list-client.tsx`: add `import { ConfirmPurchaseButton } from './confirm-purchase-button';` to its imports, then replace the `{/* ConfirmPurchaseButton is wired in Task 6 */}` comment with `<ConfirmPurchaseButton shoppingListId={list.id} />`.

- [ ] **Step 3: Manual verification — the real end-to-end proof for this whole phase**

Run: `npm run dev`. Using the established technique (real session cookie, direct-FormData-or-temp-route call since `confirmPurchaseAction` is a direct function call, not a form action), drive the real confirm flow for a household with at least one deficit product: (a) query `products.current_quantity` and `shopping_lists.status` BEFORE confirming, (b) call `confirmPurchaseAction`, (c) query both again AFTER — confirm `current_quantity` increased by exactly the item's `quantity_needed` and `shopping_lists.status` is now `'confirmed'`. This is the single most important behavior in this entire phase (the master plan's core promise: "al confirmar la compra, actualiza automáticamente las cantidades actuales del inventario") — do not skip or approximate this check. Also confirm a second confirm attempt on the same list is rejected (already covered at the SP/wrapper level in Task 4's tests, but a real end-to-end repeat-click here is good confidence). Clean up any throwaway scripts/routes. Stop the dev server when done.

- [ ] **Step 4: Run full suite and build, then commit**

Run: `npm test` — expected: 52/52 (no new automated tests this task).

Run: `npm run build` — expected: succeeds.

```bash
git add -A
git commit -m "feat(shopping-list): add purchase confirmation that updates inventory"
```

---

## Self-Review

**Cobertura:** generación automática desde déficit ✓ (Task 2), agregar extras ✓ (Task 3/5), precio manual por producto/moneda ✓ (Tasks 3/5, reutiliza `<CurrencyAmountInput>` de Fase 1 sin modificarlo, tal como anticipaba el plan maestro), total estimado antes de confirmar ✓ (Task 2's `total_estimated_live` + Task 5's UI), confirmación actualiza inventario automáticamente ✓ (Task 4/6, con la verificación manual más importante de toda la fase). División del gasto (Fase 3) y offline (Fase 4) son explícitamente fases siguientes, no de esta.

**Placeholders:** ninguno — cada paso tiene código completo, incluida la extracción de `requireMembership()` (un refactor real y necesario, no un placeholder) y el archivo `inventario/actions.ts` ya mergeado que Task 5 edita con instrucciones precisas.

**Testing honesty:** Tasks 5 y 6 (capa de Server Actions/UI) documentan explícitamente que no agregan tests automatizados nuevos, consistente con la convención del proyecto — pero exigen la verificación manual más rigurosa de todo el plan para la confirmación de compra específicamente, porque es la única operación de esta fase con un efecto secundario irreversible en datos de otra tabla (`products`).

**Type consistency:** `ShoppingListRecord`/`ShoppingListItemRecord` (Task 2) se usan idénticamente en Tasks 3, 4, 5 y 6 — sin forma duplicada ni deriva. El patrón de scoping por hogar (`SELECT COUNT(*) INTO v_exists ... SIGNAL`) es literalmente el mismo en las 7 stored procedures de esta fase, sin excepciones, tal como exige la sección de Global Constraints.

## Qué sigue

Con la lista de compras funcionando de punta a punta, el plan maestro sigue con Fase 3 (división del gasto de la compra — 50/50 ajustable, tabla `shopping_list_splits`) y Fase 4 (soporte offline de la lista de compras vía service worker, la primera vez que el shell de PWA de Fase 0b se usa de verdad).

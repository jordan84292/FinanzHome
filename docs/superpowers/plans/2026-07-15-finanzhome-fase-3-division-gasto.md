# Fase 3 — División del gasto de la compra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** al confirmar una compra, dividir su `total_estimated` entre los miembros del hogar — 50/50 (o N-vías igual) por defecto, ajustable por compra — persistiendo cuánto le debe cada miembro.

**Architecture:** una tabla nueva `shopping_list_splits` (una fila por miembro por lista confirmada) más 4 stored procedures (init/get/update/validate). La inicialización ocurre automáticamente inmediatamente después de `confirmShoppingList` (orquestado desde la Server Action, mismo patrón que ya usa `confirmPurchaseAction` al componer `getShoppingListItems` + `confirmShoppingList`). El ajuste manual de porcentajes requiere una transacción SQL real (varias filas deben cambiar atómicamente y validarse en conjunto), así que esta fase agrega la primera pieza de infraestructura de transacciones del proyecto (`withTransaction`).

**Tech Stack:** el mismo de siempre — Next.js Server Actions, `mysql2/promise`, MariaDB 10.4.32 stored procedures, Vitest contra `finanzhome_test` real.

## Global Constraints

- **DB-first, sin ORM:** toda regla de negocio (el cálculo de porcentajes iguales, la validación de que sumen 100%) vive en stored procedures. El backend solo hace `CALL sp_xxx(...)`.
- **MariaDB 10.4.32:** esta fase no usa JSON — usa un cursor SQL estándar para recorrer `household_members` (soportado desde MariaDB muy antiguo, sin restricción de versión).
- **Household-scoping discipline (regla dura del proyecto):** todo SP que lea o mute datos de un hogar debe validar pertenencia contra `p_household_id` con `SELECT COUNT(*) INTO v_exists ... IF v_exists = 0 THEN SIGNAL ...` antes de tocar cualquier fila. Esta regla existe por 3 incidentes reales/casi-reales en fases anteriores (Fase 1, Fase 1b, Fase 2) — no es opcional acá tampoco.
- **`tsc --noEmit` obligatorio:** además de `npm test` y `npm run build`, cada tarea corre `npx tsc --noEmit` — el build de Next no cubre archivos de test no importados.
- **`payment_day` ya no existe en `household_members`** (se removió en Fase 1b, vive en `users` como `payment_frequency`/`payment_weekday`/`payment_day`). No confundir ambos.
- **No hay noción de miembro "inactivo"** en `household_members` (no existe columna `is_active` ahí, a diferencia de `products`). "Miembros activos del hogar" en el objetivo de esta fase significa, en la práctica, **todos** los `household_members` del hogar — se documenta acá como simplificación deliberada.

---

## Contexto que el implementador necesita conocer

**Tabla `shopping_lists` relevante (ya existe, Fase 2):** columnas `id`, `household_id`, `status` ('open'/'confirmed'/'cancelled'), `created_by_member_id`, `total_estimated` (DECIMAL(12,2), NULL hasta confirmar), `total_estimated_currency_id`, `created_at`, `confirmed_at`.

**Tabla `household_members` (ya existe, Fase 0a/1b):** columnas `id`, `household_id`, `user_id`, `display_name`, `role`, `joined_at`. **Ya no tiene** `payment_day`.

**`sp_shopping_list_confirm` (ya existe, Fase 2, NO se modifica en esta fase):** deja `shopping_lists.status = 'confirmed'` y `total_estimated`/`total_estimated_currency_id` ya calculados. Esta fase nunca toca ese archivo — solo se engancha *después*, desde la capa de Server Action, exactamente como `confirmPurchaseAction` ya compone `getShoppingListItems` + `confirmShoppingList` hoy.

**`src/lib/db/call.ts` (ya existe):**
```ts
import type { RowDataPacket } from 'mysql2';
import { pool } from './pool';

const PROCEDURE_NAME_PATTERN = /^[a-z0-9_]+$/i;

export async function callProcedure<T extends RowDataPacket = RowDataPacket>(
  name: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!PROCEDURE_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid stored procedure name: ${name}`);
  }
  const placeholders = params.map(() => '?').join(', ');
  const [results] = await pool.query(`CALL ${name}(${placeholders})`, params);
  const rows = (results as unknown as [T[], ...unknown[]])[0];
  return Array.isArray(rows) ? rows : [];
}
```
Task 3 refactora este archivo para reutilizar la lógica de `CALL` tanto contra el `pool` como contra una `PoolConnection` individual (necesario para transacciones reales).

**`src/app/compras/actions.ts` (ya existe, Fase 2):** tiene `confirmPurchaseAction(shoppingListId)` que llama `getShoppingListItems` y luego `confirmShoppingList`. Task 4 la extiende.

**Helpers de test disponibles:**
- `tests/helpers/db.ts` → `uniqueSuffix()`.
- Patrón `createMember(suffix)` (local a cada archivo de test, ver `tests/db/procedures/shopping-list.test.ts`) usando `registerUser` + `createHousehold` + `getHouseholdsForUser`.
- Para agregar un **segundo miembro** al mismo hogar en un test: `createInvitation({ householdId, email, token, invitedByMemberId, expiresAt })` desde `@/lib/db/procedures/household`, luego `acceptInvitation({ token, userId, displayName })` con un segundo usuario ya registrado vía `registerUser`.

---

## Modelo de datos nuevo

```sql
CREATE TABLE shopping_list_splits (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shopping_list_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  amount_owed DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_shopping_list_splits_list FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id),
  CONSTRAINT fk_shopping_list_splits_member FOREIGN KEY (member_id) REFERENCES household_members(id),
  CONSTRAINT uq_shopping_list_splits_list_member UNIQUE (shopping_list_id, member_id),
  CONSTRAINT chk_shopping_list_splits_percentage CHECK (percentage >= 0 AND percentage <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Reparto de resto en N-vías:** con `n` miembros, `100 / n` casi nunca cae en 2 decimales exactos (ej. 3 miembros → 33.333...). Se calcula `v_base = FLOOR(10000 / n) / 100` (33.33) y el resto `100.00 - v_base * n` (0.01) se asigna íntegro al primer miembro recorrido (`ORDER BY household_members.id ASC`, típicamente el creador/dueño del hogar). Así la suma siempre da exactamente 100.00. Ver Task 1.

---

## Task 1: Migración + `sp_shopping_list_split_init` + wrapper + tests

**Files:**
- Create: `db/migrations/006_shopping_list_splits.sql`
- Create: `db/procedures/sp_shopping_list_split_init.sql`
- Create: `src/lib/db/procedures/shopping-list-splits.ts`
- Test: `tests/db/procedures/shopping-list-splits.test.ts`

**Interfaces:**
- Consumes: `registerUser`, `createHousehold`, `getHouseholdsForUser`, `createInvitation`, `acceptInvitation` (`@/lib/db/procedures/household` y `auth`), `createProduct`/`listCategories`/`listUnits` (`@/lib/db/procedures/products`), `generateOrGetShoppingList`/`getShoppingListItems`/`confirmShoppingList` (`@/lib/db/procedures/shopping-list`), `callProcedure` (`@/lib/db/call`).
- Produces: `ShoppingListSplitRecord` (interface), `initSplit(shoppingListId: number, householdId: number): Promise<ShoppingListSplitRecord[]>` — usados por Task 2, Task 3 y Task 4.

- [ ] **Step 1: Migración de la tabla**

`db/migrations/006_shopping_list_splits.sql`:
```sql
CREATE TABLE shopping_list_splits (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shopping_list_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  amount_owed DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_shopping_list_splits_list FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id),
  CONSTRAINT fk_shopping_list_splits_member FOREIGN KEY (member_id) REFERENCES household_members(id),
  CONSTRAINT uq_shopping_list_splits_list_member UNIQUE (shopping_list_id, member_id),
  CONSTRAINT chk_shopping_list_splits_percentage CHECK (percentage >= 0 AND percentage <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Escribir el SP**

`db/procedures/sp_shopping_list_split_init.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_split_init;

CREATE PROCEDURE sp_shopping_list_split_init(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_already_split INT;
  DECLARE v_member_count INT;
  DECLARE v_total DECIMAL(12,2);
  DECLARE v_base_percentage DECIMAL(5,2);
  DECLARE v_remainder DECIMAL(5,2);
  DECLARE v_percentage DECIMAL(5,2);
  DECLARE v_member_id INT UNSIGNED;
  DECLARE v_is_first TINYINT DEFAULT 1;
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_member_cursor CURSOR FOR
    SELECT id FROM household_members WHERE household_id = p_household_id ORDER BY id ASC;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'confirmed';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or not confirmed';
  END IF;

  SELECT COUNT(*) INTO v_already_split
  FROM shopping_list_splits
  WHERE shopping_list_id = p_shopping_list_id;

  IF v_already_split = 0 THEN
    SELECT COUNT(*) INTO v_member_count
    FROM household_members
    WHERE household_id = p_household_id;

    SELECT total_estimated INTO v_total
    FROM shopping_lists
    WHERE id = p_shopping_list_id;

    SET v_base_percentage = FLOOR(10000 / v_member_count) / 100;
    SET v_remainder = 100.00 - (v_base_percentage * v_member_count);

    OPEN v_member_cursor;
    read_loop: LOOP
      FETCH v_member_cursor INTO v_member_id;
      IF v_done THEN
        LEAVE read_loop;
      END IF;

      IF v_is_first THEN
        SET v_percentage = v_base_percentage + v_remainder;
        SET v_is_first = 0;
      ELSE
        SET v_percentage = v_base_percentage;
      END IF;

      INSERT INTO shopping_list_splits (shopping_list_id, member_id, percentage, amount_owed)
      VALUES (p_shopping_list_id, v_member_id, v_percentage, ROUND(v_total * v_percentage / 100, 2));
    END LOOP;
    CLOSE v_member_cursor;
  END IF;

  SELECT sls.id, sls.shopping_list_id, sls.member_id, hm.display_name, sls.percentage, sls.amount_owed
  FROM shopping_list_splits sls
  INNER JOIN household_members hm ON hm.id = sls.member_id
  WHERE sls.shopping_list_id = p_shopping_list_id
  ORDER BY hm.id ASC;
END;
```

Notas:
- Idempotente: si ya hay filas para esa lista, no reinserta (`v_already_split = 0` guard) — igual devuelve las filas existentes al final. Esto protege contra una futura doble-invocación de `initSplit` sin duplicar filas ni violar `uq_shopping_list_splits_list_member`.
- Exige `status = 'confirmed'` — no se puede inicializar la división de una lista todavía abierta.
- El resto de redondeo (`v_remainder`) siempre se lo lleva el primer `household_members.id` del hogar — determinístico, sin ambigüedad.

- [ ] **Step 3: Correr la migración y el SP contra la DB de test**

Run: `npm run db:migrate` (o el script equivalente que ya usan las fases anteriores — confirmar en `package.json`)
Expected: output incluye `loaded procedure: sp_shopping_list_split_init.sql` sin errores.

- [ ] **Step 4: Wrapper TS**

`src/lib/db/procedures/shopping-list-splits.ts`:
```ts
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface ShoppingListSplitRecord extends RowDataPacket {
  id: number;
  shopping_list_id: number;
  member_id: number;
  display_name: string;
  percentage: number;
  amount_owed: number;
}

export async function initSplit(
  shoppingListId: number,
  householdId: number,
): Promise<ShoppingListSplitRecord[]> {
  return callProcedure<ShoppingListSplitRecord>('sp_shopping_list_split_init', [
    shoppingListId,
    householdId,
  ]);
}
```

- [ ] **Step 5: Escribir los tests (deben fallar primero si el SP no existiera — en este caso se escriben después del SP por ser un cursor complejo, así que el ciclo real es: escribir tests, correrlos, deben pasar ya que el SP fue escrito en Step 2)**

`tests/db/procedures/shopping-list-splits.test.ts`:
```ts
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
import { initSplit } from '@/lib/db/procedures/shopping-list-splits';
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
```

- [ ] **Step 6: Correr los tests**

Run: `npx vitest run tests/db/procedures/shopping-list-splits.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 7: `tsc --noEmit` y suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: sin salida de tsc; todos los tests existentes + los 5 nuevos pasan.

- [ ] **Step 8: Commit**

```bash
git add db/migrations/006_shopping_list_splits.sql db/procedures/sp_shopping_list_split_init.sql src/lib/db/procedures/shopping-list-splits.ts tests/db/procedures/shopping-list-splits.test.ts
git commit -m "feat(shopping-list): add split-init procedure for equal expense division"
```

---

## Task 2: `sp_shopping_list_split_get` + wrapper + tests

**Files:**
- Create: `db/procedures/sp_shopping_list_split_get.sql`
- Modify: `src/lib/db/procedures/shopping-list-splits.ts` (agrega `getSplit`)
- Modify: `tests/db/procedures/shopping-list-splits.test.ts` (agrega un `describe` nuevo)

**Interfaces:**
- Consumes: `ShoppingListSplitRecord`, `initSplit` (Task 1), helpers de test existentes en el mismo archivo.
- Produces: `getSplit(shoppingListId: number, householdId: number): Promise<ShoppingListSplitRecord[]>` — usado por Task 4 (Server Action `getSplitAction`).

- [ ] **Step 1: Escribir el SP**

`db/procedures/sp_shopping_list_split_get.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_split_get;

CREATE PROCEDURE sp_shopping_list_split_get(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found in this household';
  END IF;

  SELECT sls.id, sls.shopping_list_id, sls.member_id, hm.display_name, sls.percentage, sls.amount_owed
  FROM shopping_list_splits sls
  INNER JOIN household_members hm ON hm.id = sls.member_id
  WHERE sls.shopping_list_id = p_shopping_list_id
  ORDER BY hm.id ASC;
END;
```

Nota: a diferencia de `split_init`, este SP no exige `status = 'confirmed'` — permite consultar (devolviendo un array vacío) incluso antes de que exista una división, sin fallar.

- [ ] **Step 2: Migrar**

Run: `npm run db:migrate`
Expected: `loaded procedure: sp_shopping_list_split_get.sql` sin errores.

- [ ] **Step 3: Agregar el wrapper**

En `src/lib/db/procedures/shopping-list-splits.ts`, agregar debajo de `initSplit`:
```ts
export async function getSplit(
  shoppingListId: number,
  householdId: number,
): Promise<ShoppingListSplitRecord[]> {
  return callProcedure<ShoppingListSplitRecord>('sp_shopping_list_split_get', [
    shoppingListId,
    householdId,
  ]);
}
```

- [ ] **Step 4: Escribir los tests**

Agregar a `tests/db/procedures/shopping-list-splits.test.ts` (importar `getSplit` junto a `initSplit`):
```ts
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
```

- [ ] **Step 5: Correr los tests**

Run: `npx vitest run tests/db/procedures/shopping-list-splits.test.ts`
Expected: PASS, 8/8 (5 de Task 1 + 3 nuevos).

- [ ] **Step 6: `tsc --noEmit` y suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: limpio.

- [ ] **Step 7: Commit**

```bash
git add db/procedures/sp_shopping_list_split_get.sql src/lib/db/procedures/shopping-list-splits.ts tests/db/procedures/shopping-list-splits.test.ts
git commit -m "feat(shopping-list): add split-get procedure to read expense divisions"
```

---

## Task 3: Helper de transacciones + `sp_shopping_list_split_update` + `sp_shopping_list_split_validate` + `updateSplit` + tests

**Files:**
- Modify: `src/lib/db/call.ts` (extrae `callProcedureOn` reutilizable)
- Create: `src/lib/db/transaction.ts`
- Create: `db/procedures/sp_shopping_list_split_update.sql`
- Create: `db/procedures/sp_shopping_list_split_validate.sql`
- Modify: `src/lib/db/procedures/shopping-list-splits.ts` (agrega `updateSplit`)
- Modify: `tests/db/procedures/shopping-list-splits.test.ts` (agrega un `describe` nuevo)

**Interfaces:**
- Consumes: `ShoppingListSplitRecord`, `initSplit`, `getSplit` (Tasks 1-2), `pool` (`@/lib/db/pool`).
- Produces: `withTransaction<T>(fn) => Promise<T>` (`@/lib/db/transaction`) — infraestructura reutilizable para cualquier fase futura que necesite varias llamadas atómicas; `updateSplit(params): Promise<ShoppingListSplitRecord[]>` — usado por Task 4 (`updateSplitAction`).

Esta es la única tarea de esta fase que agrega infraestructura de bajo nivel nueva (transacciones reales sobre `mysql2/promise`) — hasta ahora el proyecto solo hacía `pool.query` directo por cada `CALL`, suficiente porque cada SP era atómico en sí mismo. Acá varias llamadas (una por miembro) deben confirmarse o revertirse juntas.

- [ ] **Step 1: Refactorizar `call.ts` para exponer la llamada parametrizada por conexión**

Reemplazar el contenido completo de `src/lib/db/call.ts`:
```ts
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from './pool';

const PROCEDURE_NAME_PATTERN = /^[a-z0-9_]+$/i;

type Queryable = Pool | PoolConnection;

export async function callProcedureOn<T extends RowDataPacket = RowDataPacket>(
  conn: Queryable,
  name: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!PROCEDURE_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid stored procedure name: ${name}`);
  }
  const placeholders = params.map(() => '?').join(', ');
  const [results] = await conn.query(`CALL ${name}(${placeholders})`, params);
  const rows = (results as unknown as [T[], ...unknown[]])[0];
  return Array.isArray(rows) ? rows : [];
}

export async function callProcedure<T extends RowDataPacket = RowDataPacket>(
  name: string,
  params: unknown[] = [],
): Promise<T[]> {
  return callProcedureOn<T>(pool, name, params);
}
```

Esto es un refactor puro — `callProcedure` mantiene exactamente la misma firma y comportamiento externo, solo delega en `callProcedureOn(pool, ...)`. Ningún archivo que ya importe `callProcedure` necesita cambios.

- [ ] **Step 2: Verificar que el refactor no rompió nada existente**

Run: `npx tsc --noEmit && npm test`
Expected: limpio, mismo conteo de tests que antes de este Step (8 en el archivo de splits, el resto sin cambios). Esto confirma el refactor antes de construir nada nuevo encima.

- [ ] **Step 3: Escribir el helper de transacciones**

`src/lib/db/transaction.ts`:
```ts
import type { RowDataPacket } from 'mysql2';
import { pool } from './pool';
import { callProcedureOn } from './call';

export type ProcedureCaller = <T extends RowDataPacket = RowDataPacket>(
  name: string,
  params?: unknown[],
) => Promise<T[]>;

export async function withTransaction<T>(fn: (call: ProcedureCaller) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const call: ProcedureCaller = (name, params = []) => callProcedureOn(conn, name, params);
    const result = await fn(call);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
```

- [ ] **Step 4: Escribir los dos SPs**

`db/procedures/sp_shopping_list_split_update.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_split_update;

CREATE PROCEDURE sp_shopping_list_split_update(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED,
  IN p_member_id INT UNSIGNED,
  IN p_percentage DECIMAL(5,2)
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_total DECIMAL(12,2);

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'confirmed';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or not confirmed';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM household_members
  WHERE id = p_member_id AND household_id = p_household_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member not found in this household';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM shopping_list_splits
  WHERE shopping_list_id = p_shopping_list_id AND member_id = p_member_id;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Split not found for this member';
  END IF;

  SELECT total_estimated INTO v_total
  FROM shopping_lists
  WHERE id = p_shopping_list_id;

  UPDATE shopping_list_splits
  SET percentage = p_percentage,
      amount_owed = ROUND(v_total * p_percentage / 100, 2)
  WHERE shopping_list_id = p_shopping_list_id AND member_id = p_member_id;

  SELECT sls.id, sls.shopping_list_id, sls.member_id, hm.display_name, sls.percentage, sls.amount_owed
  FROM shopping_list_splits sls
  INNER JOIN household_members hm ON hm.id = sls.member_id
  WHERE sls.shopping_list_id = p_shopping_list_id AND sls.member_id = p_member_id;
END;
```

`db/procedures/sp_shopping_list_split_validate.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_shopping_list_split_validate;

CREATE PROCEDURE sp_shopping_list_split_validate(
  IN p_shopping_list_id INT UNSIGNED,
  IN p_household_id INT UNSIGNED
)
BEGIN
  DECLARE v_exists INT;
  DECLARE v_sum DECIMAL(6,2);

  SELECT COUNT(*) INTO v_exists
  FROM shopping_lists
  WHERE id = p_shopping_list_id AND household_id = p_household_id AND status = 'confirmed';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shopping list not found or not confirmed';
  END IF;

  SELECT SUM(percentage) INTO v_sum
  FROM shopping_list_splits
  WHERE shopping_list_id = p_shopping_list_id;

  IF v_sum IS NULL OR v_sum <> 100.00 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Split percentages must sum to 100';
  END IF;

  SELECT sls.id, sls.shopping_list_id, sls.member_id, hm.display_name, sls.percentage, sls.amount_owed
  FROM shopping_list_splits sls
  INNER JOIN household_members hm ON hm.id = sls.member_id
  WHERE sls.shopping_list_id = p_shopping_list_id
  ORDER BY hm.id ASC;
END;
```

- [ ] **Step 5: Migrar**

Run: `npm run db:migrate`
Expected: `loaded procedure: sp_shopping_list_split_update.sql` y `loaded procedure: sp_shopping_list_split_validate.sql` sin errores.

- [ ] **Step 6: Agregar `updateSplit` al wrapper**

En `src/lib/db/procedures/shopping-list-splits.ts`, agregar el import y la función:
```ts
import { withTransaction } from '../transaction';

// ...(al final del archivo)

export async function updateSplit(params: {
  shoppingListId: number;
  householdId: number;
  updates: Array<{ memberId: number; percentage: number }>;
}): Promise<ShoppingListSplitRecord[]> {
  return withTransaction(async (call) => {
    for (const update of params.updates) {
      await call('sp_shopping_list_split_update', [
        params.shoppingListId,
        params.householdId,
        update.memberId,
        update.percentage,
      ]);
    }
    return call<ShoppingListSplitRecord>('sp_shopping_list_split_validate', [
      params.shoppingListId,
      params.householdId,
    ]);
  });
}
```

- [ ] **Step 7: Escribir los tests**

Agregar a `tests/db/procedures/shopping-list-splits.test.ts` (importar `updateSplit` y `getSplit` junto a los demás):
```ts
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
```

- [ ] **Step 8: Correr los tests**

Run: `npx vitest run tests/db/procedures/shopping-list-splits.test.ts`
Expected: PASS, 11/11 (8 previos + 3 nuevos). El segundo test (`rolls back all updates`) es el que prueba que `withTransaction` realmente revierte — presta atención si falla, indicaría que el `ROLLBACK` no está funcionando.

- [ ] **Step 9: `tsc --noEmit` y suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: limpio.

- [ ] **Step 10: Commit**

```bash
git add src/lib/db/call.ts src/lib/db/transaction.ts db/procedures/sp_shopping_list_split_update.sql db/procedures/sp_shopping_list_split_validate.sql src/lib/db/procedures/shopping-list-splits.ts tests/db/procedures/shopping-list-splits.test.ts
git commit -m "feat(shopping-list): add transactional split-update with 100% validation"
```

---

## Task 4: Server Actions + UI (`SplitPanel`) + enganche en confirmación

**Files:**
- Modify: `src/app/compras/actions.ts`
- Create: `src/components/shopping-list/SplitPanel.tsx`
- Modify: `src/app/compras/confirm-purchase-button.tsx`

**Interfaces:**
- Consumes: `initSplit`, `getSplit`, `updateSplit`, `ShoppingListSplitRecord` (Tasks 1-3); `requireMembership` (`@/lib/household/require-membership`); `showError`/`showSuccess` (`@/lib/ui/alerts`).
- Produces: Server Actions `getSplitAction(shoppingListId): Promise<GetSplitState>` y `updateSplitAction(shoppingListId, updates): Promise<UpdateSplitState>`; componente `<SplitPanel shoppingListId onClose />`.

No hay tests automatizados nuevos en esta tarea — sigue la convención ya establecida en Fase 2 Task 5/6 (tareas de wiring de Server Action + UI se verifican con `npm test`/`npm run build`/`tsc --noEmit` sin regresión, más una verificación manual end-to-end real, dado que esta es la pieza que el usuario realmente va a tocar).

- [ ] **Step 1: Extender `confirmPurchaseAction` para inicializar la división automáticamente**

En `src/app/compras/actions.ts`, agregar el import:
```ts
import {
  getSplit,
  initSplit,
  updateSplit,
  type ShoppingListSplitRecord,
} from '@/lib/db/procedures/shopping-list-splits';
```

Modificar el cuerpo de `confirmPurchaseAction` (el bloque `try` existente) para que quede así:
```ts
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
    await initSplit(shoppingListId, membership.id);
  } catch {
    return { error: 'No se pudo confirmar la compra. Intentá de nuevo.' };
  }

  revalidatePath('/compras');
  return { error: null };
}
```

- [ ] **Step 2: Agregar las dos Server Actions nuevas al final de `actions.ts`**

```ts
export interface GetSplitState {
  splits: ShoppingListSplitRecord[];
  error: string | null;
}

export async function getSplitAction(shoppingListId: number): Promise<GetSplitState> {
  const membership = await requireMembership();
  try {
    const splits = await getSplit(shoppingListId, membership.id);
    return { splits, error: null };
  } catch {
    return { splits: [], error: 'No se pudo cargar la división del gasto.' };
  }
}

export interface UpdateSplitState {
  splits: ShoppingListSplitRecord[];
  error: string | null;
}

export async function updateSplitAction(
  shoppingListId: number,
  updates: Array<{ memberId: number; percentage: number }>,
): Promise<UpdateSplitState> {
  const membership = await requireMembership();

  if (updates.length === 0) {
    return { splits: [], error: 'Datos inválidos' };
  }

  try {
    const splits = await updateSplit({
      shoppingListId,
      householdId: membership.id,
      updates,
    });
    revalidatePath('/compras');
    return { splits, error: null };
  } catch {
    return { splits: [], error: 'Los porcentajes deben sumar 100%.' };
  }
}
```

- [ ] **Step 3: Crear el componente `SplitPanel`**

`src/components/shopping-list/SplitPanel.tsx`:
```tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getSplitAction, updateSplitAction } from '@/app/compras/actions';
import { showError, showSuccess } from '@/lib/ui/alerts';
import type { ShoppingListSplitRecord } from '@/lib/db/procedures/shopping-list-splits';

export function SplitPanel({
  shoppingListId,
  onClose,
}: {
  shoppingListId: number;
  onClose: () => void;
}) {
  const [splits, setSplits] = useState<ShoppingListSplitRecord[] | null>(null);
  const [percentages, setPercentages] = useState<Record<number, number>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getSplitAction(shoppingListId).then((result) => {
      if (result.error) {
        showError(result.error);
        return;
      }
      setSplits(result.splits);
      setPercentages(Object.fromEntries(result.splits.map((s) => [s.member_id, s.percentage])));
    });
  }, [shoppingListId]);

  const sum = Object.values(percentages).reduce((acc, value) => acc + value, 0);
  const sumIsValid = Math.abs(sum - 100) < 0.001;

  function handleSave(): void {
    const updates = Object.entries(percentages).map(([memberId, percentage]) => ({
      memberId: Number(memberId),
      percentage,
    }));
    startTransition(() => {
      updateSplitAction(shoppingListId, updates).then((result) => {
        if (result.error) {
          showError(result.error);
          return;
        }
        setSplits(result.splits);
        showSuccess('División guardada.');
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
          <h2 className="h5 mb-0">Dividir gasto</h2>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" />
        </div>

        {splits === null ? (
          <p className="text-body-secondary">Cargando…</p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {splits.map((split) => (
              <div key={split.member_id}>
                <label className="form-label">{split.display_name}</label>
                <div className="input-group">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    className="form-control"
                    value={percentages[split.member_id] ?? 0}
                    onChange={(e) =>
                      setPercentages((prev) => ({
                        ...prev,
                        [split.member_id]: Number(e.target.value),
                      }))
                    }
                  />
                  <span className="input-group-text">%</span>
                </div>
              </div>
            ))}
            <div className={sumIsValid ? 'text-success' : 'text-danger'}>
              Total: {sum.toFixed(2)}%
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!sumIsValid || isPending}
              onClick={handleSave}
            >
              {isPending ? 'Guardando…' : 'Guardar división'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Enganchar el panel en `ConfirmPurchaseButton`**

Reemplazar el contenido completo de `src/app/compras/confirm-purchase-button.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPurchaseAction } from './actions';
import { SplitPanel } from '@/components/shopping-list/SplitPanel';
import { showError, showSuccess } from '@/lib/ui/alerts';

export function ConfirmPurchaseButton({ shoppingListId }: { shoppingListId: number }) {
  const [isPending, startTransition] = useTransition();
  const [confirmedListId, setConfirmedListId] = useState<number | null>(null);
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
          setConfirmedListId(shoppingListId);
          router.refresh();
        })
        .catch(() => {
          showError('No se pudo confirmar la compra. Intentá de nuevo.');
        });
    });
  }

  return (
    <>
      <button type="button" className="btn btn-primary" disabled={isPending} onClick={handleConfirm}>
        {isPending ? 'Confirmando…' : 'Confirmar compra'}
      </button>
      {confirmedListId ? (
        <SplitPanel shoppingListId={confirmedListId} onClose={() => setConfirmedListId(null)} />
      ) : null}
    </>
  );
}
```

Nota de diseño: `setConfirmedListId(shoppingListId)` captura el id de la lista **antes** de llamar `router.refresh()`. El refresh regenera `/compras` con una lista `open` nueva (ya que la anterior quedó `confirmed`), pero el `SplitPanel` ya abierto sigue referenciando el id capturado en el closure — no se ve afectado por el cambio de prop en el padre.

- [ ] **Step 5: Build y tipos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores; `/compras` sigue apareciendo en la tabla de rutas.

- [ ] **Step 6: Suite completa**

Run: `npm test`
Expected: 11/11 en `shopping-list-splits.test.ts`, sin regresión en el resto (mismo conteo total que al cierre de Task 3).

- [ ] **Step 7: Verificación manual end-to-end (obligatoria, dado que es la pieza visible de la fase)**

Con `npm run dev` corriendo y MariaDB (XAMPP, puerto 3307) activo:
1. Crear 2 usuarios reales en el mismo hogar (uno crea el hogar, el otro se une por invitación).
2. Crear un producto con déficit real, ir a `/compras`, confirmar la compra.
3. Verificar que aparece el modal "Dividir gasto" con 2 filas al 50%/50% ya precargadas y el total en verde.
4. Cambiar a 70/30, click "Guardar división" — debe mostrar éxito y persistir.
5. Recargar `/compras` (nueva lista abierta) y, por una llamada directa a `getSplitAction`/consulta a la DB, confirmar que la fila de `shopping_list_splits` de la lista ya confirmada sigue en 70/30 (no se pierde al generarse la lista nueva).
6. Intentar guardar con porcentajes que sumen 60 — el botón "Guardar división" debe estar deshabilitado (validación en vivo), y si se fuerza vía la Server Action directamente, debe rechazar con el mensaje de error sin alterar los valores previos en la DB.

- [ ] **Step 8: Commit**

```bash
git add src/app/compras/actions.ts src/components/shopping-list/SplitPanel.tsx src/app/compras/confirm-purchase-button.tsx
git commit -m "feat(shopping-list): wire expense split into the purchase confirmation flow"
```

---

## Cierre de fase

Después de Task 4: correr `npm test` + `npm run build` + `npx tsc --noEmit` una vez más sobre el estado final del branch, luego usar `superpowers:subagent-driven-development`'s paso de revisión final de todo el branch (modelo más capaz) antes de ofrecer el merge a `main`, exactamente como en Fase 2.

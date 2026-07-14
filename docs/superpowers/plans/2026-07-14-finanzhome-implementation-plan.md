# FinanzHome — Plan de Implementación por Fases

> **Nota:** Este es un plan de **arquitectura y alcance por fases**, para revisar antes de tocar código (así lo pidió el dueño del proyecto). No contiene SQL ni TypeScript completos a propósito. Cuando se apruebe el orden de fases, cada fase debe convertirse en su propio plan de tareas TDD (siguiendo `superpowers:writing-plans`) y ejecutarse con `superpowers:subagent-driven-development` o `superpowers:executing-plans`.

**Goal:** Construir FinanzHome, una PWA mobile-first de un solo hogar para inventario/compras y finanzas compartidas, con toda la lógica de negocio en stored procedures de MariaDB.

**Arquitectura:** Next.js 16 (App Router, Server Actions) como capa fina de presentación e invocación; MariaDB 10.4.32 concentra reglas de negocio en stored procedures; `mysql2/promise` es el único puente entre ambos, sin ORM ni SQL ad-hoc en el servidor.

**Tech Stack:** Next.js 16 + React 19 + TypeScript · Bootstrap 5 + Bootstrap Icons · SweetAlert2 · Zustand · Framer Motion · Highcharts + `highcharts-react-official` · MySQL/MariaDB 10.4.32 + `mysql2/promise` · next-auth v5 (Auth.js) · Resend · zod · date-fns · bcryptjs · PWA (`next-pwa` o service worker manual).

## Global Constraints

- **DB-first, sin ORM:** toda regla de negocio (faltantes de inventario, divisiones de gasto, vencimientos, recordatorios, agregados de dashboard) vive en stored procedures. El backend solo hace `CALL sp_xxx(...)`.
- **MariaDB 10.4.32:** no usar `JSON_TABLE` (llega recién en MariaDB 10.6). Cualquier array JSON que deba procesarse dentro de un SP se recorre con `JSON_LENGTH` + `WHILE` + `JSON_EXTRACT(json, CONCAT('$[',i,']'))`. Ver sección "Patrón JSON+WHILE" más abajo.
- **Mobile-first real:** cada pantalla se diseña primero para el ancho de un celular (~360–420px) con Bootstrap 5 grid/utilities; el layout desktop es una expansión, no el punto de partida.
- **PWA como entrega principal:** instalable, ícono propio, funcionamiento offline básico de la lista de compras (el caso de uso ancla: celular sin señal, adentro del supermercado).
- **Un solo hogar (no multi-tenant):** varios `household_members` comparten un `household_id`. Aun así, todo SP recibe `household_id`/`member_id` y valida pertenencia — es barato ahora y evita fugas de datos si el modelo cambia después.
- **Multi-moneda CRC/USD:** todo monto que se carga (producto, ítem de compra, gasto recurrente, meta/aporte de ahorro) elige su moneda (colones o dólares). El tipo de cambio se carga manualmente (sin integraciones externas, igual que los precios) en un módulo dedicado, y toda agregación (totales, dashboard) convierte a una moneda de visualización usando ese tipo de cambio.
- **Carpeta `lib/db/procedures/*.ts`:** un archivo TS por dominio, cada uno exporta funciones "wrapper" 1:1 (o casi) con los SPs de ese dominio. Nada de lógica de negocio ahí — solo mapeo de tipos y `CALL`.

---

## Modelo de datos (vista completa)

Se presenta entero acá porque varias tablas se referencian entre fases; cada fase abajo indica cuáles crea.

**Moneda** *(nuevo — usado por todas las demás tablas con montos)*
- `currencies` — catálogo fijo: `CRC` (Colón), `USD` (Dólar), con símbolo (`₡`, `$`)
- `exchange_rates` — historial de tipo de cambio: `rate_crc_per_usd`, `effective_date`, `created_by_member_id`, `created_at`. Se **inserta una fila nueva por cada actualización**, nunca se pisa la anterior, para poder convertir montos históricos con el tipo de cambio vigente en su fecha.

**Identidad y hogar**
- `users` — credenciales (email, password_hash con bcryptjs, nombre)
- `households` — un registro por hogar, `default_currency_id` (moneda preseleccionada en formularios nuevos, no una conversión forzada)
- `household_members` — vincula `user_id` ↔ `household_id`, guarda `payment_day` (día de cobro de referencia, 1–31), rol, `joined_at`
- `household_invitations` — `email`, `token`, `status` (pending/accepted/expired), `expires_at`, `invited_by_member_id`

**Inventario**
- `product_categories`, `units_of_measure` (catálogos simples, seedeados)
- `products` — `household_id`, `name`, `category_id`, `unit_id`, `optimal_quantity`, `current_quantity`, `default_price` (nullable), `default_price_currency_id`, `is_active`, `created_by_member_id`

**Lista de compras**
- `shopping_lists` — `household_id`, `status` (open/confirmed/cancelled), `created_by_member_id`, `total_estimated`, `total_estimated_currency_id` (moneda de visualización del total)
- `shopping_list_items` — `shopping_list_id`, `product_id`, `quantity_needed`, `unit_price`, `unit_price_currency_id`, `is_extra` (no venía del déficit), `is_purchased`
- `shopping_list_splits` — `shopping_list_id`, `member_id`, `percentage`, `amount_owed` (en `total_estimated_currency_id` de la lista)

**Finanzas recurrentes**
- `expense_categories`
- `recurring_expenses` — `household_id`, `name`, `category_id`, `amount`, `currency_id`, `periodicity` (weekly/biweekly/one_time), `due_day_config`, `withdrawal_day` (nullable, solo weekly/biweekly), `responsible_member_id`, `is_active`, `created_by_member_id`
- `expense_occurrences` — instancia concreta de un ciclo: `recurring_expense_id`, `period_start`, `period_end`, `due_date`, `amount`, `currency_id` (copiado del gasto al generarse), `is_paid`, `paid_at`, `paid_by_member_id`
- `recurring_expense_shares` — % default por miembro, editable, se reutiliza en cada ciclo nuevo
- `expense_occurrence_shares` — snapshot del % al momento de generar cada `occurrence` (para no alterar retroactivamente ciclos ya generados si el default cambia después)
- `reminder_log` — `expense_occurrence_id`, `member_id`, `reminder_type` (due_soon/overdue_daily/withdrawal), `sent_date` (idempotencia: un envío por tipo/día)

**Metas de ahorro**
- `savings_goals` — `household_id`, `name`, `target_amount`, `currency_id`, `target_date`, `is_shared`
- `savings_goal_members` — para metas compartidas, % de responsabilidad opcional
- `savings_contributions` — `goal_id`, `member_id`, `amount`, `currency_id` (un aporte puede hacerse en colones o dólares aunque la meta esté fijada en otra moneda), `contributed_at`

**Reservado para fase futura (ver Fase 10)** — no se crea todavía: `budget_limits`, `audit_log`.

> Decisión de diseño barata: todas las tablas mutables de arriba ya incluyen quién las creó/pagó/aportó (`created_by_member_id`, `paid_by_member_id`, `member_id` en contribuciones). Eso deja el terreno preparado para un futuro `audit_log` sin tener que rehacer histórico.

### Patrón JSON+WHILE (el caso MariaDB-flagged)

El único punto donde de verdad hace falta pasar un array variable a un SP es **confirmar una compra** (10–50 ítems de una sola vez, de forma atómica). Ahí se pasa un `JSON_ARRAY` como parámetro y el SP lo recorre así (descripción, no código):
1. `SET v_len = JSON_LENGTH(p_items_json)`
2. `WHILE v_i < v_len DO`
3. `SET v_item = JSON_EXTRACT(p_items_json, CONCAT('$[', v_i, ']'))`
4. extraer campos con `JSON_EXTRACT(v_item, '$.product_id')`, etc.
5. `INSERT`/`UPDATE` fila por fila, `SET v_i = v_i + 1`, `END WHILE`

Es portable a MySQL 8+ también, así que no se pierde nada por evitar `JSON_TABLE`.

Para los demás casos "N filas variables" (splits de compra, % de gasto compartido), **N es chico** (cantidad de miembros del hogar, típicamente 2–6): en vez de JSON+WHILE se prefiere que el wrapper TS haga una llamada al SP por miembro dentro de una misma transacción (`pool.getConnection()` + `beginTransaction`/`commit`). Es más simple de leer y depurar sin ganar nada evitándolo.

---

## Fase 0 — Fundaciones (hogar, miembros, auth, layout base)

**Objetivo:** proyecto arrancando, login funcional, un hogar con miembros, layout mobile-first con navegación inferior, shell de PWA instalable.

**Tablas:** `users`, `households`, `household_members`, `household_invitations`

**Stored procedures:**
- `sp_user_register(email, password_hash, name)`
- `sp_user_get_by_email(email)` — usado por el `authorize()` de next-auth
- `sp_household_create(name, creator_user_id)` — crea hogar + primer `household_member`
- `sp_household_invitation_create(household_id, email, token, invited_by_member_id, expires_at)`
- `sp_household_invitation_accept(token, user_id, payment_day)` — crea el `household_member`, marca invitación `accepted`
- `sp_household_get_for_user(user_id)` — hogar + lista de miembros

**Wrappers TS (`lib/db/procedures/`):**
- `auth.ts`: `registerUser`, `getUserByEmail`
- `household.ts`: `createHousehold`, `createInvitation`, `acceptInvitation`, `getHouseholdForUser`
- `lib/db/pool.ts`: singleton de `mysql2/promise` pool
- `lib/db/call.ts`: helper genérico `callProcedure(name, params)` que estandariza `CALL sp_x(?,...)` y el manejo de result sets

**UI (mobile-first):**
- `/login`, `/register`
- `/onboarding`: crear hogar o aceptar invitación (pide `payment_day` del miembro)
- Layout base: bottom navigation fija (Bootstrap, iconos Bootstrap Icons), `SessionProvider` de next-auth, store Zustand base (sesión de UI, no de servidor), wrapper de SweetAlert2 para confirmaciones
- `manifest.json` + íconos + registro de `SessionProvider`-safe service worker vacío (el cacheo real llega en Fase 4)

**Notas MariaDB:** ninguna restricción especial acá; son tablas e inserts simples.

**Decisión de auth recomendada:** next-auth v5 con **Credentials provider + estrategia JWT** (sin adapter de base de datos). Los adapters oficiales de next-auth hacen SQL directo por su cuenta, lo cual choca con "solo SPs" — evitamos ese conflicto no usando adapter y guardando `household_id`/`member_id` como claims del JWT. Confirmame si esto es aceptable o preferís otra estrategia.

**Resend entra desde esta fase**, no recién en la de recordatorios: se usa para el email de invitación (`household_invitation_create` dispara un envío desde el Server Action, no desde el SP).

### Módulo de moneda y tipo de cambio (parte de esta fase — todo lo que carga montos depende de esto)

**Tablas:** `currencies` (seed: CRC, USD), `exchange_rates`

**Stored procedures:**
- `sp_currency_list()` — para poblar los selectores de moneda en toda la app
- `sp_exchange_rate_set(rate_crc_per_usd, effective_date, created_by_member_id)` — **inserta** una fila nueva (no hace `UPDATE`), así el historial queda completo
- `sp_exchange_rate_get_latest(as_of_date)` — la tasa vigente en o antes de esa fecha (por defecto, hoy)
- `sp_exchange_rate_history(household_id, limit)` — para mostrar el historial de cambios

**Cómo se convierte un monto (patrón reutilizado por Fases 2, 8 y 9):** en vez de una `FUNCTION` de MySQL, cada SP que necesita convertir usa una **subconsulta correlacionada** contra `exchange_rates` en el propio `SELECT`, por ejemplo (descripción, no código): `(SELECT rate_crc_per_usd FROM exchange_rates er WHERE er.effective_date <= x.due_date ORDER BY er.effective_date DESC LIMIT 1)`, y con eso multiplica o divide según la moneda de origen/destino.

**Wrappers TS:** `currency.ts` → `listCurrencies`, `setExchangeRate`, `getLatestExchangeRate`, `getExchangeRateHistory`

**UI:**
- `/configuracion/moneda`: tipo de cambio actual bien visible, formulario "Actualizar tipo de cambio" (monto de colones por 1 dólar + fecha efectiva), historial de cambios
- Componente reusable `<CurrencyAmountInput>` (monto + selector CRC/USD) usado en los formularios de producto, ítem de compra, gasto y meta/aporte de ahorro
- Selector "Ver en: ₡ / $" en el dashboard (Fase 8) para elegir la moneda de visualización de los agregados

**Nota MariaDB (la que de verdad importa acá):** se descartó implementar la conversión como `FUNCTION` almacenada. Una `CREATE FUNCTION` que hace `SELECT` sobre `exchange_rates` no es determinística, y con `binary logging` activado (usual si hay backups/replicación) MariaDB exige o bien privilegio `SUPER` o bien `log_bin_trust_function_creators=1` en el servidor para poder crearla — una fricción de configuración innecesaria para un proyecto personal. Repetir la subconsulta correlacionada dentro de cada SP evita ese problema por completo y sigue siendo 100% SQL estándar, portable a MariaDB 10.4.32 y a MySQL 8+.

---

## Fase 1 — Inventario del hogar

**Objetivo:** cargar productos con cantidad óptima fija y cantidad actual, editable antes de ir a comprar.

**Tablas:** `product_categories`, `units_of_measure`, `products`

**Stored procedures:**
- `sp_category_list()`, `sp_category_create(name)`
- `sp_unit_list()`
- `sp_product_list(household_id)`
- `sp_product_create(household_id, name, category_id, unit_id, optimal_quantity, current_quantity, default_price, default_price_currency_id, created_by_member_id)`
- `sp_product_update(product_id, name, category_id, unit_id, optimal_quantity, default_price, default_price_currency_id)`
- `sp_product_update_current_quantity(product_id, current_quantity)`
- `sp_product_deactivate(product_id)` (soft delete vía `is_active`)

**Wrappers TS:** `products.ts` → `listProducts`, `createProduct`, `updateProduct`, `updateCurrentQuantity`, `deactivateProduct`, `listCategories`, `listUnits`

**UI:**
- `/inventario`: lista agrupada por categoría, stepper +/− táctil para `current_quantity` (feedback con Framer Motion), badge visual si `current_quantity < optimal_quantity`
- Bottom sheet (Bootstrap offcanvas) "+ Producto" con categoría/unidad/óptimo/precio, usando `<CurrencyAmountInput>` para el precio (₡ o $)
- Modal rápido de edición de cantidad óptima

**Notas MariaDB:** sin restricciones especiales.

---

## Fase 2 — Lista de compras inteligente

**Objetivo:** generar automáticamente la lista desde el déficit, permitir ítems extra, mostrar total estimado, confirmar y actualizar inventario.

**Tablas:** `shopping_lists`, `shopping_list_items`

**Stored procedures:**
- `sp_shopping_list_generate(household_id, created_by_member_id)` — crea lista `open` + inserta un `shopping_list_item` por cada producto con `optimal_quantity - current_quantity > 0`, calculando `quantity_needed` y usando `default_price`/`default_price_currency_id` como `unit_price`/`unit_price_currency_id` inicial
- `sp_shopping_list_add_item(shopping_list_id, product_id, quantity_needed, unit_price, unit_price_currency_id, is_extra)` — para ítems extra (producto ya existente en `products`, aunque su óptimo esté en 0/NULL) o para ajustar cantidad/precio de un ítem generado
- `sp_shopping_list_item_update(item_id, quantity_needed, unit_price, unit_price_currency_id, is_purchased)`
- `sp_shopping_list_get(shopping_list_id, p_display_currency_id)` — ítems (cada uno con su moneda original) + `total_estimated` **convertido a `p_display_currency_id`**: cada fila se pasa por la subconsulta correlacionada de tipo de cambio (ver "Módulo de moneda" en Fase 0) antes de sumar, así una lista con ítems en ₡ y en $ da un total correcto en una sola moneda
- `sp_shopping_list_confirm(shopping_list_id, items_json, p_display_currency_id)` — **usa el patrón JSON+WHILE**: por cada ítem, `products.current_quantity += quantity_needed`; guarda `total_estimated`/`total_estimated_currency_id` ya convertidos; marca `shopping_lists.status = 'confirmed'`. Todo en una transacción.

**Wrappers TS:** `shopping-list.ts` → `generateShoppingList`, `addItem`, `updateItem`, `getShoppingList`, `confirmShoppingList`

**UI:**
- `/compras`: checklist con targets táctiles grandes, cada ítem muestra su precio con el símbolo de su moneda (₡/$), swipe u opción "quitar", barra inferior sticky con total estimado (en la moneda de visualización elegida) y botón "Confirmar compra"
- Buscador/autocomplete de productos existentes para agregar como extra + atajo "crear producto nuevo" inline
- Confirmación con SweetAlert2 antes de aplicar cambios de inventario (irreversible desde la UI)

**Notas MariaDB:** este es el caso donde se evita `JSON_TABLE` explícitamente — `sp_shopping_list_confirm` recorre `items_json` con `WHILE` + `JSON_EXTRACT`. La conversión de moneda dentro del mismo SP usa la subconsulta correlacionada (no una `FUNCTION`), por la misma razón explicada en Fase 0.

---

## Fase 3 — División del gasto de la compra

**Objetivo:** dividir el total de una compra confirmada entre miembros, 50/50 por defecto pero ajustable por compra.

**Tablas:** `shopping_list_splits`

**Stored procedures:**
- `sp_shopping_list_split_init(shopping_list_id)` — al confirmar, reparte 100% en partes iguales entre los miembros activos del hogar (no asume que son exactamente 2)
- `sp_shopping_list_split_update(shopping_list_id, member_id, percentage)` — se llama una vez por miembro desde el wrapper (transacción), y al final valida que la suma de porcentajes de esa lista sea 100
- `sp_shopping_list_split_get(shopping_list_id)`

**Wrappers TS:** `shopping-list-splits.ts` → `initSplit`, `updateSplit` (recibe array chico, loopea llamadas dentro de una transacción), `getSplit`

**UI:** paso de "dividir gasto" dentro del flujo de confirmación de compra — inputs de % por miembro (2–4 personas típicamente), validación en vivo de que sumen 100%.

**Notas MariaDB:** sin restricciones; se usa el patrón de "loop de llamadas chico" en vez de JSON+WHILE, documentado arriba.

---

## Fase 4 — PWA offline para la lista de compras

**Objetivo:** poder ver la última lista de compras confirmada/abierta sin señal, dentro del supermercado.

**Tablas:** ninguna nueva.

**Piezas nuevas (no son SPs, son infraestructura de plataforma):**
- Service worker (via `next-pwa` o configuración manual compatible con App Router de Next 16) con estrategia *stale-while-revalidate* sobre un Route Handler de solo lectura `GET /api/shopping-list/current`
- Detección de `navigator.onLine` para deshabilitar mutaciones (agregar ítem, confirmar) mientras está offline, dejando solo lectura del cache
- Prompt de instalación (`beforeinstallprompt`) como componente propio

**Wrappers TS:** ninguno nuevo — reutiliza `getShoppingList` de Fase 2 detrás del Route Handler.

**UI:** `OfflineBanner`, `InstallPromptButton`, ajuste de `/compras` para leer de cache cuando no hay red.

**Notas MariaDB:** no aplica (capa de cliente).

---

## Fase 5 — Gastos y servicios recurrentes

**Objetivo:** registrar gastos/servicios con periodicidad (semanal/quincenal/pago único) y saber cuándo vence cada ciclo.

**Tablas:** `expense_categories`, `recurring_expenses`, `expense_occurrences`

**Stored procedures:**
- `sp_expense_category_list()`, `sp_expense_category_create(name)`
- `sp_recurring_expense_create(household_id, name, category_id, amount, currency_id, periodicity, due_day_config, withdrawal_day, responsible_member_id, created_by_member_id)`
- `sp_recurring_expense_update(recurring_expense_id, ..., currency_id)`
- `sp_recurring_expense_deactivate(recurring_expense_id)`
- `sp_expense_occurrence_generate_next(recurring_expense_id)` — calcula `period_start/period_end/due_date` según `periodicity`:
  - `weekly`: siguiente `due_day_config` (día de la semana) tras el último `period_end`
  - `biweekly`: +14 días desde el último ciclo
  - `one_time`: una sola occurrence con `due_date` fija, no se regenera
  - usa solo `DATE_ADD`/`LAST_DAY`, sin JSON — no hay restricción MariaDB acá
- `sp_expense_occurrence_list(household_id, filters)`
- `sp_expense_occurrence_mark_paid(occurrence_id, paid_by_member_id)`

**Wrappers TS:** `recurring-expenses.ts` → `listExpenseCategories`, `createRecurringExpense`, `updateRecurringExpense`, `deactivateRecurringExpense`, `generateNextOccurrence`, `listOccurrences`, `markOccurrencePaid`

**UI:**
- `/gastos`: lista con chip de estado (al día / vence pronto / vencido), próxima fecha de vencimiento
- Formulario crear/editar: `<CurrencyAmountInput>` para el monto, selector de periodicidad que muestra/oculta campos (`due_day_config`, `withdrawal_day` solo si no es `one_time`)
- Detalle de gasto con historial de `occurrences` y botón "Marcar como pagado"

**Notas MariaDB:** ninguna restricción especial; toda la aritmética de fechas es estándar SQL disponible en 10.4.32.

---

## Fase 6 — Gastos compartidos entre miembros

**Objetivo:** cualquier gasto puede repartirse entre miembros, con % que se guarda como default y se reutiliza (editable) en los siguientes ciclos.

**Tablas:** `recurring_expense_shares`, `expense_occurrence_shares`

**Stored procedures:**
- `sp_recurring_expense_share_set(recurring_expense_id, member_id, percentage)` — una llamada por miembro desde el wrapper, en transacción, valida suma = 100 al final
- `sp_recurring_expense_share_list(recurring_expense_id)`
- `sp_expense_occurrence_shares_snapshot(occurrence_id)` — se invoca automáticamente al generar cada `occurrence` (dentro del mismo flujo que `sp_expense_occurrence_generate_next`), copiando el default vigente para no alterar retroactivamente ciclos ya generados

**Wrappers TS:** `expense-shares.ts` → `setRecurringExpenseShares`, `listRecurringExpenseShares` (el snapshot se dispara desde el wrapper de `generateNextOccurrence`, no necesita wrapper propio expuesto a la UI)

**UI:** sección "Compartir con" dentro del formulario de gasto — checklist de miembros + % (precargado con el último default guardado si se está editando).

**Notas MariaDB:** mismo patrón de "loop chico" que Fase 3, no JSON+WHILE.

---

## Fase 7 — Recordatorios por correo (Resend)

**Objetivo:** avisar 1 día antes del vencimiento, insistir a diario desde el día de pago del responsable hasta que se marque pagado, y avisar el día de retiro de fondos.

**Tablas:** `reminder_log`

**Stored procedures (solo lectura + logging, el envío real de email pasa por TS/Resend porque un SP no puede hacer HTTP):**
- `sp_reminder_get_pending(today_date)` — calcula, en una sola pasada, las tres categorías:
  1. **due_soon**: `occurrence.due_date = today + 1` y `is_paid = 0` y no hay `reminder_log` de tipo `due_soon` para hoy
  2. **overdue_daily**: `occurrence.due_date < today`, `is_paid = 0`, y `today >= próximo payment_day del responsable en o después de due_date` (aritmética con `DAY()`/`DATE_ADD`, sin JSON), y no hay `reminder_log` de tipo `overdue_daily` para hoy
  3. **withdrawal**: `recurring_expenses.withdrawal_day = DAY(today)` para gastos weekly/biweekly activos, sin `reminder_log` de tipo `withdrawal` para hoy
- `sp_reminder_log_sent(occurrence_id, member_id, reminder_type, sent_date)` — idempotencia (un envío por tipo/ocurrencia/día)

**Wrappers TS:** `reminders.ts` → `getPendingReminders`, `logReminderSent`; `lib/email/resend.ts` → `sendReminderEmail(type, occurrence, member)`

**Infraestructura (fuera del alcance de "solo SPs", es orquestación):**
- Route Handler `POST /api/cron/reminders`, protegido con un secret en header, que: llama `getPendingReminders` → envía por Resend → llama `logReminderSent` por cada envío exitoso
- **Disparador diario: Vercel Cron Jobs** (decidido — el hosting es Vercel), configurado en `vercel.json` para pegarle una vez al día a `/api/cron/reminders`.

**UI:** no hay pantalla nueva obligatoria para el MVP — "Marcar como pagado" (ya construido en Fase 5) es lo que corta el loop diario.

**Notas MariaDB:** sin restricciones; toda la lógica de fechas es DATE/INT estándar.

---

## Fase 8 (post-MVP) — Dashboard financiero (Highcharts)

**Objetivo:** visualizar gasto por categoría, evolución mensual, saldo entre miembros y progreso de metas.

**Tablas:** ninguna nueva — lee de `expense_occurrences`, `expense_occurrence_shares`, `shopping_lists`/`shopping_list_splits`, y (si Fase 9 ya está) `savings_goals`.

**Stored procedures (agregaciones, siguen siendo DB-first):** todas reciben `p_display_currency_id` y convierten cada fila (colones o dólares, según corresponda) a esa moneda antes de sumar, usando la subconsulta correlacionada de `exchange_rates` (Fase 0) — así el dashboard nunca suma ₡ con $ directamente.
- `sp_dashboard_expense_by_category(household_id, month, p_display_currency_id)`
- `sp_dashboard_monthly_trend(household_id, months_back, p_display_currency_id)`
- `sp_dashboard_member_balances(household_id, p_display_currency_id)` — matriz de deuda neta combinando `shopping_list_splits` + `expense_occurrence_shares`
- `sp_dashboard_savings_progress(household_id, p_display_currency_id)` (requiere Fase 9)

**Wrappers TS:** `dashboard.ts` con una función por SP.

**UI:** `/dashboard` con Highcharts (pie/columna gasto por categoría, línea evolución mensual), tarjeta "quién le debe a quién", barras de progreso de metas, y el selector "Ver en: ₡ / $" (del módulo de moneda) que re-consulta los SPs con el `p_display_currency_id` elegido.

**Notas MariaDB:** MariaDB 10.4 sí soporta funciones de ventana (desde 10.2), así que `SUM() OVER()` está disponible si hace falta para totales corridos — no es necesario evitarlas como con `JSON_TABLE`. La conversión de moneda sigue el mismo patrón de subconsulta correlacionada de Fase 0 (no `FUNCTION` almacenada).

---

## Fase 9 (post-MVP) — Metas de ahorro

**Objetivo:** objetivo (monto + fecha), aportes, progreso, individuales o compartidas.

**Tablas:** `savings_goals`, `savings_goal_members`, `savings_contributions`

**Stored procedures:**
- `sp_savings_goal_create(household_id, name, target_amount, currency_id, target_date, is_shared, created_by_member_id)`
- `sp_savings_goal_update(goal_id, ..., currency_id)`
- `sp_savings_goal_member_set(goal_id, member_id, share_percentage)` (loop chico, igual que Fases 3/6)
- `sp_savings_contribution_add(goal_id, member_id, amount, currency_id, contributed_at)` — el aporte puede ser en una moneda distinta a la de la meta
- `sp_savings_goal_progress_get(goal_id)` — convierte cada `savings_contributions.amount` a `savings_goals.currency_id` (subconsulta correlacionada de tipo de cambio, fecha = `contributed_at`) antes de sumar, y devuelve total aportado vs objetivo, %

**Wrappers TS:** `savings-goals.ts`

**UI:** `/metas` (lista + detalle), `<CurrencyAmountInput>` en el objetivo y en cada aporte, acción rápida "+ Aportar", anillo de progreso animado con Framer Motion.

**Notas MariaDB:** misma técnica de conversión (subconsulta correlacionada) que las Fases 0/2/8, sin restricciones adicionales.

---

## Fase 10 (futuro, solo diseño — no se implementa en el MVP ni post-MVP)

No se construye código en esta fase; se deja documentado por qué el modelo de datos ya la soporta barato:

- **Presupuesto mensual por categoría con alertas de tope:** `expense_categories` + `expense_occurrences.due_date` ya dan la granularidad mes/categoría necesaria. Cuando se quiera, alcanza con sumar una tabla `budget_limits(household_id, category_id, year_month, limit_amount)` — no requiere tocar tablas existentes.
- **Historial y reportes exportables (PDF/Excel):** todo el dato vive en `expense_occurrences`, `shopping_lists`/`shopping_list_items`, `savings_contributions` con fechas — un export es una `SELECT` + generación de archivo en un SP de solo lectura nuevo, sin cambios de esquema.
- **Log de auditoría:** ya cubierto parcialmente por las columnas `created_by_member_id`/`paid_by_member_id`/`member_id` agregadas desde el diseño inicial (ver nota en "Modelo de datos"). Un futuro `audit_log(household_id, member_id, entity_type, entity_id, action, occurred_at)` puede poblarse desde ahí sin backfill doloroso.

---

## Consideraciones transversales

- **Transacciones:** cualquier flujo que toque más de un SP con efectos relacionados (confirmar compra + inicializar split, generar occurrence + snapshot de shares) usa `pool.getConnection()` + `beginTransaction()`/`commit()`/`rollback()` explícito en el wrapper TS, no en Server Actions sueltas.
- **Seguridad:** passwords con bcryptjs; todo SP mutante recibe `household_id`/`member_id` y valida pertenencia antes de tocar filas, aunque hoy sea un solo hogar.
- **Testing:** no está definida una estrategia de test todavía (no se menciona en el spec). Recomendado: SPs se prueban contra un schema de test seedeado (scripts SQL propios, sin ORM de test); UI se valida manualmente mobile-first como pide el proyecto, con Playwright como opción si más adelante se quiere automatizar — a decidir cuando arranque la implementación.
- **Convención de wrappers:** cada archivo en `lib/db/procedures/*.ts` corresponde 1:1 a un dominio de esta lista de fases (auth, household, products, shopping-list, shopping-list-splits, recurring-expenses, expense-shares, reminders, dashboard, savings-goals), más `lib/db/pool.ts` y `lib/db/call.ts` como utilidades compartidas.

## Decisiones abiertas (para resolver antes de implementar, no antes de aprobar el plan)

1. ~~Hosting de despliegue~~ — **Resuelto: Vercel.** Fase 7 usa Vercel Cron Jobs (`vercel.json`) contra `/api/cron/reminders`.
2. **Estrategia next-auth v5**: recomendada Credentials + JWT sin adapter de DB (evita que next-auth escriba SQL fuera de los SPs). A confirmar.
3. ~~Moneda única~~ — **Resuelto: multi-moneda CRC/USD** con tipo de cambio manual (módulo en Fase 0), conversión en Fases 2/8/9 vía subconsulta correlacionada (no `FUNCTION` almacenada, para evitar el gotcha de `log_bin_trust_function_creators`).

## Cobertura del spec (auto-chequeo)

| Sección del spec | Fase(s) |
|---|---|
| Hogar y miembros, invitación por email, día de pago | Fase 0 |
| Multi-moneda CRC/USD + tipo de cambio manual | Fase 0 (módulo) + Fases 1, 2, 5, 8, 9 (consumo) |
| Inventario y cantidad óptima | Fase 1 |
| Lista de compras automática + extras + total estimado + confirmación | Fase 2 |
| División 50/50 ajustable por compra | Fase 3 |
| Gastos/servicios recurrentes, periodicidad, día de retiro | Fase 5 |
| Recordatorios (1 día antes, diario hasta pago, día de retiro) | Fase 7 |
| Gastos compartidos con % default editable | Fase 6 |
| Metas de ahorro | Fase 9 |
| Dashboard (categoría, evolución, saldo entre miembros, metas) | Fase 8 |
| Notificaciones push/WhatsApp | Explícitamente fuera de alcance (post-Resend, no bloqueante) |
| PWA instalable + offline lista de compras | Fase 0 (shell) + Fase 4 (offline real) |
| Presupuesto por categoría / reportes / auditoría | Fase 10 (solo diseño) |

**MVP = Fases 0–7. Post-MVP = Fases 8–9. Solo diseño = Fase 10.**

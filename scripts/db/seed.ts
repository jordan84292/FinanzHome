// Env vars must be loaded before any app module (transitively importing
// lib/db/pool.ts, which builds its connection pool at module-load time) is
// imported — ES module imports are hoisted ahead of top-level code, so a
// dotenv.config() call here would run too late. Run this script with
// `node --env-file=.env.local` (or the npm script that does it for you).
import { registerNewUser } from '@/lib/auth/register-user';
import { createHousehold, createInvitation, acceptInvitation } from '@/lib/db/procedures/household';
import { updatePaymentSchedule } from '@/lib/db/procedures/profile';
import { createProduct } from '@/lib/db/procedures/products';
import {
  generateOrGetShoppingList,
  getShoppingListItems,
  confirmShoppingList,
} from '@/lib/db/procedures/shopping-list';
import { initSplit, markSplitPaid } from '@/lib/db/procedures/shopping-list-splits';
import {
  createRecurringExpense,
  markOccurrencePaid,
  listOccurrences,
} from '@/lib/db/procedures/recurring-expenses';
import { setRecurringExpenseShares } from '@/lib/db/procedures/expense-shares';
import { setInstallmentShares, generateInstallmentsForMonth } from '@/lib/db/procedures/expense-installments';
import { setExchangeRate } from '@/lib/db/procedures/currency';
import { pool } from '@/lib/db/pool';

const CRC_ID = 1;

// unit ids from units_of_measure: 1=unidad 2=kg 3=g 4=l 5=ml 6=paquete 7=docena
// category ids from product_categories: 1=Despensa 2=Limpieza 3=Higiene personal 4=Bebidas
async function main(): Promise<void> {
  console.log('Seeding demo data into local dev DB...');

  // --- Household + members -------------------------------------------------
  const jordan = await registerNewUser({ email: 'demo@finanzhome.app', password: 'Demo1234', name: 'Jordan González' });
  const household = await createHousehold({
    name: 'Familia González',
    creatorUserId: jordan.id,
    creatorDisplayName: 'Jordan',
  });

  const [jordanRow] = await pool.query('SELECT id AS member_id FROM household_members WHERE household_id = ? AND user_id = ?', [household.id, jordan.id]);
  const jordanMemberId = (jordanRow as { member_id: number }[])[0].member_id;

  const maria = await registerNewUser({ email: 'maria@finanzhome.app', password: 'Demo1234', name: 'María Rodríguez' });
  const invitation = await createInvitation({
    householdId: household.id,
    email: maria.email,
    token: 'seed0000demo0invite0token00000000000000000000',
    invitedByMemberId: jordanMemberId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  const mariaMember = await acceptInvitation({ token: invitation.token, userId: maria.id, displayName: 'María' });
  const mariaMemberId = mariaMember.id;

  await updatePaymentSchedule({ userId: jordan.id, paymentFrequency: 'monthly', paymentWeekday: null, paymentDay: 30 });
  await updatePaymentSchedule({ userId: maria.id, paymentFrequency: 'weekly', paymentWeekday: 5, paymentDay: null });

  await setExchangeRate({ rateCrcPerUsd: 525, effectiveDate: new Date().toISOString().slice(0, 10), createdByMemberId: jordanMemberId });

  // --- Inventario ------------------------------------------------------------
  const productSeeds = [
    { name: 'Arroz', unitId: 2, categoryId: 1, optimal: 10, current: 2, price: 850 },
    { name: 'Frijoles', unitId: 2, categoryId: 1, optimal: 6, current: 1, price: 900 },
    { name: 'Leche', unitId: 4, categoryId: 4, optimal: 8, current: 2, price: 650 },
    { name: 'Huevos', unitId: 7, categoryId: 1, optimal: 3, current: 3, price: 2200 },
    { name: 'Papel higiénico', unitId: 6, categoryId: 3, optimal: 12, current: 3, price: 3500 },
    { name: 'Detergente', unitId: 4, categoryId: 2, optimal: 4, current: 4, price: 4200 },
    { name: 'Café', unitId: 6, categoryId: 1, optimal: 4, current: 1, price: 3800 },
    { name: 'Aceite', unitId: 4, categoryId: 1, optimal: 3, current: 3, price: 1900 },
  ];

  for (const p of productSeeds) {
    await createProduct({
      householdId: household.id,
      name: p.name,
      categoryId: p.categoryId,
      unitId: p.unitId,
      optimalQuantity: p.optimal,
      currentQuantity: p.current,
      defaultPrice: p.price,
      defaultPriceCurrencyId: CRC_ID,
      createdByMemberId: jordanMemberId,
    });
  }

  // --- Compras: una lista ya confirmada y pagada a medias ---------------------
  const openList = await generateOrGetShoppingList(household.id, jordanMemberId);
  const items = await getShoppingListItems(openList.id, household.id, CRC_ID);
  await confirmShoppingList({
    shoppingListId: openList.id,
    householdId: household.id,
    items: items.map((item) => ({
      itemId: item.id,
      quantity: item.quantity_needed,
      unitPrice: item.unit_price,
      unitPriceCurrencyId: item.unit_price_currency_id,
    })),
    displayCurrencyId: CRC_ID,
  });
  const splits = await initSplit(openList.id, household.id);
  const jordanSplit = splits.find((s) => s.member_id === jordanMemberId)!;
  await markSplitPaid({ splitId: jordanSplit.id, householdId: household.id, isPaid: true });
  // María's split queda sin pagar a propósito, para ver el saldo pendiente.

  // Bajamos la cantidad de un par de productos de nuevo para que /compras
  // muestre faltantes reales al abrir la app (la lista confirmada de arriba
  // ya se llevó el stock a "óptimo").
  await pool.query('UPDATE products SET current_quantity = 1 WHERE household_id = ? AND name IN (?, ?)', [household.id, 'Arroz', 'Café']);

  // --- Gastos recurrentes ------------------------------------------------------
  const [servicesCategoryRow] = await pool.query('SELECT id FROM expense_categories WHERE name = ?', ['Servicios']);
  const servicesCategoryId = (servicesCategoryRow as { id: number }[])[0].id;
  const [housingCategoryRow] = await pool.query('SELECT id FROM expense_categories WHERE name = ?', ['Vivienda']);
  const housingCategoryId = (housingCategoryRow as { id: number }[])[0].id;

  const internet = await createRecurringExpense({
    householdId: household.id,
    name: 'Internet',
    categoryId: servicesCategoryId,
    amount: 15000,
    currencyId: CRC_ID,
    periodicity: 'weekly',
    dueDayConfig: 5,
    withdrawalDay: 5,
    firstDueDate: null,
    responsibleMemberId: jordanMemberId,
    createdByMemberId: jordanMemberId,
  });
  await setRecurringExpenseShares({
    recurringExpenseId: internet.id,
    householdId: household.id,
    shares: [{ memberId: jordanMemberId, percentage: 50 }, { memberId: mariaMemberId, percentage: 50 }],
  });

  await createRecurringExpense({
    householdId: household.id,
    name: 'Cable',
    categoryId: servicesCategoryId,
    amount: 8000,
    currencyId: CRC_ID,
    periodicity: 'biweekly',
    dueDayConfig: null,
    withdrawalDay: 10,
    firstDueDate: null,
    responsibleMemberId: mariaMemberId,
    createdByMemberId: jordanMemberId,
  });

  const alquiler = await createRecurringExpense({
    householdId: household.id,
    name: 'Alquiler',
    categoryId: housingCategoryId,
    amount: 350000,
    currencyId: CRC_ID,
    periodicity: 'monthly',
    dueDayConfig: null,
    withdrawalDay: null,
    firstDueDate: null,
    monthlyDueDay: 30,
    fundingMode: 'full_payment',
    installmentFrequency: null,
    responsibleMemberId: jordanMemberId,
    createdByMemberId: jordanMemberId,
  });
  await setRecurringExpenseShares({
    recurringExpenseId: alquiler.id,
    householdId: household.id,
    shares: [{ memberId: jordanMemberId, percentage: 60 }, { memberId: mariaMemberId, percentage: 40 }],
  });

  const seguro = await createRecurringExpense({
    householdId: household.id,
    name: 'Seguro del carro',
    categoryId: servicesCategoryId,
    amount: 120000,
    currencyId: CRC_ID,
    periodicity: 'monthly',
    dueDayConfig: null,
    withdrawalDay: null,
    firstDueDate: null,
    monthlyDueDay: 28,
    fundingMode: 'installments',
    installmentFrequency: 'weekly',
    responsibleMemberId: mariaMemberId,
    createdByMemberId: jordanMemberId,
  });
  await setInstallmentShares({
    recurringExpenseId: seguro.id,
    householdId: household.id,
    shares: [
      { periodIndex: 1, percentage: 25 },
      { periodIndex: 2, percentage: 25 },
      { periodIndex: 3, percentage: 25 },
      { periodIndex: 4, percentage: 25 },
    ],
  });
  const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  await generateInstallmentsForMonth({ recurringExpenseId: seguro.id, householdId: household.id, monthStart });

  // --- Marcar la ocurrencia de Internet como pagada (este mes, para el dashboard) ---
  // NOTE: la primera ocurrencia de un gasto se genera (y su snapshot de shares
  // se toma) dentro de createRecurringExpense, ANTES de que existan shares
  // configurados arriba — así que queda "sin compartir", igual que pasaría en
  // la UI real (el reparto es edit-only). Para que el saldo entre miembros se
  // vea poblado en la demo, insertamos el snapshot a mano para esta ocurrencia
  // puntual, replicando exactamente lo que sp_expense_occurrence_shares_snapshot
  // habría hecho si los shares ya hubieran existido a tiempo.
  const [internetOccurrence] = await listOccurrences(internet.id, household.id);
  await markOccurrencePaid({ occurrenceId: internetOccurrence.id, householdId: household.id, paidByMemberId: jordanMemberId });
  await pool.query(
    `INSERT INTO expense_occurrence_shares (occurrence_id, member_id, percentage, amount_owed) VALUES
     (?, ?, 50, 7500), (?, ?, 50, 7500)`,
    [internetOccurrence.id, jordanMemberId, internetOccurrence.id, mariaMemberId],
  );

  // --- Historial de meses anteriores (inserción directa para la evolución mensual) ---
  const today = new Date();
  for (let monthsAgo = 1; monthsAgo <= 4; monthsAgo++) {
    const historicDate = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 15);
    const dateStr = historicDate.toISOString().slice(0, 10);

    const [alquilerResult] = await pool.query(
      `INSERT INTO expense_occurrences (recurring_expense_id, period_start, period_end, due_date, is_paid, paid_by_member_id, paid_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [alquiler.id, dateStr, dateStr, dateStr, jordanMemberId, `${dateStr} 10:00:00`],
    );
    const alquilerOccurrenceId = (alquilerResult as unknown as { insertId: number }).insertId;
    // Alquiler es 60/40 Jordan/María y siempre lo paga Jordan — María le debe
    // su 40% cada mes, así el dashboard muestra un saldo real entre miembros.
    await pool.query(
      `INSERT INTO expense_occurrence_shares (occurrence_id, member_id, percentage, amount_owed) VALUES
       (?, ?, 60, 210000), (?, ?, 40, 140000)`,
      [alquilerOccurrenceId, jordanMemberId, alquilerOccurrenceId, mariaMemberId],
    );

    await pool.query(
      `INSERT INTO expense_occurrences (recurring_expense_id, period_start, period_end, due_date, is_paid, paid_by_member_id, paid_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [seguro.id, dateStr, dateStr, dateStr, mariaMemberId, `${dateStr} 10:00:00`],
    );
  }

  console.log('');
  console.log('Seed complete. Demo accounts:');
  console.log('  demo@finanzhome.app  / Demo1234  (Jordan, owner)');
  console.log('  maria@finanzhome.app / Demo1234  (María, member)');
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

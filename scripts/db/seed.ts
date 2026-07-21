// Env vars must be loaded before any app module (transitively importing
// lib/db/pool.ts, which builds its connection pool at module-load time) is
// imported — ES module imports are hoisted ahead of top-level code, so a
// dotenv.config() call here would run too late. Run this script with
// `node --env-file=.env.local` (or `--env-file=.env.production.local` for
// prod) — see the db:seed npm script for the local-dev invocation.
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
  console.log('Seeding demo data...');

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
  const openListActualTotal = items.reduce(
    (sum, item) => sum + item.quantity_needed * (item.unit_price ?? 0),
    0,
  );
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
    isShared: true,
    actualTotal: openListActualTotal,
  });
  const splits = await initSplit(openList.id, household.id);
  const jordanSplit = splits.find((s) => s.member_id === jordanMemberId)!;
  await markSplitPaid({ splitId: jordanSplit.id, householdId: household.id, isPaid: true });
  // María's split queda sin pagar a propósito, para ver el saldo pendiente.

  // Bajamos la cantidad de un par de productos de nuevo para que /compras
  // muestre faltantes reales al abrir la app (la lista confirmada de arriba
  // ya se llevó el stock a "óptimo").
  await pool.query('UPDATE products SET current_quantity = 1 WHERE household_id = ? AND name IN (?, ?)', [household.id, 'Arroz', 'Café']);

  // --- Gastos recurrentes: una variante por categoría para que el dashboard
  // muestre varias porciones en "gasto por categoría" y una curva real en
  // "evolución mensual" -------------------------------------------------------
  async function categoryId(name: string): Promise<number> {
    const [rows] = await pool.query('SELECT id FROM expense_categories WHERE name = ?', [name]);
    return (rows as { id: number }[])[0].id;
  }
  const viviendaId = await categoryId('Vivienda');
  const serviciosId = await categoryId('Servicios');
  const transporteId = await categoryId('Transporte');
  const saludId = await categoryId('Salud');
  const entretenimientoId = await categoryId('Entretenimiento');

  const alquiler = await createRecurringExpense({
    householdId: household.id,
    name: 'Alquiler',
    categoryId: viviendaId,
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

  const internet = await createRecurringExpense({
    householdId: household.id,
    name: 'Internet',
    categoryId: serviciosId,
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

  const electricidad = await createRecurringExpense({
    householdId: household.id,
    name: 'Electricidad',
    categoryId: serviciosId,
    amount: 45000,
    currencyId: CRC_ID,
    periodicity: 'monthly',
    dueDayConfig: null,
    withdrawalDay: null,
    firstDueDate: null,
    monthlyDueDay: 20,
    fundingMode: 'full_payment',
    installmentFrequency: null,
    responsibleMemberId: mariaMemberId,
    createdByMemberId: jordanMemberId,
  });
  await setRecurringExpenseShares({
    recurringExpenseId: electricidad.id,
    householdId: household.id,
    shares: [{ memberId: jordanMemberId, percentage: 50 }, { memberId: mariaMemberId, percentage: 50 }],
  });

  const gasolina = await createRecurringExpense({
    householdId: household.id,
    name: 'Gasolina',
    categoryId: transporteId,
    amount: 40000,
    currencyId: CRC_ID,
    periodicity: 'biweekly',
    dueDayConfig: null,
    withdrawalDay: 12,
    firstDueDate: null,
    responsibleMemberId: mariaMemberId,
    createdByMemberId: jordanMemberId,
  });

  const seguro = await createRecurringExpense({
    householdId: household.id,
    name: 'Seguro médico',
    categoryId: saludId,
    amount: 60000,
    currencyId: CRC_ID,
    periodicity: 'monthly',
    dueDayConfig: null,
    withdrawalDay: null,
    firstDueDate: null,
    monthlyDueDay: 28,
    fundingMode: 'installments',
    installmentFrequency: 'weekly',
    responsibleMemberId: jordanMemberId,
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

  const streaming = await createRecurringExpense({
    householdId: household.id,
    name: 'Streaming',
    categoryId: entretenimientoId,
    amount: 12000,
    currencyId: CRC_ID,
    periodicity: 'monthly',
    dueDayConfig: null,
    withdrawalDay: null,
    firstDueDate: null,
    monthlyDueDay: 8,
    fundingMode: 'full_payment',
    installmentFrequency: null,
    responsibleMemberId: mariaMemberId,
    createdByMemberId: jordanMemberId,
  });
  await setRecurringExpenseShares({
    recurringExpenseId: streaming.id,
    householdId: household.id,
    shares: [{ memberId: jordanMemberId, percentage: 50 }, { memberId: mariaMemberId, percentage: 50 }],
  });

  // --- Cada gasto recurrente tiene un monto FIJO (vive en recurring_expenses,
  // no hay columna de monto por ocurrencia) — así que "variar el monto por
  // mes" no es posible sin tocar el esquema. La variación real en la
  // evolución mensual sale de variar QUÉ gastos se pagaron cada mes, no cuánto.
  //
  // NOTE: la primera ocurrencia de cada gasto se genera (y su snapshot de
  // shares se toma) dentro de createRecurringExpense, ANTES de configurar los
  // shares arriba — queda "sin compartir", igual que en la UI real (el
  // reparto es edit-only). Para los gastos MENSUALES además esa primera
  // ocurrencia puede caer el mes que viene si "hoy" ya pasó el día de
  // vencimiento configurado (mismo roll-forward que usa la app real) — nada
  // útil para una demo con fechas controladas, así que se borra y se
  // reemplaza por ocurrencias insertadas a mano con fechas exactas.
  type ShareSplit = { memberId: number; percentage: number };
  const alquilerShares: ShareSplit[] = [{ memberId: jordanMemberId, percentage: 60 }, { memberId: mariaMemberId, percentage: 40 }];
  const fiftyFifty: ShareSplit[] = [{ memberId: jordanMemberId, percentage: 50 }, { memberId: mariaMemberId, percentage: 50 }];

  const monthlyExpenseIds = [alquiler.id, electricidad.id, seguro.id, streaming.id];
  await pool.query(`DELETE FROM expense_occurrences WHERE recurring_expense_id IN (${monthlyExpenseIds.map(() => '?').join(',')})`, monthlyExpenseIds);

  async function insertOccurrence(
    recurringExpenseId: number,
    dateStr: string,
    isPaid: boolean,
    paidByMemberId: number | null,
    shares: ShareSplit[] | null,
    amount: number,
  ): Promise<number> {
    const [result] = await pool.query(
      `INSERT INTO expense_occurrences (recurring_expense_id, period_start, period_end, due_date, is_paid, paid_by_member_id, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [recurringExpenseId, dateStr, dateStr, dateStr, isPaid ? 1 : 0, paidByMemberId, isPaid ? `${dateStr} 10:00:00` : null],
    );
    const occurrenceId = (result as unknown as { insertId: number }).insertId;
    if (shares) {
      for (const share of shares) {
        await pool.query(
          'INSERT INTO expense_occurrence_shares (occurrence_id, member_id, percentage, amount_owed) VALUES (?, ?, ?, ?)',
          [occurrenceId, share.memberId, share.percentage, Math.round((amount * share.percentage) / 100)],
        );
      }
    }
    return occurrenceId;
  }

  const today = new Date();
  const thisMonthStr = (day: number) => new Date(today.getFullYear(), today.getMonth(), day).toISOString().slice(0, 10);

  // Este mes: todo pagado salvo Alquiler (queda pendiente, para que /gastos
  // también muestre algo por vencer) y una cuota de Seguro médico.
  await insertOccurrence(alquiler.id, thisMonthStr(30), false, null, alquilerShares, 350000);
  await insertOccurrence(electricidad.id, thisMonthStr(20), true, mariaMemberId, fiftyFifty, 45000);
  await insertOccurrence(seguro.id, thisMonthStr(28), false, null, null, 60000);
  await insertOccurrence(streaming.id, thisMonthStr(8), true, mariaMemberId, fiftyFifty, 12000);
  const internetOccurrenceThisMonth = await listOccurrences(internet.id, household.id);
  await markOccurrencePaid({ occurrenceId: internetOccurrenceThisMonth[0].id, householdId: household.id, paidByMemberId: jordanMemberId });
  await pool.query(
    'INSERT INTO expense_occurrence_shares (occurrence_id, member_id, percentage, amount_owed) VALUES (?, ?, 50, 7500), (?, ?, 50, 7500)',
    [internetOccurrenceThisMonth[0].id, jordanMemberId, internetOccurrenceThisMonth[0].id, mariaMemberId],
  );

  // Meses anteriores: se varía cuáles de los 4 gastos mensuales aparecieron
  // pagados cada mes (Streaming y Seguro no siempre), para que la curva de
  // evolución mensual suba y baje en vez de ser una línea plana.
  const monthlyHistory: Array<{ monthsAgo: number; expenses: number[] }> = [
    { monthsAgo: 4, expenses: [alquiler.id, electricidad.id, seguro.id] },
    { monthsAgo: 3, expenses: [alquiler.id, electricidad.id, seguro.id, streaming.id] },
    { monthsAgo: 2, expenses: [alquiler.id, electricidad.id] },
    { monthsAgo: 1, expenses: [alquiler.id, electricidad.id, seguro.id, streaming.id] },
  ];
  const amountById: Record<number, number> = { [alquiler.id]: 350000, [electricidad.id]: 45000, [seguro.id]: 60000, [streaming.id]: 12000 };
  const sharesById: Record<number, ShareSplit[] | null> = { [alquiler.id]: alquilerShares, [electricidad.id]: fiftyFifty, [seguro.id]: null, [streaming.id]: fiftyFifty };
  const payerById: Record<number, number> = { [alquiler.id]: jordanMemberId, [electricidad.id]: mariaMemberId, [seguro.id]: jordanMemberId, [streaming.id]: mariaMemberId };

  for (const month of monthlyHistory) {
    const dateStr = new Date(today.getFullYear(), today.getMonth() - month.monthsAgo, 15).toISOString().slice(0, 10);
    for (const expenseId of month.expenses) {
      await insertOccurrence(expenseId, dateStr, true, payerById[expenseId], sharesById[expenseId], amountById[expenseId]);
    }
    // Internet (semanal) y Gasolina (quincenal) sí se pagaron todos los meses.
    await insertOccurrence(internet.id, dateStr, true, jordanMemberId, fiftyFifty, 15000);
    await insertOccurrence(gasolina.id, dateStr, true, mariaMemberId, null, 40000);
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

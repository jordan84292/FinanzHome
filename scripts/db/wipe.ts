import { config } from 'dotenv';
import mysql from 'mysql2/promise';

// Tablas de datos generados por usuarios — se vacían por completo.
// Deliberadamente NO incluye las tablas de referencia/catálogo (currencies,
// expense_categories, product_categories, units_of_measure, schema_migrations),
// que son datos fijos de la app, no datos de usuario.
const USER_DATA_TABLES = [
  'exchange_rates',
  'reminder_log',
  'expense_installments',
  'expense_installment_shares',
  'expense_occurrence_shares',
  'expense_occurrences',
  'recurring_expense_shares',
  'recurring_expenses',
  'shopping_list_splits',
  'shopping_list_items',
  'shopping_lists',
  'products',
  'password_reset_tokens',
  'household_invitations',
  'household_members',
  'households',
  'users',
];

function resolveDatabaseName(): string {
  const arg = process.argv.find((a) => a.startsWith('--database='));
  const database = arg?.split('=')[1] ?? process.env.DB_NAME;
  if (!database) throw new Error('Pass --database=<name> or set DB_NAME');
  return database;
}

function resolveEnvFile(): string {
  const arg = process.argv.find((a) => a.startsWith('--env='));
  return arg?.split('=')[1] ?? '.env.local';
}

async function run(): Promise<void> {
  config({ path: resolveEnvFile() });
  const database = resolveDatabaseName();
  const useSsl = process.env.DB_SSL === 'true';

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
  });

  console.log(`Wiping user data from ${database}...`);
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of USER_DATA_TABLES) {
    await connection.query(`TRUNCATE TABLE \`${table}\``);
    console.log(`  truncated: ${table}`);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('Done.');
  await connection.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

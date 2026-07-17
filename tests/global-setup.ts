import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import mysql from 'mysql2/promise';

// globalSetup runs in its own Node process (separate from the test worker
// processes that load tests/setup-env.ts), so .env.local must be loaded here
// too — same approach as scripts/db/migrate.ts.
config({ path: '.env.local', quiet: true });

const TEST_DATABASE = 'finanzhome_test';

async function dropTestDatabase(): Promise<void> {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  await connection.query(`DROP DATABASE IF EXISTS \`${TEST_DATABASE}\``);
  await connection.end();
}

export default async function setup(): Promise<void> {
  // Drop the test database first so every test run starts from a known-empty
  // state; db:migrate:test then recreates it fresh and reapplies every
  // migration and procedure. This keeps the test suite hermetic without
  // touching the dev database (finanzhome), which stays purely additive.
  await dropTestDatabase();
  execSync('npm run db:migrate:test', { stdio: 'inherit' });
}

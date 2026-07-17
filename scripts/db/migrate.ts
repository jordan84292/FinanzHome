import { config } from 'dotenv';
config({ path: '.env.local' });

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

function resolveDatabaseName(): string {
  const arg = process.argv.find((a) => a.startsWith('--database='));
  const database = arg?.split('=')[1] ?? process.env.DB_NAME;
  if (!database) throw new Error('Pass --database=<name> or set DB_NAME');
  return database;
}

async function run(): Promise<void> {
  const database = resolveDatabaseName();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await connection.changeUser({ database });

  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [appliedRows] = await connection.query<mysql.RowDataPacket[]>(
    'SELECT filename FROM schema_migrations',
  );
  const applied = new Set(appliedRows.map((row) => row.filename as string));

  const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    await connection.query(sql);
    await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
    console.log(`applied migration: ${file}`);
  }

  const proceduresDir = path.join(process.cwd(), 'db', 'procedures');
  const procedureFiles = readdirSync(proceduresDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of procedureFiles) {
    const sql = readFileSync(path.join(proceduresDir, file), 'utf8');
    await connection.query(sql);
    console.log(`loaded procedure: ${file}`);
  }

  await connection.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

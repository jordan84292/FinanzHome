import { config } from 'dotenv';

// Vitest does not auto-load .env.local into the test worker's process.env,
// so we load it explicitly (same approach as scripts/db/migrate.ts) before
// overriding DB_NAME to point at the test database.
config({ path: '.env.local', quiet: true });

process.env.DB_NAME = 'finanzhome_test';

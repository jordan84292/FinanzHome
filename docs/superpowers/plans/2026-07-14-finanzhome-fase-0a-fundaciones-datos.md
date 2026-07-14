# FinanzHome — Fase 0a: Fundaciones de Datos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el proyecto Next.js 16 scaffolded y una capa de datos completa (identidad de hogar/miembros + módulo de moneda) funcionando de punta a punta contra MariaDB real, con stored procedures y wrappers TS cubiertos por tests de integración.

**Architecture:** Next.js 16 App Router + TypeScript, sin ORM. `src/lib/db/pool.ts` expone un pool singleton de `mysql2/promise`; `src/lib/db/call.ts` expone `callProcedure()` como único punto de invocación de stored procedures. Toda regla de negocio vive en SQL (`db/migrations/*.sql`, `db/procedures/*.sql`), aplicado por un runner propio (`scripts/db/migrate.ts`, sin librería de migraciones externa). No hay UI ni auth todavía — eso es Fase 0b.

**Tech Stack (de esta fase):** Next.js 16, TypeScript, `mysql2/promise`, Vitest, `tsx`, `dotenv`. El resto del stack del spec (next-auth, Resend, Bootstrap, SweetAlert2, Zustand, Framer Motion, Highcharts, zod, date-fns, bcryptjs) se instala recién en la fase que lo usa por primera vez — no se agrega dependencia sin consumidor.

## Global Constraints

- **DB-first, sin ORM:** cualquier lectura/escritura de negocio pasa por un stored procedure vía `callProcedure()`. Nada de SQL ad-hoc en TS.
- **MariaDB 10.4.32 real**, corriendo en este entorno en `127.0.0.1:3307`, usuario `root`, sin password (XAMPP dev). Base de desarrollo: `finanzhome`. Base de test: `finanzhome_test` (recreada por Vitest antes de correr los tests).
- **Un solo hogar por conjunto de miembros**, pero todo SP que toca `household_members` recibe IDs explícitos, sin asumir sesión.
- **Historial de tipo de cambio inmutable:** `exchange_rates` solo recibe `INSERT`, nunca `UPDATE`, para poder reconstruir montos históricos.
- **Carpeta `src/lib/db/procedures/*.ts`:** un archivo por dominio (`auth.ts`, `household.ts`, `currency.ts`), wrappers finos 1:1 con los SPs.

---

## File Structure

```
FinanzHome/
├── db/
│   ├── migrations/
│   │   ├── 001_identity.sql
│   │   └── 002_currencies.sql
│   └── procedures/
│       ├── sp_user_register.sql
│       ├── sp_user_get_by_email.sql
│       ├── sp_household_create.sql
│       ├── sp_household_invitation_create.sql
│       ├── sp_household_invitation_accept.sql
│       ├── sp_household_get_for_user.sql
│       ├── sp_currency_list.sql
│       ├── sp_exchange_rate_set.sql
│       ├── sp_exchange_rate_get_latest.sql
│       └── sp_exchange_rate_history.sql
├── scripts/db/migrate.ts
├── src/lib/db/
│   ├── pool.ts
│   ├── call.ts
│   └── procedures/
│       ├── auth.ts
│       ├── household.ts
│       └── currency.ts
├── tests/
│   ├── global-setup.ts
│   ├── setup-env.ts
│   ├── helpers/db.ts
│   └── db/
│       ├── pool.test.ts
│       ├── call.test.ts
│       └── procedures/
│           ├── auth.test.ts
│           ├── household.test.ts
│           └── currency.test.ts
├── vitest.config.ts
├── .env.example
└── .env.local   (gitignored)
```

---

### Task 1: Scaffold del proyecto Next.js 16

**Files:**
- Create: proyecto completo vía `create-next-app` en el directorio actual
- Modify: `package.json` (agrega scripts de test/migración)
- Create: `.env.example`, `.env.local`

**Interfaces:** ninguna todavía — este task no produce código de negocio.

- [ ] **Step 1: Verificar que el directorio está vacío salvo `docs/`**

Run: `ls -la`
Expected: solo aparece `docs/` (y `.git` si ya existiera). Si aparece algo más, detenerse y revisar antes de continuar.

- [ ] **Step 2: Scaffold de Next.js 16**

Run:
```bash
npx create-next-app@latest . --typescript --no-tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --empty --yes
```
Expected: termina sin error, crea `package.json`, `src/app/`, `tsconfig.json`, `.gitignore`, e inicializa un repo git (comportamiento default de create-next-app). Confirmar con:

Run: `cat package.json | grep '"next"'`
Expected: algo como `"next": "16.x.x"`.

- [ ] **Step 3: Instalar dependencias de esta fase**

Run:
```bash
npm install mysql2
npm install -D vitest tsx dotenv
```
Expected: `npm install` termina sin errores; `package.json` lista `mysql2` en `dependencies` y `vitest`, `tsx`, `dotenv` en `devDependencies`.

- [ ] **Step 4: Variables de entorno**

Create `.env.example`:
```
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=
DB_NAME=finanzhome
```

Create `.env.local` (mismo contenido — valores reales de este entorno de desarrollo):
```
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=
DB_NAME=finanzhome
```

Run: `cat .gitignore | grep env`
Expected: `.env*.local` aparece (lo agrega create-next-app por defecto), confirmando que `.env.local` no se commitea.

- [ ] **Step 5: Scripts de `package.json`**

Modify `package.json`, dentro de `"scripts"` agregar:
```json
"db:migrate": "tsx scripts/db/migrate.ts --database=finanzhome",
"db:migrate:test": "tsx scripts/db/migrate.ts --database=finanzhome_test",
"test": "vitest run"
```

- [ ] **Step 6: Crear carpetas vacías de `db/` para que el runner no falle en el próximo task**

Run:
```bash
mkdir -p db/migrations db/procedures
touch db/migrations/.gitkeep db/procedures/.gitkeep
```
Expected: ambas carpetas existen y están trackeadas por git aunque estén vacías.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 project and dev dependencies"
```

---

### Task 2: Infraestructura de base de datos (pool, callProcedure, migration runner, Vitest)

**Files:**
- Create: `src/lib/db/pool.ts`
- Create: `src/lib/db/call.ts`
- Create: `scripts/db/migrate.ts`
- Create: `vitest.config.ts`, `tests/global-setup.ts`, `tests/setup-env.ts`, `tests/helpers/db.ts`
- Test: `tests/db/pool.test.ts`, `tests/db/call.test.ts`

**Interfaces:**
- Produce: `pool: mysql.Pool` desde `src/lib/db/pool.ts`
- Produce: `callProcedure<T extends RowDataPacket>(name: string, params?: unknown[]): Promise<T[]>` desde `src/lib/db/call.ts` — **todos los wrappers de tasks siguientes lo usan**
- Produce: `uniqueSuffix(): string` desde `tests/helpers/db.ts` — usado por todos los tests de procedures para no colisionar emails/nombres

- [ ] **Step 1: Pool de conexión**

Create `src/lib/db/pool.ts`:
```ts
import mysql from 'mysql2/promise';

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    // DECIMAL columns vuelven como number en vez de string — más simple para
    // matemática de montos en una app de este tamaño.
    decimalNumbers: true,
  });
}

export const pool = createPool();
```

- [ ] **Step 2: `callProcedure` helper**

Create `src/lib/db/call.ts`:
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
  // mysql2 devuelve CALL como [[rows, OkPacket], fields] — solo nos interesa el primer result set.
  const [results] = await pool.query(`CALL ${name}(${placeholders})`, params);
  const rows = (results as unknown as [T[], ...unknown[]])[0];
  return Array.isArray(rows) ? rows : [];
}
```

- [ ] **Step 3: Migration runner**

Create `scripts/db/migrate.ts`:
```ts
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
```

- [ ] **Step 4: Probar el runner manualmente contra `finanzhome` (aún sin migraciones reales)**

Run: `npm run db:migrate`
Expected: imprime nada de `applied migration` ni `loaded procedure` (las carpetas solo tienen `.gitkeep`), termina sin error. Verificar que la base existe:

Run: `"/c/xampp/mysql/bin/mysql.exe" -h 127.0.0.1 -P 3307 -u root -e "SHOW DATABASES LIKE 'finanzhome';"`
Expected: una fila `finanzhome`.

- [ ] **Step 5: Vitest + wiring de entorno de test**

Create `vitest.config.ts`:
```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup-env.ts'],
    testTimeout: 15000,
  },
});
```

Create `tests/global-setup.ts`:
```ts
import { execSync } from 'node:child_process';

export default function setup(): void {
  execSync('npm run db:migrate:test', { stdio: 'inherit' });
}
```

Create `tests/setup-env.ts`:
```ts
process.env.DB_NAME = 'finanzhome_test';
```

Create `tests/helpers/db.ts`:
```ts
export function uniqueSuffix(): string {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}
```

- [ ] **Step 6: Test de conectividad del pool**

Create `tests/db/pool.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { pool } from '@/lib/db/pool';

describe('database pool', () => {
  it('connects and runs a trivial query', async () => {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    expect((rows as { result: number }[])[0].result).toBe(2);
  });
});
```

- [ ] **Step 7: Test de validación de `callProcedure`**

Create `tests/db/call.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { callProcedure } from '@/lib/db/call';

describe('callProcedure', () => {
  it('rejects a procedure name that is not a plain identifier', async () => {
    await expect(callProcedure('sp_x; DROP TABLE users; --')).rejects.toThrow(
      'Invalid stored procedure name',
    );
  });
});
```

- [ ] **Step 8: Correr los tests**

Run: `npm test`
Expected: `tests/global-setup.ts` corre `db:migrate:test` (crea `finanzhome_test`), luego 2 archivos de test, 2 tests, todos en verde.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add db pool, callProcedure helper, migration runner, and Vitest wiring"
```

---

### Task 3: Esquema de identidad (usuarios, hogar, miembros, invitaciones)

**Files:**
- Create: `db/migrations/001_identity.sql`

**Interfaces:**
- Produce: tablas `users`, `households`, `household_members`, `household_invitations` — consumidas por Task 4 y por `002_currencies.sql` (Task 5, FK a `household_members`)

- [ ] **Step 1: Escribir la migración**

Create `db/migrations/001_identity.sql`:
```sql
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE households (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE household_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  payment_day TINYINT UNSIGNED NOT NULL,
  role ENUM('owner', 'member') NOT NULL DEFAULT 'member',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_household_members_household FOREIGN KEY (household_id) REFERENCES households(id),
  CONSTRAINT fk_household_members_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_household_members_household_user UNIQUE (household_id, user_id),
  CONSTRAINT chk_household_members_payment_day CHECK (payment_day BETWEEN 1 AND 31)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE household_invitations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  household_id INT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  status ENUM('pending', 'accepted', 'expired') NOT NULL DEFAULT 'pending',
  invited_by_member_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_household_invitations_household FOREIGN KEY (household_id) REFERENCES households(id),
  CONSTRAINT fk_household_invitations_inviter FOREIGN KEY (invited_by_member_id) REFERENCES household_members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Nota MariaDB:** `CHECK` constraints están soportados desde MariaDB 10.2.1, así que `chk_household_members_payment_day` es válido en 10.4.32.

- [ ] **Step 2: Aplicar y verificar contra `finanzhome`**

Run: `npm run db:migrate`
Expected: imprime `applied migration: 001_identity.sql`.

Run: `"/c/xampp/mysql/bin/mysql.exe" -h 127.0.0.1 -P 3307 -u root finanzhome -e "SHOW TABLES;"`
Expected: lista `household_invitations`, `household_members`, `households`, `schema_migrations`, `users`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): add identity schema (users, households, members, invitations)"
```

---

### Task 4: Stored procedures de identidad + wrappers TS + tests

**Files:**
- Create: `db/procedures/sp_user_register.sql`, `db/procedures/sp_user_get_by_email.sql`, `db/procedures/sp_household_create.sql`, `db/procedures/sp_household_invitation_create.sql`, `db/procedures/sp_household_invitation_accept.sql`, `db/procedures/sp_household_get_for_user.sql`
- Create: `src/lib/db/procedures/auth.ts`, `src/lib/db/procedures/household.ts`
- Test: `tests/db/procedures/auth.test.ts`, `tests/db/procedures/household.test.ts`

**Interfaces:**
- Consume: `callProcedure` de `src/lib/db/call.ts` (Task 2)
- Produce: `registerUser`, `getUserByEmail` (`auth.ts`); `createHousehold`, `createInvitation`, `acceptInvitation`, `getHouseholdsForUser` (`household.ts`) — **usados por Fase 0b (next-auth) y por Task 6 de este plan (currency, necesita un `member_id` real para el FK de `exchange_rates`)**

- [ ] **Step 1: SPs de usuario**

Create `db/procedures/sp_user_register.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_user_register;

CREATE PROCEDURE sp_user_register(
  IN p_email VARCHAR(255),
  IN p_password_hash VARCHAR(255),
  IN p_name VARCHAR(150)
)
BEGIN
  INSERT INTO users (email, password_hash, name)
  VALUES (p_email, p_password_hash, p_name);

  SELECT id, email, name, created_at
  FROM users
  WHERE id = LAST_INSERT_ID();
END;
```

Create `db/procedures/sp_user_get_by_email.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_user_get_by_email;

CREATE PROCEDURE sp_user_get_by_email(
  IN p_email VARCHAR(255)
)
BEGIN
  SELECT id, email, password_hash, name, created_at
  FROM users
  WHERE email = p_email;
END;
```

- [ ] **Step 2: SPs de hogar e invitaciones**

Create `db/procedures/sp_household_create.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_household_create;

CREATE PROCEDURE sp_household_create(
  IN p_name VARCHAR(150),
  IN p_creator_user_id INT UNSIGNED,
  IN p_creator_display_name VARCHAR(150),
  IN p_creator_payment_day TINYINT UNSIGNED
)
BEGIN
  DECLARE v_household_id INT UNSIGNED;

  INSERT INTO households (name) VALUES (p_name);
  SET v_household_id = LAST_INSERT_ID();

  INSERT INTO household_members (household_id, user_id, display_name, payment_day, role)
  VALUES (v_household_id, p_creator_user_id, p_creator_display_name, p_creator_payment_day, 'owner');

  SELECT id, name, created_at FROM households WHERE id = v_household_id;
END;
```

Create `db/procedures/sp_household_invitation_create.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_household_invitation_create;

CREATE PROCEDURE sp_household_invitation_create(
  IN p_household_id INT UNSIGNED,
  IN p_email VARCHAR(255),
  IN p_token VARCHAR(64),
  IN p_invited_by_member_id INT UNSIGNED,
  IN p_expires_at DATETIME
)
BEGIN
  INSERT INTO household_invitations (household_id, email, token, invited_by_member_id, expires_at)
  VALUES (p_household_id, p_email, p_token, p_invited_by_member_id, p_expires_at);

  SELECT id, household_id, email, token, status, expires_at, created_at
  FROM household_invitations
  WHERE id = LAST_INSERT_ID();
END;
```

Create `db/procedures/sp_household_invitation_accept.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_household_invitation_accept;

CREATE PROCEDURE sp_household_invitation_accept(
  IN p_token VARCHAR(64),
  IN p_user_id INT UNSIGNED,
  IN p_display_name VARCHAR(150),
  IN p_payment_day TINYINT UNSIGNED
)
BEGIN
  DECLARE v_household_id INT UNSIGNED;
  DECLARE v_status VARCHAR(20);
  DECLARE v_expires_at DATETIME;

  SELECT household_id, status, expires_at
  INTO v_household_id, v_status, v_expires_at
  FROM household_invitations
  WHERE token = p_token
  LIMIT 1;

  IF v_household_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invitation not found';
  ELSEIF v_status <> 'pending' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invitation is not pending';
  ELSEIF v_expires_at < NOW() THEN
    UPDATE household_invitations SET status = 'expired' WHERE token = p_token;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invitation has expired';
  END IF;

  INSERT INTO household_members (household_id, user_id, display_name, payment_day, role)
  VALUES (v_household_id, p_user_id, p_display_name, p_payment_day, 'member');

  UPDATE household_invitations SET status = 'accepted' WHERE token = p_token;

  SELECT id, household_id, user_id, display_name, payment_day, role, joined_at
  FROM household_members
  WHERE household_id = v_household_id AND user_id = p_user_id;
END;
```

Create `db/procedures/sp_household_get_for_user.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_household_get_for_user;

CREATE PROCEDURE sp_household_get_for_user(
  IN p_user_id INT UNSIGNED
)
BEGIN
  SELECT h.id, h.name, h.created_at, hm.id AS member_id, hm.display_name, hm.payment_day, hm.role
  FROM households h
  INNER JOIN household_members hm ON hm.household_id = h.id
  WHERE hm.user_id = p_user_id;
END;
```

- [ ] **Step 3: Aplicar los SPs**

Run: `npm run db:migrate`
Expected: 6 líneas `loaded procedure: sp_*.sql`.

- [ ] **Step 4: Wrapper de auth**

Create `src/lib/db/procedures/auth.ts`:
```ts
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface UserRecord extends RowDataPacket {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface UserWithPasswordRecord extends UserRecord {
  password_hash: string;
}

export async function registerUser(params: {
  email: string;
  passwordHash: string;
  name: string;
}): Promise<UserRecord> {
  const rows = await callProcedure<UserRecord>('sp_user_register', [
    params.email,
    params.passwordHash,
    params.name,
  ]);
  return rows[0];
}

export async function getUserByEmail(email: string): Promise<UserWithPasswordRecord | null> {
  const rows = await callProcedure<UserWithPasswordRecord>('sp_user_get_by_email', [email]);
  return rows[0] ?? null;
}
```

- [ ] **Step 5: Test de auth (debe fallar primero)**

Create `tests/db/procedures/auth.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { getUserByEmail, registerUser } from '@/lib/db/procedures/auth';
import { uniqueSuffix } from '../../helpers/db';

describe('auth procedures', () => {
  it('registers a user and retrieves it by email', async () => {
    const suffix = uniqueSuffix();
    const email = `user_${suffix}@example.com`;

    const created = await registerUser({
      email,
      passwordHash: 'hashed-password',
      name: 'Test User',
    });

    expect(created.email).toBe(email);
    expect(created.id).toBeGreaterThan(0);

    const found = await getUserByEmail(email);
    expect(found?.id).toBe(created.id);
    expect(found?.password_hash).toBe('hashed-password');
  });

  it('returns null for an email that does not exist', async () => {
    const found = await getUserByEmail(`missing_${uniqueSuffix()}@example.com`);
    expect(found).toBeNull();
  });
});
```

Run: `npm test -- auth.test.ts`
Expected: FAIL (no existe `src/lib/db/procedures/auth.ts`... si Step 4 ya se hizo, en cambio corré este test antes de escribir el wrapper la próxima vez que repitas el ciclo; en este plan Step 4 ya está escrito arriba, así que en la práctica correrá en verde. Si estás siguiendo TDD estricto, mové Step 5 antes de Step 4 y confirmá el fallo).

- [ ] **Step 6: Correr y confirmar verde**

Run: `npm test -- auth.test.ts`
Expected: 2 tests, PASS.

- [ ] **Step 7: Wrapper de household**

Create `src/lib/db/procedures/household.ts`:
```ts
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface HouseholdRecord extends RowDataPacket {
  id: number;
  name: string;
  created_at: string;
}

export interface HouseholdInvitationRecord extends RowDataPacket {
  id: number;
  household_id: number;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface HouseholdMemberRecord extends RowDataPacket {
  id: number;
  household_id: number;
  user_id: number;
  display_name: string;
  payment_day: number;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface HouseholdForUserRecord extends RowDataPacket {
  id: number;
  name: string;
  created_at: string;
  member_id: number;
  display_name: string;
  payment_day: number;
  role: 'owner' | 'member';
}

export async function createHousehold(params: {
  name: string;
  creatorUserId: number;
  creatorDisplayName: string;
  creatorPaymentDay: number;
}): Promise<HouseholdRecord> {
  const rows = await callProcedure<HouseholdRecord>('sp_household_create', [
    params.name,
    params.creatorUserId,
    params.creatorDisplayName,
    params.creatorPaymentDay,
  ]);
  return rows[0];
}

export async function createInvitation(params: {
  householdId: number;
  email: string;
  token: string;
  invitedByMemberId: number;
  expiresAt: Date;
}): Promise<HouseholdInvitationRecord> {
  const rows = await callProcedure<HouseholdInvitationRecord>('sp_household_invitation_create', [
    params.householdId,
    params.email,
    params.token,
    params.invitedByMemberId,
    params.expiresAt,
  ]);
  return rows[0];
}

export async function acceptInvitation(params: {
  token: string;
  userId: number;
  displayName: string;
  paymentDay: number;
}): Promise<HouseholdMemberRecord> {
  const rows = await callProcedure<HouseholdMemberRecord>('sp_household_invitation_accept', [
    params.token,
    params.userId,
    params.displayName,
    params.paymentDay,
  ]);
  return rows[0];
}

export async function getHouseholdsForUser(userId: number): Promise<HouseholdForUserRecord[]> {
  return callProcedure<HouseholdForUserRecord>('sp_household_get_for_user', [userId]);
}
```

- [ ] **Step 8: Tests de household**

Create `tests/db/procedures/household.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import {
  acceptInvitation,
  createHousehold,
  createInvitation,
  getHouseholdsForUser,
} from '@/lib/db/procedures/household';
import { uniqueSuffix } from '../../helpers/db';

describe('household procedures', () => {
  it('creates a household with its creator as owner', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `owner_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });

    const household = await createHousehold({
      name: `Casa ${suffix}`,
      creatorUserId: user.id,
      creatorDisplayName: 'Owner',
      creatorPaymentDay: 15,
    });

    const memberships = await getHouseholdsForUser(user.id);
    expect(memberships).toHaveLength(1);
    expect(memberships[0].id).toBe(household.id);
    expect(memberships[0].role).toBe('owner');
  });

  it('lets an invited user accept an invitation and join the household', async () => {
    const suffix = uniqueSuffix();
    const owner = await registerUser({
      email: `owner2_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const household = await createHousehold({
      name: `Casa ${suffix}`,
      creatorUserId: owner.id,
      creatorDisplayName: 'Owner',
      creatorPaymentDay: 15,
    });
    const [ownerMembership] = await getHouseholdsForUser(owner.id);

    const invitee = await registerUser({
      email: `invitee_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Invitee',
    });

    const invitation = await createInvitation({
      householdId: household.id,
      email: invitee.email,
      token: `token_${suffix}`,
      invitedByMemberId: ownerMembership.member_id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });

    await acceptInvitation({
      token: invitation.token,
      userId: invitee.id,
      displayName: 'Invitee',
      paymentDay: 1,
    });

    const membershipsAfter = await getHouseholdsForUser(invitee.id);
    expect(membershipsAfter).toHaveLength(1);
    expect(membershipsAfter[0].id).toBe(household.id);
    expect(membershipsAfter[0].role).toBe('member');
  });

  it('rejects accepting an invitation twice', async () => {
    const suffix = uniqueSuffix();
    const owner = await registerUser({
      email: `owner3_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const household = await createHousehold({
      name: `Casa ${suffix}`,
      creatorUserId: owner.id,
      creatorDisplayName: 'Owner',
      creatorPaymentDay: 15,
    });
    const [ownerMembership] = await getHouseholdsForUser(owner.id);
    const invitee = await registerUser({
      email: `invitee2_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Invitee',
    });
    const invitation = await createInvitation({
      householdId: household.id,
      email: invitee.email,
      token: `token2_${suffix}`,
      invitedByMemberId: ownerMembership.member_id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });

    await acceptInvitation({
      token: invitation.token,
      userId: invitee.id,
      displayName: 'Invitee',
      paymentDay: 1,
    });

    await expect(
      acceptInvitation({
        token: invitation.token,
        userId: invitee.id,
        displayName: 'Invitee',
        paymentDay: 1,
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 9: Correr toda la suite**

Run: `npm test`
Expected: todos los archivos en verde (pool, call, auth, household).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(db): add identity procedures and TS wrappers with integration tests"
```

---

### Task 5: Esquema de moneda (currencies + exchange_rates)

**Files:**
- Create: `db/migrations/002_currencies.sql`

**Interfaces:**
- Consume: tablas `households`, `household_members` (Task 3) — `exchange_rates.created_by_member_id` referencia `household_members(id)`
- Produce: tablas `currencies` (seedeada con CRC/USD), `exchange_rates`; columna `households.default_currency_id`

- [ ] **Step 1: Escribir la migración**

Create `db/migrations/002_currencies.sql`:
```sql
CREATE TABLE currencies (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(3) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  symbol VARCHAR(5) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO currencies (code, name, symbol) VALUES
  ('CRC', 'Colón costarricense', '₡'),
  ('USD', 'Dólar estadounidense', '$');

ALTER TABLE households
  ADD COLUMN default_currency_id TINYINT UNSIGNED NULL AFTER name,
  ADD CONSTRAINT fk_households_default_currency FOREIGN KEY (default_currency_id) REFERENCES currencies(id);

CREATE TABLE exchange_rates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rate_crc_per_usd DECIMAL(12,4) NOT NULL,
  effective_date DATE NOT NULL,
  created_by_member_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_exchange_rates_member FOREIGN KEY (created_by_member_id) REFERENCES household_members(id),
  INDEX idx_exchange_rates_effective_date (effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Aplicar y verificar**

Run: `npm run db:migrate`
Expected: `applied migration: 002_currencies.sql`.

Run: `"/c/xampp/mysql/bin/mysql.exe" -h 127.0.0.1 -P 3307 -u root finanzhome -e "SELECT code, symbol FROM currencies;"`
Expected: dos filas, `CRC | ₡` y `USD | $`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): add currency schema and seed CRC/USD"
```

---

### Task 6: Stored procedures de moneda + wrapper TS + tests

**Files:**
- Create: `db/procedures/sp_currency_list.sql`, `db/procedures/sp_exchange_rate_set.sql`, `db/procedures/sp_exchange_rate_get_latest.sql`, `db/procedures/sp_exchange_rate_history.sql`
- Create: `src/lib/db/procedures/currency.ts`
- Test: `tests/db/procedures/currency.test.ts`

**Interfaces:**
- Consume: `registerUser`, `createHousehold`, `getHouseholdsForUser` (Task 4, para crear un `member_id` válido en los tests)
- Produce: `listCurrencies`, `setExchangeRate`, `getLatestExchangeRate`, `getExchangeRateHistory` — **usados por Fases 1/2/8/9 del plan maestro para convertir montos**

- [ ] **Step 1: SPs**

Create `db/procedures/sp_currency_list.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_currency_list;

CREATE PROCEDURE sp_currency_list()
BEGIN
  SELECT id, code, name, symbol FROM currencies ORDER BY code;
END;
```

Create `db/procedures/sp_exchange_rate_set.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_exchange_rate_set;

CREATE PROCEDURE sp_exchange_rate_set(
  IN p_rate_crc_per_usd DECIMAL(12,4),
  IN p_effective_date DATE,
  IN p_created_by_member_id INT UNSIGNED
)
BEGIN
  IF p_rate_crc_per_usd <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exchange rate must be positive';
  END IF;

  INSERT INTO exchange_rates (rate_crc_per_usd, effective_date, created_by_member_id)
  VALUES (p_rate_crc_per_usd, p_effective_date, p_created_by_member_id);

  SELECT id, rate_crc_per_usd, effective_date, created_by_member_id, created_at
  FROM exchange_rates
  WHERE id = LAST_INSERT_ID();
END;
```

Create `db/procedures/sp_exchange_rate_get_latest.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_exchange_rate_get_latest;

CREATE PROCEDURE sp_exchange_rate_get_latest(
  IN p_as_of_date DATE
)
BEGIN
  DECLARE v_as_of_date DATE;
  SET v_as_of_date = COALESCE(p_as_of_date, CURDATE());

  SELECT id, rate_crc_per_usd, effective_date, created_by_member_id, created_at
  FROM exchange_rates
  WHERE effective_date <= v_as_of_date
  ORDER BY effective_date DESC, id DESC
  LIMIT 1;
END;
```

Create `db/procedures/sp_exchange_rate_history.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_exchange_rate_history;

CREATE PROCEDURE sp_exchange_rate_history(
  IN p_limit INT UNSIGNED
)
BEGIN
  DECLARE v_limit INT UNSIGNED;
  SET v_limit = COALESCE(p_limit, 20);

  SELECT id, rate_crc_per_usd, effective_date, created_by_member_id, created_at
  FROM exchange_rates
  ORDER BY effective_date DESC, id DESC
  LIMIT v_limit;
END;
```

**Nota MariaDB:** usar una variable local (`v_limit`, declarada con `DECLARE` dentro del procedimiento) en `LIMIT` sí está permitido en MariaDB/MySQL dentro de rutinas almacenadas — la restricción histórica de "no variables en LIMIT" aplica a variables de sesión (`SET @x = ...; SELECT ... LIMIT @x`), no a parámetros/variables locales de un `PROCEDURE`.

- [ ] **Step 2: Aplicar los SPs**

Run: `npm run db:migrate`
Expected: 4 líneas `loaded procedure: sp_*.sql`.

- [ ] **Step 3: Wrapper TS**

Create `src/lib/db/procedures/currency.ts`:
```ts
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface CurrencyRecord extends RowDataPacket {
  id: number;
  code: 'CRC' | 'USD';
  name: string;
  symbol: string;
}

export interface ExchangeRateRecord extends RowDataPacket {
  id: number;
  rate_crc_per_usd: number;
  effective_date: string;
  created_by_member_id: number;
  created_at: string;
}

export async function listCurrencies(): Promise<CurrencyRecord[]> {
  return callProcedure<CurrencyRecord>('sp_currency_list');
}

export async function setExchangeRate(params: {
  rateCrcPerUsd: number;
  effectiveDate: string;
  createdByMemberId: number;
}): Promise<ExchangeRateRecord> {
  const rows = await callProcedure<ExchangeRateRecord>('sp_exchange_rate_set', [
    params.rateCrcPerUsd,
    params.effectiveDate,
    params.createdByMemberId,
  ]);
  return rows[0];
}

export async function getLatestExchangeRate(
  asOfDate?: string,
): Promise<ExchangeRateRecord | null> {
  const rows = await callProcedure<ExchangeRateRecord>('sp_exchange_rate_get_latest', [
    asOfDate ?? null,
  ]);
  return rows[0] ?? null;
}

export async function getExchangeRateHistory(limit?: number): Promise<ExchangeRateRecord[]> {
  return callProcedure<ExchangeRateRecord>('sp_exchange_rate_history', [limit ?? null]);
}
```

- [ ] **Step 4: Tests**

Create `tests/db/procedures/currency.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import {
  getExchangeRateHistory,
  getLatestExchangeRate,
  listCurrencies,
  setExchangeRate,
} from '@/lib/db/procedures/currency';
import { uniqueSuffix } from '../../helpers/db';

async function createMember(suffix: string): Promise<number> {
  const user = await registerUser({
    email: `member_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Member',
  });
  await createHousehold({
    name: `Casa ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Member',
    creatorPaymentDay: 10,
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return membership.member_id;
}

describe('currency procedures', () => {
  it('lists the seeded currencies', async () => {
    const currencies = await listCurrencies();
    const codes = currencies.map((c) => c.code).sort();
    expect(codes).toEqual(['CRC', 'USD']);
  });

  it('rejects a non-positive exchange rate', async () => {
    const memberId = await createMember(uniqueSuffix());
    await expect(
      setExchangeRate({
        rateCrcPerUsd: 0,
        effectiveDate: '2026-07-14',
        createdByMemberId: memberId,
      }),
    ).rejects.toThrow();
  });

  it('returns the most recent rate on or before the requested date', async () => {
    const memberId = await createMember(uniqueSuffix());

    await setExchangeRate({
      rateCrcPerUsd: 520,
      effectiveDate: '2026-07-01',
      createdByMemberId: memberId,
    });
    await setExchangeRate({
      rateCrcPerUsd: 525.5,
      effectiveDate: '2026-07-10',
      createdByMemberId: memberId,
    });

    const latest = await getLatestExchangeRate();
    expect(latest?.rate_crc_per_usd).toBe(525.5);

    const asOfEarlyJuly = await getLatestExchangeRate('2026-07-05');
    expect(asOfEarlyJuly?.rate_crc_per_usd).toBe(520);
  });

  it('keeps a full history ordered by most recent first', async () => {
    const memberId = await createMember(uniqueSuffix());

    await setExchangeRate({
      rateCrcPerUsd: 500,
      effectiveDate: '2026-06-01',
      createdByMemberId: memberId,
    });
    await setExchangeRate({
      rateCrcPerUsd: 510,
      effectiveDate: '2026-06-15',
      createdByMemberId: memberId,
    });

    const history = await getExchangeRateHistory(2);
    expect(history).toHaveLength(2);
    expect(history[0].rate_crc_per_usd).toBeGreaterThanOrEqual(history[1].rate_crc_per_usd);
  });
});
```

- [ ] **Step 5: Correr toda la suite de Fase 0a**

Run: `npm test`
Expected: todos los archivos en verde — `pool`, `call`, `auth`, `household`, `currency`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): add currency procedures and TS wrapper with integration tests"
```

---

## Self-Review

**Cobertura:** identidad (usuarios, hogar, miembros, invitaciones pendiente/aceptada/expirada) ✓ Tasks 3–4. Moneda (catálogo CRC/USD, tipo de cambio con historial inmutable, consulta por fecha) ✓ Tasks 5–6. El envío real del email de invitación (Resend) y las pantallas de login/onboarding **no están en esta fase** — quedan para Fase 0b, que ya tiene los wrappers que necesita listos.

**Placeholders:** ninguno — todo el SQL y TS de cada step está completo y es el código real a escribir.

**Consistencia de tipos:** `HouseholdForUserRecord.member_id` (definido en Task 4) es el mismo campo que consumen los tests de Task 4 y Task 6 (`membership.member_id`) para poblar `created_by_member_id`/`invited_by_member_id`. `ExchangeRateRecord.rate_crc_per_usd` es `number` en todos los usos porque `pool.ts` configura `decimalNumbers: true`.

## Qué sigue

Con esta fase mergeada, el siguiente plan (**Fase 0b**) agrega next-auth v5 (Credentials + JWT), el layout mobile-first con navegación inferior, las páginas `/login`, `/register`, `/onboarding`, el envío del email de invitación por Resend, y el shell de PWA (manifest + íconos). Ese plan instala recién ahí `next-auth`, `resend`, `zod`, `bcryptjs`, `bootstrap`, `bootstrap-icons`, `sweetalert2`, `zustand`.

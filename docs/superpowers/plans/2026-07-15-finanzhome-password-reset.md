# Restablecer contraseña — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dejar que un usuario que olvidó su contraseña la restablezca por su cuenta vía un enlace enviado por correo (Resend, la misma vía ya usada para invitaciones de hogar), sin intervención manual.

**Architecture:** una tabla nueva `password_reset_tokens` (token opaco, un solo uso, TTL corto) más 3 stored procedures (crear/chequear/completar), siguiendo exactamente el mismo patrón token+SIGNAL ya usado por `sp_household_invitation_accept`. Dos páginas nuevas (`/olvide-password`, `/restablecer-password`) y sus Server Actions.

**Tech Stack:** el mismo de siempre — Next.js Server Actions, MariaDB 10.4.32 stored procedures, `bcryptjs` (ya usado para hash de contraseñas), Resend (ya usado para invitaciones), zod, Vitest contra `finanzhome_test` real.

## Global Constraints

- **DB-first, sin ORM:** toda regla de negocio (validez del token, expiración, un solo uso) vive en stored procedures.
- **No aplica el patrón household-scoping:** `password_reset_tokens` y `users` no son datos de hogar — el propio token opaco (24 bytes aleatorios vía `crypto.randomBytes`, igual que `household_invitations.token`) es la única autorización necesaria, exactamente como ya hace `sp_household_invitation_accept` (sin `household_id` en sus parámetros).
- **No revelar si un correo existe:** `/olvide-password` siempre muestra el mismo mensaje de éxito genérico, exista o no una cuenta con ese correo — evita enumeración de cuentas. Esto es una desviación deliberada del patrón de `register` (que sí informa "correo ya registrado"), justificada porque un flujo de recuperación de contraseña es un vector de enumeración más sensible que un flujo de registro.
- **Un solo token activo por usuario:** al crear un token nuevo, cualquier token `pending` previo del mismo usuario se marca `expired` — evita que enlaces viejos de correos anteriores sigan siendo válidos.
- **TTL corto:** 1 hora (vs. los 7 días de las invitaciones de hogar) — un enlace de restablecimiento de contraseña debe ser de vida corta por convención de seguridad estándar.
- **`tsc --noEmit` obligatorio** además de `npm test` y `npm run build` en cada tarea.

---

## Contexto que el implementador necesita conocer

**Patrón token+SIGNAL ya establecido (`db/procedures/sp_household_invitation_accept.sql`, no se modifica en este plan, solo se imita):**
```sql
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
```
Esta fase reutiliza el mismo esqueleto (found / status / expiry, con auto-expiración al detectar vencimiento) dos veces: una vez de solo-lectura (`sp_password_reset_token_check`, para decidir si mostrar el formulario) y una vez que además muta (`sp_password_reset_complete`, que efectivamente cambia la contraseña y consume el token).

**Patrón de envío de correo (`src/lib/email/send-invitation.ts` y `src/lib/household/invite-member.ts`, no se modifican, solo se imitan):**
```ts
// send-invitation.ts
import { resend } from './resend-client';
export async function sendInvitationEmail(params: { to: string; householdName: string; inviteUrl: string }): Promise<void> {
  const { error } = await resend.emails.send({
    from: 'FinanzHome <onboarding@resend.dev>',
    to: params.to,
    subject: `Te invitaron a ${params.householdName} en FinanzHome`,
    html: `...`,
  });
  if (error) {
    throw new Error(`Resend no pudo enviar el correo de invitación: ${error.name} - ${error.message}`);
  }
}

// invite-member.ts
const token = randomBytes(24).toString('hex');
const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
await createInvitation({ householdId, email, token, invitedByMemberId, expiresAt });
try {
  await sendInvitationEmail({ to: email, householdName, inviteUrl: `${appUrl}/onboarding?invite=${token}` });
  return { emailSent: true };
} catch (error) {
  console.error('Error al enviar el correo de invitación:', error);
  return { emailSent: false };
}
```

**`src/lib/auth/password.ts` (ya existe, no se modifica):**
```ts
import bcrypt from 'bcryptjs';
const SALT_ROUNDS = 10;
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}
```

**`src/lib/db/procedures/auth.ts` (ya existe, no se modifica):** exporta `getUserByEmail(email): Promise<UserWithPasswordRecord | null>` — `UserWithPasswordRecord` tiene `id`, `email`, `name`, `password_hash`.

**`APP_URL`** ya está en `.env.local` (`http://localhost:3000` en dev) y ya se usa así en `src/app/hogar/miembros/actions.ts:40`: `process.env.APP_URL ?? 'http://localhost:3000'`.

**Convención de páginas de auth existentes** (`src/app/login/page.tsx`, `src/app/register/page.tsx`): client component con `useActionState`, `<main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>`, inputs Bootstrap (`form-control`/`form-label`), alerta de error con `alert alert-danger py-2 mb-0`.

---

## Modelo de datos nuevo

```sql
CREATE TABLE password_reset_tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  status ENUM('pending', 'used', 'expired') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Nota de numeración: usar el próximo número de migración disponible en `db/migrations/` en el momento de implementar esta fase (verificar con `ls db/migrations/` — si Fase 3 ya se mergeó a `main`, el siguiente número es `007`; confirmar antes del Step 1 de la Task 1).

---

## Task 1: Migración + 3 stored procedures + wrapper + tests

**Files:**
- Create: `db/migrations/00N_password_reset_tokens.sql` (N = siguiente número disponible, ver nota arriba)
- Create: `db/procedures/sp_password_reset_token_create.sql`
- Create: `db/procedures/sp_password_reset_token_check.sql`
- Create: `db/procedures/sp_password_reset_complete.sql`
- Create: `src/lib/db/procedures/password-reset.ts`
- Test: `tests/db/procedures/password-reset.test.ts`

**Interfaces:**
- Consumes: `registerUser`, `getUserByEmail` (`@/lib/db/procedures/auth`), `hashPassword`, `verifyPassword` (`@/lib/auth/password`), `callProcedure` (`@/lib/db/call`), `uniqueSuffix` (`tests/helpers/db`).
- Produces: `PasswordResetTokenRecord`, `PasswordResetCompletedUserRecord` interfaces; `createPasswordResetToken(params): Promise<PasswordResetTokenRecord>`, `checkPasswordResetToken(token): Promise<PasswordResetTokenRecord>`, `completePasswordReset(params): Promise<PasswordResetCompletedUserRecord>` — usados por Task 2.

- [ ] **Step 1: Migración de la tabla**

Confirmar el próximo número de migración (`ls db/migrations/`), luego crear el archivo con:
```sql
CREATE TABLE password_reset_tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  status ENUM('pending', 'used', 'expired') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: `sp_password_reset_token_create`**

`db/procedures/sp_password_reset_token_create.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_password_reset_token_create;

CREATE PROCEDURE sp_password_reset_token_create(
  IN p_user_id INT UNSIGNED,
  IN p_token VARCHAR(64),
  IN p_expires_at DATETIME
)
BEGIN
  UPDATE password_reset_tokens
  SET status = 'expired'
  WHERE user_id = p_user_id AND status = 'pending';

  INSERT INTO password_reset_tokens (user_id, token, expires_at)
  VALUES (p_user_id, p_token, p_expires_at);

  SELECT id, user_id, token, status, expires_at, created_at
  FROM password_reset_tokens
  WHERE id = LAST_INSERT_ID();
END;
```
Invalida cualquier token `pending` previo del mismo usuario antes de insertar el nuevo — así un correo de restablecimiento viejo deja de servir apenas se pide uno nuevo.

- [ ] **Step 3: `sp_password_reset_token_check` (solo lectura, no consume el token)**

`db/procedures/sp_password_reset_token_check.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_password_reset_token_check;

CREATE PROCEDURE sp_password_reset_token_check(
  IN p_token VARCHAR(64)
)
BEGIN
  DECLARE v_user_id INT UNSIGNED;
  DECLARE v_status VARCHAR(20);
  DECLARE v_expires_at DATETIME;

  SELECT user_id, status, expires_at INTO v_user_id, v_status, v_expires_at
  FROM password_reset_tokens
  WHERE token = p_token
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reset token not found';
  ELSEIF v_status <> 'pending' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reset token is not pending';
  ELSEIF v_expires_at < NOW() THEN
    UPDATE password_reset_tokens SET status = 'expired' WHERE token = p_token;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reset token has expired';
  END IF;

  SELECT id, user_id, token, status, expires_at, created_at
  FROM password_reset_tokens
  WHERE token = p_token;
END;
```
Usado por la página `/restablecer-password` al cargar, para decidir si mostrar el formulario o "enlace inválido/expirado" — no marca el token como usado, solo lo valida (y lo pasa a `expired` si ya venció, igual que `sp_household_invitation_accept`).

- [ ] **Step 4: `sp_password_reset_complete` (muta: cambia la contraseña y consume el token)**

`db/procedures/sp_password_reset_complete.sql`:
```sql
DROP PROCEDURE IF EXISTS sp_password_reset_complete;

CREATE PROCEDURE sp_password_reset_complete(
  IN p_token VARCHAR(64),
  IN p_new_password_hash VARCHAR(255)
)
BEGIN
  DECLARE v_user_id INT UNSIGNED;
  DECLARE v_status VARCHAR(20);
  DECLARE v_expires_at DATETIME;

  SELECT user_id, status, expires_at INTO v_user_id, v_status, v_expires_at
  FROM password_reset_tokens
  WHERE token = p_token
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reset token not found';
  ELSEIF v_status <> 'pending' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reset token is not pending';
  ELSEIF v_expires_at < NOW() THEN
    UPDATE password_reset_tokens SET status = 'expired' WHERE token = p_token;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reset token has expired';
  END IF;

  UPDATE users SET password_hash = p_new_password_hash WHERE id = v_user_id;
  UPDATE password_reset_tokens SET status = 'used' WHERE token = p_token;

  SELECT id, email, name FROM users WHERE id = v_user_id;
END;
```
Re-valida todo (found/status/expiry) en vez de confiar en el chequeo previo de `sp_password_reset_token_check` — puede haber pasado tiempo entre que el usuario cargó la página y envió el formulario, y esta es la operación que de verdad importa que sea correcta.

- [ ] **Step 5: Migrar**

Run: `npm run db:migrate`
Expected: los 3 procedimientos cargan sin errores (`loaded procedure: sp_password_reset_token_create.sql`, etc.).

- [ ] **Step 6: Wrapper TS**

`src/lib/db/procedures/password-reset.ts`:
```ts
import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface PasswordResetTokenRecord extends RowDataPacket {
  id: number;
  user_id: number;
  token: string;
  status: 'pending' | 'used' | 'expired';
  expires_at: string;
  created_at: string;
}

export async function createPasswordResetToken(params: {
  userId: number;
  token: string;
  expiresAt: Date;
}): Promise<PasswordResetTokenRecord> {
  const rows = await callProcedure<PasswordResetTokenRecord>('sp_password_reset_token_create', [
    params.userId,
    params.token,
    params.expiresAt,
  ]);
  return rows[0];
}

export async function checkPasswordResetToken(token: string): Promise<PasswordResetTokenRecord> {
  const rows = await callProcedure<PasswordResetTokenRecord>('sp_password_reset_token_check', [token]);
  return rows[0];
}

export interface PasswordResetCompletedUserRecord extends RowDataPacket {
  id: number;
  email: string;
  name: string;
}

export async function completePasswordReset(params: {
  token: string;
  newPasswordHash: string;
}): Promise<PasswordResetCompletedUserRecord> {
  const rows = await callProcedure<PasswordResetCompletedUserRecord>('sp_password_reset_complete', [
    params.token,
    params.newPasswordHash,
  ]);
  return rows[0];
}
```

- [ ] **Step 7: Escribir los tests**

`tests/db/procedures/password-reset.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { registerUser, getUserByEmail } from '@/lib/db/procedures/auth';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import {
  checkPasswordResetToken,
  completePasswordReset,
  createPasswordResetToken,
} from '@/lib/db/procedures/password-reset';
import { uniqueSuffix } from '../../helpers/db';
import { randomBytes } from 'node:crypto';

async function createTestUser(suffix: string): Promise<{ userId: number; email: string }> {
  const passwordHash = await hashPassword('OldPassword123!');
  const user = await registerUser({
    email: `reset_user_${suffix}@example.com`,
    passwordHash,
    name: 'Reset User',
  });
  return { userId: user.id, email: user.email };
}

describe('password reset token lifecycle', () => {
  it('creates a pending token, checks it as valid, and completes the reset', async () => {
    const suffix = uniqueSuffix();
    const { userId, email } = await createTestUser(suffix);
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const created = await createPasswordResetToken({ userId, token, expiresAt });
    expect(created.status).toBe('pending');

    const checked = await checkPasswordResetToken(token);
    expect(checked.user_id).toBe(userId);
    expect(checked.status).toBe('pending');

    const newHash = await hashPassword('NewPassword456!');
    const completedUser = await completePasswordReset({ token, newPasswordHash: newHash });
    expect(completedUser.email).toBe(email);

    const userRow = await getUserByEmail(email);
    expect(userRow).not.toBeNull();
    expect(await verifyPassword('NewPassword456!', userRow!.password_hash)).toBe(true);
    expect(await verifyPassword('OldPassword123!', userRow!.password_hash)).toBe(false);
  });

  it('rejects checking a token that does not exist', async () => {
    await expect(checkPasswordResetToken('nonexistent-token')).rejects.toThrow(/not found/i);
  });

  it('rejects completing a reset with an already-used token', async () => {
    const suffix = uniqueSuffix();
    const { userId } = await createTestUser(suffix);
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await createPasswordResetToken({ userId, token, expiresAt });

    const newHash = await hashPassword('NewPassword456!');
    await completePasswordReset({ token, newPasswordHash: newHash });

    await expect(
      completePasswordReset({ token, newPasswordHash: await hashPassword('AnotherPassword789!') }),
    ).rejects.toThrow(/not pending/i);
  });

  it('rejects an expired token and marks it expired', async () => {
    const suffix = uniqueSuffix();
    const { userId } = await createTestUser(suffix);
    const token = randomBytes(24).toString('hex');
    const pastExpiry = new Date(Date.now() - 60 * 60 * 1000);
    await createPasswordResetToken({ userId, token, expiresAt: pastExpiry });

    await expect(checkPasswordResetToken(token)).rejects.toThrow(/expired/i);
  });

  it('invalidates a previous pending token when a new one is created for the same user', async () => {
    const suffix = uniqueSuffix();
    const { userId } = await createTestUser(suffix);
    const firstToken = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await createPasswordResetToken({ userId, token: firstToken, expiresAt });

    const secondToken = randomBytes(24).toString('hex');
    await createPasswordResetToken({ userId, token: secondToken, expiresAt });

    await expect(checkPasswordResetToken(firstToken)).rejects.toThrow(/not pending/i);
    const secondChecked = await checkPasswordResetToken(secondToken);
    expect(secondChecked.status).toBe('pending');
  });
});
```

- [ ] **Step 8: Correr los tests**

Run: `npx vitest run tests/db/procedures/password-reset.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 9: `tsc --noEmit` y suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: sin salida de tsc; todos los tests existentes + los 5 nuevos pasan.

- [ ] **Step 10: Commit**

```bash
git add db/migrations/00N_password_reset_tokens.sql db/procedures/sp_password_reset_token_create.sql db/procedures/sp_password_reset_token_check.sql db/procedures/sp_password_reset_complete.sql src/lib/db/procedures/password-reset.ts tests/db/procedures/password-reset.test.ts
git commit -m "feat(auth): add password reset token lifecycle (create/check/complete)"
```

---

## Task 2: Envío de correo + orquestación + página "olvidé mi contraseña"

**Files:**
- Create: `src/lib/email/send-password-reset.ts`
- Create: `src/lib/auth/request-password-reset.ts`
- Create: `src/app/olvide-password/actions.ts`
- Create: `src/app/olvide-password/page.tsx`
- Modify: `src/app/login/page.tsx` (agrega el link "¿Olvidaste tu contraseña?")

**Interfaces:**
- Consumes: `getUserByEmail` (`@/lib/db/procedures/auth`), `createPasswordResetToken` (`@/lib/db/procedures/password-reset`, Task 1), `resend` (`@/lib/email/resend-client`).
- Produces: `requestPasswordReset(params): Promise<void>` — usado por la Server Action de esta misma tarea; no lo consume ninguna tarea posterior.

No hay tests automatizados nuevos en esta tarea — sigue la convención establecida para tareas de wiring de Server Action + UI (ver Fase 2 Task 5, Fase 3 Task 4). El envío real de correo (Resend) se verifica manualmente, igual que se hizo para las invitaciones de hogar.

- [ ] **Step 1: Helper de envío de correo**

`src/lib/email/send-password-reset.ts`:
```ts
import { resend } from './resend-client';

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const { error } = await resend.emails.send({
    from: 'FinanzHome <onboarding@resend.dev>',
    to: params.to,
    subject: 'Restablecé tu contraseña en FinanzHome',
    html: `<p>Pediste restablecer tu contraseña en FinanzHome.</p><p><a href="${params.resetUrl}">Elegir nueva contraseña</a></p><p>Si no fuiste vos, ignorá este correo.</p>`,
  });

  if (error) {
    throw new Error(`Resend no pudo enviar el correo de restablecimiento: ${error.name} - ${error.message}`);
  }
}
```

- [ ] **Step 2: Orquestación (genera token, guarda, envía correo)**

`src/lib/auth/request-password-reset.ts`:
```ts
import { randomBytes } from 'node:crypto';
import { getUserByEmail } from '@/lib/db/procedures/auth';
import { createPasswordResetToken } from '@/lib/db/procedures/password-reset';
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset';

const RESET_TTL_HOURS = 1;

export async function requestPasswordReset(params: { email: string; appUrl: string }): Promise<void> {
  const user = await getUserByEmail(params.email);
  if (!user) {
    // No revelamos si el correo existe o no (evita enumeración de cuentas).
    return;
  }

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000);

  await createPasswordResetToken({ userId: user.id, token, expiresAt });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl: `${params.appUrl}/restablecer-password?token=${token}`,
    });
  } catch (error) {
    console.error('Error al enviar el correo de restablecimiento:', error);
  }
}
```
Nota: esta función nunca lanza por un fallo de envío de correo (solo lo loguea) — el llamador (Task 2, Step 3) siempre debe mostrar el mismo mensaje genérico de éxito, exista o no la cuenta, y haya o no fallado el envío. Filtrar cualquiera de esos dos casos por separado reintroduciría la enumeración de cuentas que este diseño evita a propósito.

- [ ] **Step 3: Server Action**

`src/app/olvide-password/actions.ts`:
```ts
'use server';

import { z } from 'zod';
import { requestPasswordReset } from '@/lib/auth/request-password-reset';

const emailSchema = z.string().email();

export interface RequestPasswordResetState {
  submitted: boolean;
}

export async function requestPasswordResetAction(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (parsed.success) {
    await requestPasswordReset({
      email: parsed.data,
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    });
  }
  return { submitted: true };
}
```

- [ ] **Step 4: Página**

`src/app/olvide-password/page.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordResetAction, type RequestPasswordResetState } from './actions';

const initialState: RequestPasswordResetState = { submitted: false };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-4">Restablecer contraseña</h1>
      {state.submitted ? (
        <div className="alert alert-success py-2" role="alert">
          Si el correo existe, te enviamos instrucciones para restablecer tu contraseña.
        </div>
      ) : (
        <form action={formAction} className="d-flex flex-column gap-3">
          <div>
            <label htmlFor="email" className="form-label">Correo</label>
            <input id="email" name="email" type="email" className="form-control" required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar instrucciones'}
          </button>
        </form>
      )}
      <p className="mt-3 small">
        <Link href="/login">Volver a iniciar sesión</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Link desde `/login`**

Modificar `src/app/login/page.tsx`: agregar, junto al párrafo existente `¿No tenés cuenta? <Link href="/register">Creá una</Link>`, un segundo párrafo:
```tsx
<p className="mt-2 small">
  <Link href="/olvide-password">¿Olvidaste tu contraseña?</Link>
</p>
```

- [ ] **Step 6: Build y tipos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores; `/olvide-password` aparece en la tabla de rutas.

- [ ] **Step 7: Verificación manual**

Con `npm run dev` corriendo, MariaDB activo y una `RESEND_API_KEY` real en `.env.local`:
1. Ir a `/login`, click en "¿Olvidaste tu contraseña?" → llega a `/olvide-password`.
2. Enviar el correo de un usuario real registrado → debe mostrar el mensaje genérico de éxito y (si Resend está configurado) el usuario debe recibir el correo con el link.
3. Enviar un correo que NO existe → debe mostrar el mismo mensaje genérico (no debe haber ninguna diferencia observable en la respuesta).
4. Consultar la tabla `password_reset_tokens` directamente y confirmar que se creó una fila `pending` solo para el correo que sí existía.

- [ ] **Step 8: Commit**

```bash
git add src/lib/email/send-password-reset.ts src/lib/auth/request-password-reset.ts src/app/olvide-password/actions.ts src/app/olvide-password/page.tsx src/app/login/page.tsx
git commit -m "feat(auth): add forgot-password request flow with generic non-enumerating response"
```

---

## Task 3: Página "restablecer contraseña" (consumo del token)

**Files:**
- Create: `src/app/restablecer-password/actions.ts`
- Create: `src/app/restablecer-password/reset-password-form.tsx`
- Create: `src/app/restablecer-password/page.tsx`

**Interfaces:**
- Consumes: `checkPasswordResetToken`, `completePasswordReset` (`@/lib/db/procedures/password-reset`, Task 1), `hashPassword` (`@/lib/auth/password`).
- Produces: nada consumido por tareas posteriores — esta es la última tarea del plan.

No hay tests automatizados nuevos en esta tarea (wiring de Server Action + UI, misma convención que Task 2). Verificación manual end-to-end obligatoria dado que es el punto de la fase donde el usuario efectivamente cambia su contraseña.

- [ ] **Step 1: Server Action**

`src/app/restablecer-password/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth/password';
import { completePasswordReset } from '@/lib/db/procedures/password-reset';

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export interface CompletePasswordResetState {
  error: string | null;
}

export async function completePasswordResetAction(
  _prevState: CompletePasswordResetState,
  formData: FormData,
): Promise<CompletePasswordResetState> {
  const parsed = resetSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    await completePasswordReset({ token: parsed.data.token, newPasswordHash: passwordHash });
  } catch {
    return { error: 'Este enlace no es válido o ya expiró. Pedí uno nuevo.' };
  }

  redirect('/login');
}
```

- [ ] **Step 2: Formulario (client component)**

`src/app/restablecer-password/reset-password-form.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { completePasswordResetAction, type CompletePasswordResetState } from './actions';

const initialState: CompletePasswordResetState = { error: null };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(completePasswordResetAction, initialState);

  return (
    <form action={formAction} className="d-flex flex-column gap-3">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="form-label">Nueva contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          className="form-control"
          required
          minLength={8}
        />
      </div>
      {state.error ? (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {state.error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar nueva contraseña'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Página (Server Component, valida el token antes de renderizar el form)**

`src/app/restablecer-password/page.tsx`:
```tsx
import { checkPasswordResetToken } from '@/lib/db/procedures/password-reset';
import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
        <div className="alert alert-danger" role="alert">Enlace inválido.</div>
      </main>
    );
  }

  let isValid = true;
  try {
    await checkPasswordResetToken(token);
  } catch {
    isValid = false;
  }

  if (!isValid) {
    return (
      <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
        <div className="alert alert-danger" role="alert">
          Este enlace no es válido o ya expiró. Pedí uno nuevo.
        </div>
      </main>
    );
  }

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-4">Elegí tu nueva contraseña</h1>
      <ResetPasswordForm token={token} />
    </main>
  );
}
```

- [ ] **Step 4: Build y tipos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores; `/restablecer-password` aparece en la tabla de rutas.

- [ ] **Step 5: Suite completa**

Run: `npm test`
Expected: sin regresión (mismo conteo que al cierre de Task 1 — esta tarea no agrega tests automatizados).

- [ ] **Step 6: Verificación manual end-to-end (obligatoria)**

Con `npm run dev` corriendo y MariaDB activo:
1. Pedir un restablecimiento real para un usuario de prueba (vía `/olvide-password` o generando el token directamente con un script descartable, si Resend no está configurado en el entorno de prueba).
2. Abrir `/restablecer-password?token=<el token real>` → debe mostrar el formulario de nueva contraseña.
3. Enviar una nueva contraseña → debe redirigir a `/login`.
4. Iniciar sesión con la NUEVA contraseña → debe funcionar.
5. Intentar iniciar sesión con la contraseña VIEJA → debe fallar.
6. Volver a abrir el mismo link (`/restablecer-password?token=<mismo token>`) → debe mostrar "enlace inválido o expirado" (el token ya se usó).
7. Abrir `/restablecer-password?token=un-token-inventado` → debe mostrar el mismo mensaje de "enlace inválido o expirado".

- [ ] **Step 7: Commit**

```bash
git add src/app/restablecer-password/actions.ts src/app/restablecer-password/reset-password-form.tsx src/app/restablecer-password/page.tsx
git commit -m "feat(auth): add password reset confirmation page"
```

---

## Cierre de fase

Después de Task 3: correr `npm test` + `npm run build` + `npx tsc --noEmit` una vez más sobre el estado final del branch, luego usar `superpowers:subagent-driven-development`'s paso de revisión final de todo el branch (modelo más capaz) antes de ofrecer el merge a `main`, igual que en fases anteriores. Prestar especial atención en esa revisión final a que ningún mensaje de error o comportamiento observable distinga "correo existe" de "correo no existe" en ningún punto del flujo de `/olvide-password`.

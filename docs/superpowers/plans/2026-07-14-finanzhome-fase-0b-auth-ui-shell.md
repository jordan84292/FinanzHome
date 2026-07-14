# FinanzHome — Fase 0b: Auth, UI Shell & PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On top of Fase 0a's data layer, deliver a working login/register/onboarding flow (next-auth v5, Credentials + JWT), the household-invitation email via Resend, the mobile-first layout shell (Bootstrap 5 + bottom nav), and an installable PWA shell.

**Architecture:** Next.js Server Actions call thin, testable "core" functions (`registerNewUser`, `verifyCredentials`, `inviteHouseholdMember`) that in turn call Fase 0a's stored-procedure wrappers — never SQL directly. next-auth v5 uses Credentials + JWT session strategy (confirmed, no DB adapter — next-auth never touches the database itself; only `verifyCredentials` does, via `callProcedure`). External side effects (email sending) are isolated behind a single module so they're the one legitimate thing tests mock — everything DB-related in this plan still hits real MariaDB.

**Tech Stack (added this phase):** next-auth v5 (beta), Resend, zod, bcryptjs, Bootstrap 5 + Bootstrap Icons, SweetAlert2. `zustand`, Framer Motion, and Highcharts remain deferred — no consumer exists yet (Zustand's first real use is Fase 2's shopping-cart state).

## Global Constraints

- **DB-first, no ORM** (carried over from Fase 0a): the only new DB-touching code this phase is inside `verifyCredentials`, `registerNewUser`, and `inviteHouseholdMember` — each calls Fase 0a's existing wrappers (`getUserByEmail`, `registerUser`, `createHousehold`, `acceptInvitation`, `createInvitation`), never raw SQL.
- **next-auth v5: Credentials + JWT, no adapter** (confirmed this session). Session lives in a signed JWT cookie carrying `user.id`. No `accounts`/`sessions`/`verification_token` tables.
- **Mobile-first, real from the start:** every page in this phase is single-column, large tap targets, Bootstrap's mobile-first utilities — not a desktop layout squeezed down.
- **External APIs are the only thing we mock in tests.** Resend (`sendInvitationEmail`) is mocked in `invite-member.test.ts` because it's a paid external HTTP call — everything else (MariaDB via Fase 0a's wrappers) stays a real integration test, per this project's established testing convention.
- **Dependency minimalism continues:** only the packages with a real consumer in this phase are installed (see Tech Stack above). `zustand` is explicitly NOT installed yet.
- **PWA shell only, no offline caching yet:** this phase delivers an installable manifest + icons + a no-op service worker. Real offline caching of the shopping list is Fase 4's job (per the master plan) — don't build it early.

---

## File Structure

```
FinanzHome/
├── public/
│   ├── manifest.json
│   └── sw.js
├── src/
│   ├── auth.ts
│   ├── middleware.ts
│   ├── types/next-auth.d.ts
│   ├── app/
│   │   ├── layout.tsx            (modified)
│   │   ├── providers.tsx
│   │   ├── icon-192.png/route.tsx
│   │   ├── icon-512.png/route.tsx
│   │   ├── api/auth/[...nextauth]/route.ts
│   │   ├── register/
│   │   │   ├── actions.ts
│   │   │   └── page.tsx
│   │   ├── login/
│   │   │   ├── actions.ts
│   │   │   └── page.tsx
│   │   ├── onboarding/
│   │   │   ├── actions.ts
│   │   │   └── page.tsx
│   │   └── hogar/miembros/
│   │       ├── actions.ts
│   │       └── page.tsx
│   ├── components/
│   │   ├── BottomNav.tsx
│   │   └── ServiceWorkerRegister.tsx
│   └── lib/
│       ├── auth/
│       │   ├── password.ts
│       │   ├── verify-credentials.ts
│       │   └── register-user.ts
│       ├── validation/
│       │   ├── auth.ts
│       │   └── onboarding.ts
│       ├── email/
│       │   ├── resend-client.ts
│       │   └── send-invitation.ts
│       ├── household/
│       │   └── invite-member.ts
│       └── ui/
│           └── alerts.ts
└── tests/
    ├── lib/
    │   ├── auth/
    │   │   ├── password.test.ts
    │   │   ├── verify-credentials.test.ts
    │   │   └── register-user.test.ts
    │   ├── validation/
    │   │   ├── auth.test.ts
    │   │   └── onboarding.test.ts
    │   └── household/
    │       └── invite-member.test.ts
```

---

### Task 1: Instalar dependencias de Fase 0b

**Files:**
- Modify: `package.json`
- Modify: `.env.example`, `.env.local`

**Interfaces:** ninguna todavía.

- [ ] **Step 1: Instalar dependencias**

Run:
```bash
npm install next-auth@beta resend zod bcryptjs bootstrap bootstrap-icons sweetalert2
npm install -D @types/bcryptjs
```
Expected: no errors; `package.json` lists all 7 in `dependencies` and `@types/bcryptjs` in `devDependencies`. No `zustand`, `framer-motion`, or `highcharts` added — they have no consumer yet.

- [ ] **Step 2: Generar y agregar variables de entorno**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and use the printed value as `AUTH_SECRET` below.

Modify `.env.example`, append:
```
AUTH_SECRET=changeme-generate-a-real-secret
RESEND_API_KEY=re_placeholder_replace_with_real_key
APP_URL=http://localhost:3000
```

Modify `.env.local`, append (use the real generated secret from Step 1; `RESEND_API_KEY` can stay a placeholder for now — tests mock the email send, so a real key is only needed for manually sending a real invitation later):
```
AUTH_SECRET=<the generated hex string>
RESEND_API_KEY=re_placeholder_replace_with_real_key
APP_URL=http://localhost:3000
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example .env.local
git commit -m "chore: add auth, email, and UI dependencies for Fase 0b"
```

Note: `.env.local` is gitignored (confirmed in Fase 0a) — if `git add .env.local` reports nothing to add or refuses, that's correct; do not force-add it.

---

### Task 2: next-auth v5 (Credentials + JWT) — password hashing, credential verification, route handler, middleware

**Files:**
- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/verify-credentials.ts`
- Create: `src/types/next-auth.d.ts`
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`
- Test: `tests/lib/auth/password.test.ts`, `tests/lib/auth/verify-credentials.test.ts`

**Interfaces:**
- Consume: `getUserByEmail` from `src/lib/db/procedures/auth.ts` (Fase 0a, Task 4)
- Produce: `hashPassword(plain): Promise<string>`, `verifyPassword(plain, hash): Promise<boolean>` (`password.ts`) — consumed by Task 3's `registerNewUser`
- Produce: `verifyCredentials(email, password): Promise<AuthenticatedUser | null>` (`verify-credentials.ts`) — consumed by `src/auth.ts`'s Credentials provider
- Produce: `auth`, `signIn`, `signOut`, `handlers` exported from `src/auth.ts` — consumed by Tasks 3, 4, 5, 6

- [ ] **Step 1: Password hashing (TDD)**

Create `tests/lib/auth/password.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password hashing', () => {
  it('hashes a password and verifies it matches', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toBe('correct-horse-battery-staple');
    await expect(verifyPassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });
});
```

Run: `npm test -- password.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth/password'`.

Create `src/lib/auth/password.ts`:
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

Run: `npm test -- password.test.ts`
Expected: PASS (2/2).

- [ ] **Step 2: Credential verification against the real database (TDD)**

Create `tests/lib/auth/verify-credentials.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { hashPassword } from '@/lib/auth/password';
import { verifyCredentials } from '@/lib/auth/verify-credentials';
import { uniqueSuffix } from '../../helpers/db';

describe('verifyCredentials', () => {
  it('returns the user when email and password match', async () => {
    const suffix = uniqueSuffix();
    const email = `login_${suffix}@example.com`;
    const passwordHash = await hashPassword('s3cret-pass');
    await registerUser({ email, passwordHash, name: 'Login Test' });

    const result = await verifyCredentials(email, 's3cret-pass');
    expect(result?.email).toBe(email);
    expect(result?.name).toBe('Login Test');
  });

  it('returns null when the password is wrong', async () => {
    const suffix = uniqueSuffix();
    const email = `login2_${suffix}@example.com`;
    const passwordHash = await hashPassword('correct-pass');
    await registerUser({ email, passwordHash, name: 'Login Test 2' });

    const result = await verifyCredentials(email, 'wrong-pass');
    expect(result).toBeNull();
  });

  it('returns null when the email does not exist', async () => {
    const result = await verifyCredentials(`missing_${uniqueSuffix()}@example.com`, 'whatever');
    expect(result).toBeNull();
  });
});
```

Run: `npm test -- verify-credentials.test.ts`
Expected: FAIL — module doesn't exist.

Create `src/lib/auth/verify-credentials.ts`:
```ts
import { getUserByEmail } from '@/lib/db/procedures/auth';
import { verifyPassword } from './password';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) return null;

  return { id: String(user.id), email: user.email, name: user.name };
}
```

Run: `npm test -- verify-credentials.test.ts`
Expected: PASS (3/3).

- [ ] **Step 3: Session type augmentation**

Create `src/types/next-auth.d.ts`:
```ts
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
  }
}
```

- [ ] **Step 4: next-auth config**

Create `src/auth.ts`:
```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { verifyCredentials } from '@/lib/auth/verify-credentials';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== 'string' || typeof password !== 'string') return null;
        return verifyCredentials(email, password);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
```

- [ ] **Step 5: Route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```ts
export { GET, POST } from '@/auth';
```

If your `@/auth` re-export style doesn't allow named `GET`/`POST` directly (it exports `handlers`, not `GET`/`POST` individually), use instead:
```ts
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```
Use whichever form actually type-checks and builds — verify with `npm run build` after this step (see Step 7).

- [ ] **Step 6: Middleware to protect onboarding**

Create `src/middleware.ts`:
```ts
export { auth as middleware } from '@/auth';

export const config = {
  matcher: ['/onboarding/:path*', '/hogar/:path*'],
};
```

- [ ] **Step 7: Verify the whole suite still passes and the project builds**

Run: `npm test`
Expected: all prior tests (Fase 0a's 11 + this task's 5) pass, 16/16.

Run: `npm run build`
Expected: builds successfully (this is the first task that imports `next-auth` into actual route/middleware files, so a build failure here — e.g. edge-runtime incompatibility in `middleware.ts` — must be fixed before moving on; if `middleware.ts`'s `auth` export isn't edge-compatible, report the exact error rather than guessing a fix).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(auth): add next-auth v5 Credentials+JWT config, credential verification, and middleware"
```

---

### Task 3: Registro de usuario (Server Action + validación + página)

**Files:**
- Create: `src/lib/validation/auth.ts`
- Create: `src/lib/auth/register-user.ts`
- Create: `src/app/register/actions.ts`
- Create: `src/app/register/page.tsx`
- Test: `tests/lib/validation/auth.test.ts`, `tests/lib/auth/register-user.test.ts`

**Interfaces:**
- Consume: `getUserByEmail`, `registerUser` (Fase 0a), `hashPassword` (Task 2)
- Consume: `signIn` from `src/auth.ts` (Task 2) — used only inside the Server Action, not tested directly
- Produce: `registerNewUser(params): Promise<UserRecord>` — a thin, testable core the Server Action wraps

- [ ] **Step 1: Validation schema (TDD)**

Create `tests/lib/validation/auth.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { registerSchema } from '@/lib/validation/auth';

describe('registerSchema', () => {
  it('accepts valid registration input', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'a-valid-password',
      name: 'Jane Doe',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
      name: 'Jane Doe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'a-valid-password',
      name: 'Jane Doe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'a-valid-password',
      name: '',
    });
    expect(result.success).toBe(false);
  });
});
```

Run: `npm test -- auth.test.ts` (validation)
Expected: FAIL — module doesn't exist.

Create `src/lib/validation/auth.ts`:
```ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  name: z.string().min(1, 'El nombre es obligatorio').max(150),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

Run: `npm test -- auth.test.ts`
Expected: PASS (4/4). Note there are now two files matching the pattern `auth.test.ts` (`tests/lib/auth/verify-credentials.test.ts` doesn't match, but `tests/lib/validation/auth.test.ts` does) — if the filter is ambiguous, run `npm test -- tests/lib/validation/auth.test.ts` explicitly.

- [ ] **Step 2: Registration core logic (TDD, real DB)**

Create `tests/lib/auth/register-user.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { registerNewUser, EmailAlreadyRegisteredError } from '@/lib/auth/register-user';
import { verifyPassword } from '@/lib/auth/password';
import { getUserByEmail } from '@/lib/db/procedures/auth';
import { uniqueSuffix } from '../../helpers/db';

describe('registerNewUser', () => {
  it('creates a user with a hashed password', async () => {
    const suffix = uniqueSuffix();
    const email = `newuser_${suffix}@example.com`;

    const created = await registerNewUser({ email, password: 'my-secret-pw', name: 'New User' });

    expect(created.email).toBe(email);
    const stored = await getUserByEmail(email);
    expect(stored?.password_hash).not.toBe('my-secret-pw');
    await expect(verifyPassword('my-secret-pw', stored!.password_hash)).resolves.toBe(true);
  });

  it('rejects registering the same email twice', async () => {
    const suffix = uniqueSuffix();
    const email = `dup_${suffix}@example.com`;
    await registerNewUser({ email, password: 'pw-one', name: 'First' });

    await expect(
      registerNewUser({ email, password: 'pw-two', name: 'Second' }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });
});
```

Run: `npm test -- register-user.test.ts`
Expected: FAIL — module doesn't exist.

Create `src/lib/auth/register-user.ts`:
```ts
import { getUserByEmail, registerUser, type UserRecord } from '@/lib/db/procedures/auth';
import { hashPassword } from './password';

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Ya existe una cuenta con ese correo');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export async function registerNewUser(params: {
  email: string;
  password: string;
  name: string;
}): Promise<UserRecord> {
  const existing = await getUserByEmail(params.email);
  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }
  const passwordHash = await hashPassword(params.password);
  return registerUser({ email: params.email, passwordHash, name: params.name });
}
```

Run: `npm test -- register-user.test.ts`
Expected: PASS (2/2).

- [ ] **Step 3: Server Action (thin glue, not separately unit-tested — see note below)**

Create `src/app/register/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { registerSchema } from '@/lib/validation/auth';
import { registerNewUser, EmailAlreadyRegisteredError } from '@/lib/auth/register-user';

export interface RegisterActionState {
  error: string | null;
}

export async function registerAction(
  _prevState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await registerNewUser(parsed.data);
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return { error: error.message };
    }
    throw error;
  }

  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });

  redirect('/onboarding');
}
```

**Note on testing:** this action is intentionally thin — it validates (tested in Step 1), delegates to `registerNewUser` (tested in Step 2), then calls `signIn`/`redirect`, both of which require a running Next.js request context and are not meaningfully unit-testable in isolation. This project has no end-to-end browser test runner configured yet (an open decision noted in the master plan); verify this action manually in Step 5 by actually using the page.

- [ ] **Step 4: Registration page**

Create `src/app/register/page.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { registerAction, type RegisterActionState } from './actions';

const initialState: RegisterActionState = { error: null };

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-4">Crear cuenta</h1>
      <form action={formAction} className="d-flex flex-column gap-3">
        <div>
          <label htmlFor="name" className="form-label">Nombre</label>
          <input id="name" name="name" type="text" className="form-control" required />
        </div>
        <div>
          <label htmlFor="email" className="form-label">Correo</label>
          <input id="email" name="email" type="email" className="form-control" required />
        </div>
        <div>
          <label htmlFor="password" className="form-label">Contraseña</label>
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
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/register` in a browser, submit the form with a new email. Expected: redirected to `/onboarding` (which will 404 or render blank until Task 5 — that's fine, confirm the redirect happens and no server error is thrown). Stop the dev server after checking.

- [ ] **Step 6: Run full suite and commit**

Run: `npm test`
Expected: all tests pass (16 from Task 2 + 6 new = 22).

```bash
git add -A
git commit -m "feat(auth): add registration flow (validation, core logic, Server Action, page)"
```

---

### Task 4: Login (Server Action + página)

**Files:**
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consume: `signIn` from `src/auth.ts` (Task 2), which internally calls `verifyCredentials` (Task 2, already tested)

- [ ] **Step 1: Login Server Action**

Create `src/app/login/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';

export interface LoginActionState {
  error: string | null;
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { error: 'Ingresá tu correo y contraseña' };
  }

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Correo o contraseña incorrectos' };
    }
    throw error;
  }

  redirect('/onboarding');
}
```

**Note on testing:** no new automated test — this is glue over `signIn`, whose underlying credential check (`verifyCredentials`) is already covered by Task 2's tests. Verify manually in Step 3.

- [ ] **Step 2: Login page**

Create `src/app/login/page.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, type LoginActionState } from './actions';

const initialState: LoginActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-4">Iniciar sesión</h1>
      <form action={formAction} className="d-flex flex-column gap-3">
        <div>
          <label htmlFor="email" className="form-label">Correo</label>
          <input id="email" name="email" type="email" className="form-control" required />
        </div>
        <div>
          <label htmlFor="password" className="form-label">Contraseña</label>
          <input id="password" name="password" type="password" className="form-control" required />
        </div>
        {state.error ? (
          <div className="alert alert-danger py-2 mb-0" role="alert">
            {state.error}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="mt-3 small">
        ¿No tenés cuenta? <Link href="/register">Creá una</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Register a user via `/register` (or reuse one from a prior manual test), log out is not built yet so just open `/login` in a fresh private/incognito window and sign in with those credentials. Expected: redirected to `/onboarding` without error. Try a wrong password: expected inline error "Correo o contraseña incorrectos". Stop the dev server after checking.

- [ ] **Step 4: Run full suite (no new automated tests this task) and commit**

Run: `npm test`
Expected: still 22/22 passing (this task adds no new test files).

```bash
git add -A
git commit -m "feat(auth): add login Server Action and page"
```

---

### Task 5: Onboarding — crear hogar o aceptar invitación

**Files:**
- Create: `src/lib/validation/onboarding.ts`
- Create: `src/app/onboarding/actions.ts`
- Create: `src/app/onboarding/page.tsx`
- Test: `tests/lib/validation/onboarding.test.ts`

**Interfaces:**
- Consume: `createHousehold`, `acceptInvitation` (Fase 0a, Task 4), `auth` (Task 2)
- Produce: `createHouseholdSchema`, `acceptInvitationSchema` (validation) — used by this task's Server Actions only

- [ ] **Step 1: Validation schemas (TDD)**

Create `tests/lib/validation/onboarding.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createHouseholdSchema, acceptInvitationSchema } from '@/lib/validation/onboarding';

describe('createHouseholdSchema', () => {
  it('accepts a valid household name and payment day', () => {
    const result = createHouseholdSchema.safeParse({ name: 'Casa García', paymentDay: '15' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentDay).toBe(15);
    }
  });

  it('rejects a payment day outside 1-31', () => {
    const result = createHouseholdSchema.safeParse({ name: 'Casa García', paymentDay: '32' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty household name', () => {
    const result = createHouseholdSchema.safeParse({ name: '', paymentDay: '15' });
    expect(result.success).toBe(false);
  });
});

describe('acceptInvitationSchema', () => {
  it('accepts a valid token, display name, and payment day', () => {
    const result = acceptInvitationSchema.safeParse({
      token: 'abc123',
      displayName: 'Juan',
      paymentDay: '1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing token', () => {
    const result = acceptInvitationSchema.safeParse({
      token: '',
      displayName: 'Juan',
      paymentDay: '1',
    });
    expect(result.success).toBe(false);
  });
});
```

Run: `npm test -- onboarding.test.ts`
Expected: FAIL — module doesn't exist.

Create `src/lib/validation/onboarding.ts`:
```ts
import { z } from 'zod';

export const createHouseholdSchema = z.object({
  name: z.string().min(1, 'El nombre del hogar es obligatorio').max(150),
  paymentDay: z.coerce.number().int().min(1).max(31),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token inválido'),
  displayName: z.string().min(1, 'El nombre es obligatorio').max(150),
  paymentDay: z.coerce.number().int().min(1).max(31),
});
```

Run: `npm test -- onboarding.test.ts`
Expected: PASS (5/5).

- [ ] **Step 2: Onboarding Server Actions**

Create `src/app/onboarding/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { createHousehold, acceptInvitation } from '@/lib/db/procedures/household';
import { createHouseholdSchema, acceptInvitationSchema } from '@/lib/validation/onboarding';

export interface OnboardingActionState {
  error: string | null;
}

export async function createHouseholdAction(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Debés iniciar sesión' };
  }

  const parsed = createHouseholdSchema.safeParse({
    name: formData.get('name'),
    paymentDay: formData.get('paymentDay'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  await createHousehold({
    name: parsed.data.name,
    creatorUserId: Number(session.user.id),
    creatorDisplayName: session.user.name ?? 'Miembro',
    creatorPaymentDay: parsed.data.paymentDay,
  });

  redirect('/');
}

export async function acceptInvitationAction(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Debés iniciar sesión' };
  }

  const parsed = acceptInvitationSchema.safeParse({
    token: formData.get('token'),
    displayName: formData.get('displayName'),
    paymentDay: formData.get('paymentDay'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await acceptInvitation({
      token: parsed.data.token,
      userId: Number(session.user.id),
      displayName: parsed.data.displayName,
      paymentDay: parsed.data.paymentDay,
    });
  } catch {
    return { error: 'La invitación no es válida o ya expiró' };
  }

  redirect('/');
}
```

**Note on testing:** the zod schemas (the actual new logic) are tested in Step 1. `createHousehold`/`acceptInvitation` themselves are already integration-tested in Fase 0a. The Server Actions are session-dependent glue — verify manually in Step 4.

- [ ] **Step 3: Onboarding page**

Create `src/app/onboarding/page.tsx`:
```tsx
import { createHouseholdAction, acceptInvitationAction } from './actions';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  if (invite) {
    return (
      <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
        <h1 className="h4 mb-4">Unirte al hogar</h1>
        <form action={acceptInvitationAction} className="d-flex flex-column gap-3">
          <input type="hidden" name="token" value={invite} />
          <div>
            <label htmlFor="displayName" className="form-label">Tu nombre</label>
            <input id="displayName" name="displayName" type="text" className="form-control" required />
          </div>
          <div>
            <label htmlFor="paymentDay" className="form-label">Día de pago (1-31)</label>
            <input
              id="paymentDay"
              name="paymentDay"
              type="number"
              min={1}
              max={31}
              className="form-control"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">Unirme</button>
        </form>
      </main>
    );
  }

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-4">Creá tu hogar</h1>
      <form action={createHouseholdAction} className="d-flex flex-column gap-3">
        <div>
          <label htmlFor="name" className="form-label">Nombre del hogar</label>
          <input id="name" name="name" type="text" className="form-control" required />
        </div>
        <div>
          <label htmlFor="paymentDay" className="form-label">Tu día de pago (1-31)</label>
          <input
            id="paymentDay"
            name="paymentDay"
            type="number"
            min={1}
            max={31}
            className="form-control"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">Crear hogar</button>
      </form>
    </main>
  );
}
```

Note: this page uses the plain (non-`useActionState`) form-action pattern since it doesn't need pending/error UI feedback beyond a redirect — acceptable for this early phase; revisit if product feedback wants inline errors here too.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Register/login a user, land on `/onboarding`, create a household, confirm redirect to `/` with no error (the `/` page is still the Next.js default from Fase 0a — that's expected, later phases build the real dashboard there). Stop the dev server after checking.

- [ ] **Step 5: Run full suite and commit**

Run: `npm test`
Expected: 22 + 5 new = 27/27 passing.

```bash
git add -A
git commit -m "feat(onboarding): add household creation and invitation acceptance flow"
```

---

### Task 6: Invitación de miembros por email (Resend)

**Files:**
- Create: `src/lib/email/resend-client.ts`
- Create: `src/lib/email/send-invitation.ts`
- Create: `src/lib/household/invite-member.ts`
- Create: `src/app/hogar/miembros/actions.ts`
- Create: `src/app/hogar/miembros/page.tsx`
- Test: `tests/lib/household/invite-member.test.ts`

**Interfaces:**
- Consume: `createInvitation` (Fase 0a, Task 4), `getHouseholdsForUser` (Fase 0a, Task 4), `auth` (Task 2)
- Produce: `inviteHouseholdMember(params): Promise<void>` — the one function this project's tests mock a dependency of (`sendInvitationEmail`), since Resend is an external paid API

- [ ] **Step 1: Resend client and email sender**

Create `src/lib/email/resend-client.ts`:
```ts
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);
```

Create `src/lib/email/send-invitation.ts`:
```ts
import { resend } from './resend-client';

export async function sendInvitationEmail(params: {
  to: string;
  householdName: string;
  inviteUrl: string;
}): Promise<void> {
  await resend.emails.send({
    from: 'FinanzHome <onboarding@resend.dev>',
    to: params.to,
    subject: `Te invitaron a ${params.householdName} en FinanzHome`,
    html: `<p>Te invitaron a unirte a <strong>${params.householdName}</strong> en FinanzHome.</p><p><a href="${params.inviteUrl}">Aceptar invitación</a></p>`,
  });
}
```

- [ ] **Step 2: Invitation core logic (TDD, real DB + mocked email)**

Create `tests/lib/household/invite-member.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { uniqueSuffix } from '../../helpers/db';

const sendInvitationEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email/send-invitation', () => ({
  sendInvitationEmail: (...args: unknown[]) => sendInvitationEmailMock(...args),
}));

const { inviteHouseholdMember } = await import('@/lib/household/invite-member');

describe('inviteHouseholdMember', () => {
  beforeEach(() => {
    sendInvitationEmailMock.mockClear();
  });

  it('creates an invitation row and sends an email with a working invite link', async () => {
    const suffix = uniqueSuffix();
    const owner = await registerUser({
      email: `owner_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const household = await createHousehold({
      name: `Casa ${suffix}`,
      creatorUserId: owner.id,
      creatorDisplayName: 'Owner',
      creatorPaymentDay: 10,
    });
    const [membership] = await getHouseholdsForUser(owner.id);

    await inviteHouseholdMember({
      householdId: household.id,
      householdName: household.name,
      email: `invitee_${suffix}@example.com`,
      invitedByMemberId: membership.member_id,
      appUrl: 'http://localhost:3000',
    });

    expect(sendInvitationEmailMock).toHaveBeenCalledTimes(1);
    const call = sendInvitationEmailMock.mock.calls[0][0] as { to: string; inviteUrl: string };
    expect(call.to).toBe(`invitee_${suffix}@example.com`);
    expect(call.inviteUrl).toMatch(/^http:\/\/localhost:3000\/onboarding\?invite=[0-9a-f]{48}$/);
  });
});
```

Run: `npm test -- invite-member.test.ts`
Expected: FAIL — `src/lib/household/invite-member.ts` doesn't exist yet.

Create `src/lib/household/invite-member.ts`:
```ts
import { randomBytes } from 'node:crypto';
import { createInvitation } from '@/lib/db/procedures/household';
import { sendInvitationEmail } from '@/lib/email/send-invitation';

const INVITATION_TTL_DAYS = 7;

export async function inviteHouseholdMember(params: {
  householdId: number;
  householdName: string;
  email: string;
  invitedByMemberId: number;
  appUrl: string;
}): Promise<void> {
  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await createInvitation({
    householdId: params.householdId,
    email: params.email,
    token,
    invitedByMemberId: params.invitedByMemberId,
    expiresAt,
  });

  await sendInvitationEmail({
    to: params.email,
    householdName: params.householdName,
    inviteUrl: `${params.appUrl}/onboarding?invite=${token}`,
  });
}
```

Run: `npm test -- invite-member.test.ts`
Expected: PASS (1/1). If `vi.mock` + top-level `await import` ordering causes an issue in this Vitest version, an equivalent pattern is to call `vi.mock('@/lib/email/send-invitation', ...)` at the top of the file (hoisted automatically by Vitest) and use a regular top-level `import { inviteHouseholdMember } from '@/lib/household/invite-member'` — try the simpler regular-import form first; only fall back to the dynamic-import form if Vitest's mock hoisting doesn't apply cleanly to this import order.

- [ ] **Step 3: Server Action and page**

Create `src/app/hogar/miembros/actions.ts`:
```ts
'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { getHouseholdsForUser } from '@/lib/db/procedures/household';
import { inviteHouseholdMember } from '@/lib/household/invite-member';

const inviteSchema = z.object({ email: z.string().email() });

export interface InviteActionState {
  error: string | null;
  success: boolean;
}

export async function inviteMemberAction(
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Debés iniciar sesión', success: false };
  }

  const parsed = inviteSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: 'Correo inválido', success: false };
  }

  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    return { error: 'No pertenecés a ningún hogar todavía', success: false };
  }

  await inviteHouseholdMember({
    householdId: membership.id,
    householdName: membership.name,
    email: parsed.data.email,
    invitedByMemberId: membership.member_id,
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  });

  return { error: null, success: true };
}
```

Create `src/app/hogar/miembros/page.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import { inviteMemberAction, type InviteActionState } from './actions';

const initialState: InviteActionState = { error: null, success: false };

export default function HouseholdMembersPage() {
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-4">Invitar miembro</h1>
      <form action={formAction} className="d-flex flex-column gap-3">
        <div>
          <label htmlFor="email" className="form-label">Correo del invitado</label>
          <input id="email" name="email" type="email" className="form-control" required />
        </div>
        {state.error ? (
          <div className="alert alert-danger py-2 mb-0" role="alert">
            {state.error}
          </div>
        ) : null}
        {state.success ? (
          <div className="alert alert-success py-2 mb-0" role="alert">
            Invitación enviada.
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar invitación'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Run full suite and commit**

Run: `npm test`
Expected: 27 + 1 new = 28/28 passing.

```bash
git add -A
git commit -m "feat(household): add member invitation via Resend email"
```

---

### Task 7: Layout mobile-first (Bootstrap, navegación inferior, SessionProvider, SweetAlert2)

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/providers.tsx`
- Create: `src/components/BottomNav.tsx`
- Create: `src/lib/ui/alerts.ts`

**Interfaces:**
- Produce: `showError`, `showSuccess`, `confirmAction` from `src/lib/ui/alerts.ts` — no consumer yet in this plan (available for later phases' forms); this is the one exception to "no code without a consumer" because it's a 15-line pass-through wrapper around a library already justified by this task's need for user-facing alerts, not a speculative abstraction.

- [ ] **Step 1: Session provider wrapper (client component)**

Create `src/app/providers.tsx`:
```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 2: Bottom navigation**

Create `src/components/BottomNav.tsx`:
```tsx
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: 'bi-house' },
  { href: '/inventario', label: 'Inventario', icon: 'bi-basket' },
  { href: '/compras', label: 'Compras', icon: 'bi-cart' },
  { href: '/gastos', label: 'Gastos', icon: 'bi-wallet2' },
];

export function BottomNav() {
  return (
    <nav className="navbar fixed-bottom bg-body-tertiary border-top">
      <div className="container-fluid d-flex justify-content-around py-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="d-flex flex-column align-items-center text-decoration-none text-body small"
          >
            <i className={`bi ${item.icon} fs-5`} />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

Note: `/inventario`, `/compras`, `/gastos` don't exist yet — they're built in Fases 1/2/5 per the master plan. Linking to them now is intentional (the nav shell exists before the pages it points to); they'll 404 until those phases land, which is expected and not a bug in this task.

- [ ] **Step 3: SweetAlert2 helper**

Create `src/lib/ui/alerts.ts`:
```ts
'use client';

import Swal from 'sweetalert2';

export function showError(message: string): void {
  void Swal.fire({ icon: 'error', title: 'Error', text: message });
}

export function showSuccess(message: string): void {
  void Swal.fire({ icon: 'success', title: 'Listo', text: message, timer: 2000, showConfirmButton: false });
}

export async function confirmAction(message: string): Promise<boolean> {
  const result = await Swal.fire({
    icon: 'question',
    title: '¿Confirmar?',
    text: message,
    showCancelButton: true,
    confirmButtonText: 'Sí',
    cancelButtonText: 'Cancelar',
  });
  return result.isConfirmed;
}
```

No automated test: this is a thin, DOM-dependent wrapper around a UI library with no meaningful behavior to assert without a browser — verify visually in Step 5 by triggering an error state on `/register` or `/login`.

- [ ] **Step 4: Wire it all into the root layout**

Modify `src/app/layout.tsx` — read the current file first (it's the Fase 0a scaffold default), then update it to import Bootstrap's CSS, Bootstrap Icons' CSS, wrap children in `<Providers>`, and render `<BottomNav />`:
```tsx
import type { Metadata } from 'next';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.css';
import { Providers } from './providers';
import { BottomNav } from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'FinanzHome',
  description: 'Inventario, compras y finanzas del hogar',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="pb-5">
        <Providers>
          {children}
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
```
Keep whatever font-loading code (`next/font`) the Fase 0a scaffold already has in this file if present — only add the imports, `Providers` wrap, and `BottomNav` shown above; don't strip existing scaffold content that isn't in conflict with this.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Open `http://localhost:3000/login` — confirm Bootstrap styling is visibly applied (not unstyled HTML) and a bottom navigation bar with 4 icons is fixed at the bottom of the screen at mobile width (use browser dev tools' device toolbar at ~390px width). Confirm no console errors about SessionProvider context. Stop the dev server after checking.

- [ ] **Step 6: Run full suite and build, then commit**

Run: `npm test`
Expected: 28/28 still passing (no new tests this task).

Run: `npm run build`
Expected: builds successfully with Bootstrap CSS imports resolved.

```bash
git add -A
git commit -m "feat(ui): add mobile-first layout shell with Bootstrap, bottom nav, and SweetAlert2 helper"
```

---

### Task 8: PWA shell (manifest, íconos, service worker vacío)

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Create: `src/app/icon-192.png/route.tsx`
- Create: `src/app/icon-512.png/route.tsx`
- Create: `src/components/ServiceWorkerRegister.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:** none consumed by later tasks in this plan — this closes out Fase 0b. Real offline caching (reading the shopping list without signal) is Fase 4's job per the master plan; this task only makes the app installable.

- [ ] **Step 1: Manifest**

Create `public/manifest.json`:
```json
{
  "name": "FinanzHome",
  "short_name": "FinanzHome",
  "description": "Inventario, compras y finanzas del hogar",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0d6efd",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Dynamically generated icons (no image-editing tool needed)**

Create `src/app/icon-192.png/route.tsx`:
```tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d6efd',
          color: '#ffffff',
          fontSize: 96,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        FH
      </div>
    ),
    { width: 192, height: 192 },
  );
}
```

Create `src/app/icon-512.png/route.tsx` (identical shape, larger canvas):
```tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d6efd',
          color: '#ffffff',
          fontSize: 256,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        FH
      </div>
    ),
    { width: 512, height: 512 },
  );
}
```

If Next.js 16 rejects a folder name containing a literal dot (`icon-192.png/`) as a route segment, the fallback is to serve these from a single dynamic route instead — e.g. `src/app/icon/[size]/route.tsx` reading `params.size` — and update `manifest.json`'s icon `src` paths to match (`/icon/192`, `/icon/512`). Try the literal-filename-folder approach first since it keeps `manifest.json` conventional; only switch if the build actually fails on it, and report which approach you used.

- [ ] **Step 3: Minimal service worker (installable shell, no caching logic yet)**

Create `public/sw.js`:
```js
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

Create `src/components/ServiceWorkerRegister.tsx`:
```tsx
'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is a progressive enhancement here, not a hard requirement —
        // a failed registration shouldn't break the app.
      });
    }
  }, []);

  return null;
}
```

- [ ] **Step 4: Wire manifest metadata and mount the registrar**

Modify `src/app/layout.tsx`'s `metadata` export (added in Task 7) to include the manifest and theme color:
```ts
export const metadata: Metadata = {
  title: 'FinanzHome',
  description: 'Inventario, compras y finanzas del hogar',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#0d6efd',
};
```
(Next.js 16 separates `themeColor` into a `viewport` export rather than `metadata` — use whichever your installed Next version's type-checker accepts; if `metadata.themeColor` is flagged deprecated/invalid by `next build`, use the `viewport` export form shown above.)

Add `<ServiceWorkerRegister />` inside `<Providers>` in the same file, alongside `<BottomNav />`:
```tsx
<Providers>
  {children}
  <BottomNav />
  <ServiceWorkerRegister />
</Providers>
```

- [ ] **Step 5: Manual verification**

Run: `npm run build && npm run start` (service workers often don't register in `next dev`'s overlay-instrumented mode reliably — verify against a production build). Open `http://localhost:3000` in Chrome, open DevTools → Application tab → confirm "Manifest" shows FinanzHome with both icon sizes loading correctly, and "Service Workers" shows `sw.js` registered and activated. Confirm an install icon appears in the address bar (desktop Chrome) or "Add to Home Screen" is offered (mobile). Stop the server after checking.

- [ ] **Step 6: Run full suite and commit**

Run: `npm test`
Expected: 28/28 still passing (no new automated tests this task — PWA installability isn't unit-testable).

```bash
git add -A
git commit -m "feat(pwa): add installable manifest, dynamic icons, and no-op service worker shell"
```

---

## Self-Review

**Cobertura:** next-auth v5 Credentials+JWT (Task 2) ✓, registro (Task 3) ✓, login (Task 4) ✓, onboarding crear/unirse (Task 5) ✓, invitación por email vía Resend (Task 6) ✓, layout mobile-first con Bootstrap + bottom nav + SweetAlert2 (Task 7) ✓, PWA shell instalable (Task 8) ✓. Dashboard financiero, metas de ahorro, inventario, lista de compras, gastos recurrentes are explicitly out of scope — later phases per the master plan.

**Placeholders:** none — every step has complete, real code. The two "if X doesn't work, try Y" notes (route handler export style in Task 2 Step 5, icon route-segment naming in Task 8 Step 2, `themeColor` placement in Task 8 Step 4) are disclosed forks for genuine Next.js/next-auth version uncertainty at planning time, not vague placeholders — each names a concrete primary approach to try first and a concrete fallback, with an instruction to report which was used.

**Type consistency:** `AuthenticatedUser` (Task 2) with `id: string` matches what `authorize()` returns to next-auth and what `session.user.id` (typed via `src/types/next-auth.d.ts`) exposes downstream. `RegisterActionState`/`LoginActionState`/`OnboardingActionState`/`InviteActionState` each follow the same `{ error: string | null }`-based shape used consistently with `useActionState`.

**Testing honesty:** Tasks 4, 5 (Server Action layer), and 7/8 (UI/browser-only) explicitly document what is and isn't covered by automated tests, rather than fabricating tests around framework glue that isn't meaningfully unit-testable without a browser/E2E runner (an infrastructure decision this project hasn't made yet). Every piece of new *logic* (password hashing, credential verification, registration dedup, zod validation, invitation token+email) has a real test against either pure functions or the real MariaDB instance.

## Qué sigue

With Fase 0a (data layer) and Fase 0b (auth + UI shell + PWA shell) done, the master plan's next phases are Fase 1 (Inventario) and Fase 2 (Lista de compras inteligente) — the first phases that give the app real day-to-day utility. `zustand` gets installed there, for the in-progress shopping cart's client state.

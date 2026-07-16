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
      <p className="mt-2 small">
        <Link href="/olvide-password">¿Olvidaste tu contraseña?</Link>
      </p>
    </main>
  );
}

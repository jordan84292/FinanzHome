'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, type LoginActionState } from './actions';
import { AuthShell } from '@/components/auth/AuthShell';
import { PasswordInput } from '@/components/auth/PasswordInput';

const initialState: LoginActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Accedé a tu cuenta"
      footer={
        <>
          <p className="small mb-1">
            ¿No tenés cuenta? <Link href="/register">Creá una</Link>
          </p>
          <p className="small mb-0">
            <Link href="/olvide-password">¿Olvidaste tu contraseña?</Link>
          </p>
        </>
      }
    >
      <form action={formAction} className="d-flex flex-column gap-3">
        <div>
          <label htmlFor="email" className="form-label">Correo</label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-envelope-fill" />
            </span>
            <input id="email" name="email" type="email" className="form-control" required />
          </div>
        </div>
        <PasswordInput label="Contraseña" name="password" />
        {state.error ? (
          <div className="alert alert-danger py-2 mb-0" role="alert">
            {state.error}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </AuthShell>
  );
}

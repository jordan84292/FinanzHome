'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { registerAction, type RegisterActionState } from './actions';
import { AuthShell } from '@/components/auth/AuthShell';
import { PasswordInput } from '@/components/auth/PasswordInput';

const initialState: RegisterActionState = { error: null };

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Empezá a organizar las finanzas de tu hogar"
      footer={
        <p className="small mb-0">
          ¿Ya tenés cuenta? <Link href="/login">Iniciá sesión</Link>
        </p>
      }
    >
      <form action={formAction} className="d-flex flex-column gap-3">
        <div>
          <label htmlFor="name" className="form-label">Nombre</label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-person-fill" />
            </span>
            <input id="name" name="name" type="text" className="form-control" required />
          </div>
        </div>
        <div>
          <label htmlFor="email" className="form-label">Correo</label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-envelope-fill" />
            </span>
            <input id="email" name="email" type="email" className="form-control" required />
          </div>
        </div>
        <PasswordInput label="Contraseña" name="password" minLength={8} />
        {state.error ? (
          <div className="alert alert-danger py-2 mb-0" role="alert">
            {state.error}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthShell>
  );
}

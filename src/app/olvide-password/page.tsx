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

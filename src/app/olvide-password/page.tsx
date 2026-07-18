'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordResetAction, type RequestPasswordResetState } from './actions';
import { AuthShell } from '@/components/auth/AuthShell';

const initialState: RequestPasswordResetState = { submitted: false };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <AuthShell
      title="Restablecer contraseña"
      subtitle="Te enviamos los pasos por Telegram"
      footer={
        <p className="small mb-0">
          <Link href="/login">Volver a iniciar sesión</Link>
        </p>
      }
    >
      {state.submitted ? (
        <div className="alert alert-success py-2 mb-0" role="alert">
          Si la cuenta existe y tiene Telegram vinculado, te enviamos ahí las instrucciones.
        </div>
      ) : (
        <form action={formAction} className="d-flex flex-column gap-3">
          <div>
            <label htmlFor="email" className="form-label">Correo de tu cuenta</label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-envelope-fill" />
              </span>
              <input id="email" name="email" type="email" className="form-control" required />
            </div>
          </div>
          <p className="text-body-secondary small mb-0">
            Necesitás haber vinculado tu Telegram antes desde tu perfil para poder recibir el enlace acá.
          </p>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar instrucciones'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

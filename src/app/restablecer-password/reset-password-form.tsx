'use client';

import { useActionState } from 'react';
import { completePasswordResetAction, type CompletePasswordResetState } from './actions';
import { PasswordInput } from '@/components/auth/PasswordInput';

const initialState: CompletePasswordResetState = { error: null };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(completePasswordResetAction, initialState);

  return (
    <form action={formAction} className="d-flex flex-column gap-3">
      <input type="hidden" name="token" value={token} />
      <PasswordInput label="Nueva contraseña" name="password" minLength={8} />
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

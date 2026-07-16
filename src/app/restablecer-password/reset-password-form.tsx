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

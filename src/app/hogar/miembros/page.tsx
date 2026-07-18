'use client';

import { useActionState } from 'react';
import { inviteMemberAction, type InviteActionState } from './actions';

const initialState: InviteActionState = { error: null, success: false, emailSent: false };

export default function HouseholdMembersPage() {
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);

  return (
    <main className="container-fluid px-3 py-4 pb-bottom-nav" style={{ maxWidth: 420 }}>
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
            {state.emailSent
              ? 'Invitación enviada.'
              : 'Invitación creada, pero no pudimos enviar el correo. Compartí el enlace manualmente.'}
          </div>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar invitación'}
        </button>
      </form>
    </main>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { inviteMemberAction, type InviteActionState } from './actions';

const initialState: InviteActionState = { error: null, inviteUrl: null };

export default function HouseholdMembersPage() {
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);
  const [copied, setCopied] = useState(false);

  function handleCopy(url: string): void {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const telegramShareUrl = state.inviteUrl
    ? `https://t.me/share/url?url=${encodeURIComponent(state.inviteUrl)}&text=${encodeURIComponent('Te invité a FinanzHome, nuestro hogar en la app 🏠')}`
    : null;

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
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Creando…' : 'Crear invitación'}
        </button>
      </form>

      {state.inviteUrl ? (
        <div className="card mt-4">
          <div className="card-body">
            <div className="fw-semibold mb-1">Invitación creada</div>
            <p className="text-body-secondary small mb-3">
              Compartila por Telegram con la persona que invitaste.
            </p>
            <a href={telegramShareUrl!} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-100 mb-2">
              <i className="bi bi-telegram me-1" />
              Compartir por Telegram
            </a>
            <button
              type="button"
              className="btn btn-outline-secondary w-100"
              onClick={() => handleCopy(state.inviteUrl!)}
            >
              <i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'} me-1`} />
              {copied ? 'Copiado' : 'Copiar enlace'}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

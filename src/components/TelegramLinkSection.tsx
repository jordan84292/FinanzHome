'use client';

import { useEffect, useState } from 'react';
import {
  generateTelegramLinkAction,
  getTelegramLinkStateAction,
  type TelegramLinkState,
} from '@/app/perfil/actions';

export function TelegramLinkSection() {
  const [state, setState] = useState<TelegramLinkState | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    getTelegramLinkStateAction().then(setState);
  }, []);

  function handleGenerateLink(): void {
    setIsPending(true);
    generateTelegramLinkAction()
      .then(setState)
      .finally(() => setIsPending(false));
  }

  if (state === null) {
    return <p className="text-body-secondary">Cargando…</p>;
  }

  if (state.error) {
    return <p className="text-danger">{state.error}</p>;
  }

  if (state.isLinked) {
    return <p className="text-success mb-0">✅ Tu cuenta de Telegram ya está vinculada.</p>;
  }

  if (state.linkUrl) {
    return (
      <div className="d-flex flex-column gap-2">
        <a href={state.linkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-100">
          <i className="bi bi-telegram me-1" />
          Abrir Telegram y vincular
        </a>
        <p className="text-body-secondary small mb-0">
          Se va a abrir una conversación con el bot de FinanzHome. Tocá <strong>Iniciar</strong> (o
          enviá <code>/start</code>) para completar la vinculación.
        </p>
      </div>
    );
  }

  return (
    <button type="button" className="btn btn-outline-primary w-100" disabled={isPending} onClick={handleGenerateLink}>
      <i className="bi bi-telegram me-1" />
      {isPending ? 'Generando enlace…' : 'Vincular Telegram'}
    </button>
  );
}

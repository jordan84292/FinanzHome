'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPurchaseAction } from './actions';
import { showError, showSuccess } from '@/lib/ui/alerts';

export function ConfirmPurchaseButton({
  shoppingListId,
  disabled = false,
  onConfirmed,
}: {
  shoppingListId: number;
  disabled?: boolean;
  onConfirmed: (shoppingListId: number, isShared: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showChoice, setShowChoice] = useState(false);
  const router = useRouter();

  function handleChoose(isShared: boolean): void {
    setShowChoice(false);
    startTransition(() => {
      confirmPurchaseAction(shoppingListId, isShared)
        .then((result) => {
          if (result.error) {
            showError(result.error);
            return;
          }
          showSuccess(
            isShared ? 'Compra confirmada. Tu inventario se actualizó.' : 'Compra confirmada solo para vos.',
          );
          onConfirmed(shoppingListId, isShared);
          router.refresh();
        })
        .catch(() => {
          showError('No se pudo confirmar la compra. Intentá de nuevo.');
        });
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled || isPending}
        onClick={() => setShowChoice(true)}
      >
        {isPending ? 'Confirmando…' : 'Confirmar compra'}
      </button>

      {showChoice ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1070 }}
        >
          <div className="bg-body w-100 p-3 rounded-top-4">
            <h2 className="h6 mb-3">¿Esta compra se divide entre miembros del hogar?</h2>
            <div className="d-flex flex-column gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={isPending}
                onClick={() => handleChoose(true)}
              >
                Compartida
              </button>
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={isPending}
                onClick={() => handleChoose(false)}
              >
                Solo mía
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={isPending}
                onClick={() => setShowChoice(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

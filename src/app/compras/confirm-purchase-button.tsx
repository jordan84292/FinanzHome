'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPurchaseAction } from './actions';
import { showError, showSuccess } from '@/lib/ui/alerts';

export function ConfirmPurchaseButton({
  shoppingListId,
  onConfirmed,
}: {
  shoppingListId: number;
  onConfirmed: (shoppingListId: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm(): void {
    startTransition(() => {
      confirmPurchaseAction(shoppingListId)
        .then((result) => {
          if (result.error) {
            showError(result.error);
            return;
          }
          showSuccess('Compra confirmada. Tu inventario se actualizó.');
          onConfirmed(shoppingListId);
          router.refresh();
        })
        .catch(() => {
          showError('No se pudo confirmar la compra. Intentá de nuevo.');
        });
    });
  }

  return (
    <button type="button" className="btn btn-primary" disabled={isPending} onClick={handleConfirm}>
      {isPending ? 'Confirmando…' : 'Confirmar compra'}
    </button>
  );
}

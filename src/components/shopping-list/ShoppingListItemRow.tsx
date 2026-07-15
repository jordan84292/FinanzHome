'use client';

import { useTransition } from 'react';
import { deleteItemAction } from '@/app/compras/actions';
import { showError } from '@/lib/ui/alerts';
import type { ShoppingListItemRecord } from '@/lib/db/procedures/shopping-list';

export function ShoppingListItemRow({
  item,
  onEdit,
}: {
  item: ShoppingListItemRecord;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(): void {
    startTransition(() => {
      deleteItemAction(item.id).catch(() => {
        showError('No se pudo eliminar el producto. Intentá de nuevo.');
      });
    });
  }

  return (
    <li className="list-group-item d-flex justify-content-between align-items-center">
      <button
        type="button"
        className="btn btn-link text-start text-decoration-none p-0 flex-grow-1 text-body"
        onClick={onEdit}
      >
        <div className="fw-semibold">
          {item.product_name}
          {item.is_extra ? <span className="badge text-bg-secondary ms-2">Extra</span> : null}
        </div>
        <div className="text-body-secondary small">
          {item.quantity_needed} {item.unit_code}
          {item.unit_price !== null
            ? ` · ${item.unit_price_currency_symbol ?? ''}${item.unit_price} c/u`
            : ' · sin precio'}
        </div>
      </button>
      <button
        type="button"
        className="btn btn-outline-danger btn-sm"
        disabled={isPending}
        onClick={handleDelete}
        aria-label="Eliminar"
      >
        <i className="bi bi-trash" />
      </button>
    </li>
  );
}

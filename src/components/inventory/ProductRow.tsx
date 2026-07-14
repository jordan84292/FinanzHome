'use client';

import { useTransition } from 'react';
import { updateCurrentQuantityAction } from '@/app/inventario/actions';
import { showError } from '@/lib/ui/alerts';
import type { ProductRecord } from '@/lib/db/procedures/products';

export function ProductRow({
  product,
  onEdit,
}: {
  product: ProductRecord;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function adjust(delta: number): void {
    const next = Math.max(0, Number(product.current_quantity) + delta);
    startTransition(() => {
      updateCurrentQuantityAction(product.id, next).catch(() => {
        showError('No se pudo actualizar la cantidad. Intentá de nuevo.');
      });
    });
  }

  const isLow = Number(product.current_quantity) < Number(product.optimal_quantity);

  return (
    <li
      className={`list-group-item d-flex justify-content-between align-items-center ${
        isLow ? 'bg-warning-subtle' : ''
      }`}
    >
      <button
        type="button"
        className="btn btn-link text-start text-decoration-none p-0 flex-grow-1 text-body"
        onClick={onEdit}
      >
        <div className="fw-semibold">{product.name}</div>
        <div className="text-body-secondary small">
          {product.current_quantity} / {product.optimal_quantity} {product.unit_code}
        </div>
      </button>
      <div className="d-flex align-items-center gap-2">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isPending}
          onClick={() => adjust(-1)}
          aria-label="Restar uno"
        >
          <i className="bi bi-dash" />
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isPending}
          onClick={() => adjust(1)}
          aria-label="Sumar uno"
        >
          <i className="bi bi-plus" />
        </button>
      </div>
    </li>
  );
}

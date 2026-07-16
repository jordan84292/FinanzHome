'use client';

import { useEffect, useState, useTransition } from 'react';
import { getSplitAction, updateSplitAction } from '@/app/compras/actions';
import { showError, showSuccess } from '@/lib/ui/alerts';
import type { ShoppingListSplitRecord } from '@/lib/db/procedures/shopping-list-splits';

export function SplitPanel({
  shoppingListId,
  onClose,
}: {
  shoppingListId: number;
  onClose: () => void;
}) {
  const [splits, setSplits] = useState<ShoppingListSplitRecord[] | null>(null);
  const [percentages, setPercentages] = useState<Record<number, number>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getSplitAction(shoppingListId).then((result) => {
      if (result.error) {
        showError(result.error);
        return;
      }
      setSplits(result.splits);
      setPercentages(Object.fromEntries(result.splits.map((s) => [s.member_id, s.percentage])));
    });
  }, [shoppingListId]);

  const sum = Object.values(percentages).reduce((acc, value) => acc + value, 0);
  const sumIsValid = Math.abs(sum - 100) < 0.001;

  function handleSave(): void {
    const updates = Object.entries(percentages).map(([memberId, percentage]) => ({
      memberId: Number(memberId),
      percentage,
    }));
    startTransition(() => {
      updateSplitAction(shoppingListId, updates).then((result) => {
        if (result.error) {
          showError(result.error);
          return;
        }
        setSplits(result.splits);
        showSuccess('División guardada.');
      });
    });
  }

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
      style={{ zIndex: 1060 }}
    >
      <div className="bg-body w-100 p-3 rounded-top-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Dividir gasto</h2>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" />
        </div>

        {splits === null ? (
          <p className="text-body-secondary">Cargando…</p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {splits.map((split) => (
              <div key={split.member_id}>
                <label className="form-label">{split.display_name}</label>
                <div className="input-group">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    className="form-control"
                    value={percentages[split.member_id] ?? 0}
                    onChange={(e) =>
                      setPercentages((prev) => ({
                        ...prev,
                        [split.member_id]: Number(e.target.value),
                      }))
                    }
                  />
                  <span className="input-group-text">%</span>
                </div>
              </div>
            ))}
            <div className={sumIsValid ? 'text-success' : 'text-danger'}>
              Total: {sum.toFixed(2)}%
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!sumIsValid || isPending}
              onClick={handleSave}
            >
              {isPending ? 'Guardando…' : 'Guardar división'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

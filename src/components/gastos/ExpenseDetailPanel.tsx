'use client';

import { useEffect, useState, useTransition } from 'react';
import { getOccurrencesAction, markOccurrencePaidAction } from '@/app/gastos/actions';
import { showError, showSuccess } from '@/lib/ui/alerts';
import type { ExpenseOccurrenceRecord, RecurringExpenseRecord } from '@/lib/db/procedures/recurring-expenses';

export function ExpenseDetailPanel({
  expense,
  onClose,
  onEdit,
  onDeactivated,
}: {
  expense: RecurringExpenseRecord;
  onClose: () => void;
  onEdit: () => void;
  onDeactivated: () => void;
}) {
  const [occurrences, setOccurrences] = useState<ExpenseOccurrenceRecord[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getOccurrencesAction(expense.id).then((result) => {
      if (result.error) {
        showError(result.error);
        setHasError(true);
        return;
      }
      setOccurrences(result.occurrences);
    });
  }, [expense.id]);

  const nextUnpaid = occurrences?.find((o) => o.is_paid === 0) ?? null;

  function handleMarkPaid(): void {
    if (!nextUnpaid) return;
    startTransition(() => {
      markOccurrencePaidAction(nextUnpaid.id).then((result) => {
        if (result.error) {
          showError(result.error);
          return;
        }
        setOccurrences(result.occurrences);
        showSuccess('Gasto marcado como pagado.');
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
          <h2 className="h5 mb-0">{expense.name}</h2>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" />
        </div>

        <div className="text-body-secondary small mb-3">
          {expense.currency_symbol}
          {expense.amount} · {expense.category_name} · Responsable: {expense.responsible_display_name}
        </div>

        <div className="d-flex gap-2 mb-3">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={onDeactivated}>
            Desactivar
          </button>
        </div>

        {nextUnpaid ? (
          <button
            type="button"
            className="btn btn-primary w-100 mb-3"
            disabled={isPending}
            onClick={handleMarkPaid}
          >
            {isPending ? 'Guardando…' : `Marcar como pagado (vence ${nextUnpaid.due_date})`}
          </button>
        ) : null}

        <h3 className="h6 text-body-secondary text-uppercase">Historial</h3>
        {hasError ? (
          <p className="text-body-secondary">No se pudo cargar el historial.</p>
        ) : occurrences === null ? (
          <p className="text-body-secondary">Cargando…</p>
        ) : (
          <ul className="list-group">
            {occurrences.map((occurrence) => (
              <li key={occurrence.id} className="list-group-item d-flex justify-content-between align-items-center">
                <span>{occurrence.due_date}</span>
                <span className={occurrence.is_paid ? 'badge text-bg-success' : 'badge text-bg-secondary'}>
                  {occurrence.is_paid ? 'Pagado' : 'Pendiente'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

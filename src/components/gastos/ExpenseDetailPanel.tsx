'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  getOccurrencesAction,
  markOccurrencePaidAction,
  updateOccurrenceDueDateAction,
  getInstallmentsAction,
  markInstallmentPaidAction,
  getExpenseOccurrenceSharesAction,
  markExpenseOccurrenceSharePaidAction,
} from '@/app/gastos/actions';
import { showError, showSuccess } from '@/lib/ui/alerts';
import type { ExpenseOccurrenceRecord, RecurringExpenseRecord } from '@/lib/db/procedures/recurring-expenses';
import type { ExpenseInstallmentRecord } from '@/lib/db/procedures/expense-installments';
import type { ExpenseOccurrenceShareRecord } from '@/lib/db/procedures/expense-shares';

function InstallmentsSection({ recurringExpenseId }: { recurringExpenseId: number }) {
  const [installments, setInstallments] = useState<ExpenseInstallmentRecord[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getInstallmentsAction(recurringExpenseId).then((result) => {
      if (result.error) {
        showError(result.error);
        return;
      }
      setInstallments(result.installments);
    });
  }, [recurringExpenseId]);

  function handleMarkPaid(installmentId: number): void {
    startTransition(() => {
      markInstallmentPaidAction(installmentId).then((result) => {
        if (result.error) {
          showError(result.error);
          return;
        }
        setInstallments((prev) =>
          prev ? prev.map((i) => (i.id === installmentId ? result.installment! : i)) : prev,
        );
        showSuccess('Cuota marcada como apartada.');
      });
    });
  }

  if (installments === null) {
    return <p className="text-body-secondary">Cargando cuotas…</p>;
  }

  if (installments.length === 0) {
    return (
      <p className="text-body-secondary small">
        Todavía no hay cuotas generadas — configurá el % por periodo en &quot;Editar&quot;.
      </p>
    );
  }

  return (
    <ul className="list-group mb-3">
      {installments.map((installment) => (
        <li key={installment.id} className="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div>{installment.due_date}</div>
            <div className="text-body-secondary small">{installment.amount} ({installment.percentage}%)</div>
          </div>
          {installment.is_paid ? (
            <span className="badge text-bg-success">Apartada</span>
          ) : (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              disabled={isPending}
              onClick={() => handleMarkPaid(installment.id)}
            >
              Marcar apartada
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ExpenseDetailPanel({
  expense,
  onClose,
  onEdit,
  onDeleted,
  onRestored,
}: {
  expense: RecurringExpenseRecord;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  onRestored: () => void;
}) {
  const [occurrences, setOccurrences] = useState<ExpenseOccurrenceRecord[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editedDate, setEditedDate] = useState('');
  const [shares, setShares] = useState<ExpenseOccurrenceShareRecord[] | null>(null);

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
  const nextUnpaidId = nextUnpaid?.id ?? null;

  useEffect(() => {
    if (nextUnpaidId === null) {
      setShares(null);
      return;
    }
    getExpenseOccurrenceSharesAction(nextUnpaidId).then((result) => {
      if (result.error) {
        showError(result.error);
        return;
      }
      setShares(result.shares);
    });
  }, [nextUnpaidId]);

  const isShared = shares !== null && shares.length > 0;

  function handleToggleShare(shareId: number, isPaid: boolean): void {
    startTransition(() => {
      markExpenseOccurrenceSharePaidAction(shareId, isPaid).then((result) => {
        if (result.error) {
          showError(result.error);
          return;
        }
        setShares(result.shares);
        const allPaid = result.shares.length > 0 && result.shares.every((s) => s.is_paid === 1);
        setOccurrences((prev) =>
          prev
            ? prev.map((o) =>
                nextUnpaidId !== null && o.id === nextUnpaidId
                  ? { ...o, is_paid: allPaid ? 1 : 0, paid_at: allPaid ? new Date().toISOString() : null }
                  : o,
              )
            : prev,
        );
        showSuccess(isPaid ? 'Pago registrado.' : 'Pago desmarcado.');
      });
    });
  }

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

  function handleStartEditDate(): void {
    if (!nextUnpaid) return;
    setEditedDate(nextUnpaid.due_date);
    setIsEditingDate(true);
  }

  function handleSaveDate(): void {
    if (!nextUnpaid || !editedDate) return;
    startTransition(() => {
      updateOccurrenceDueDateAction(nextUnpaid.id, editedDate).then((result) => {
        if (result.error) {
          showError(result.error);
          return;
        }
        setOccurrences((prev) =>
          prev ? prev.map((o) => (o.id === nextUnpaid.id ? result.occurrence! : o)) : prev,
        );
        setIsEditingDate(false);
        showSuccess('Fecha actualizada.');
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

        {expense.is_active === 0 ? (
          <div className="alert alert-secondary py-2 small mb-3">Este gasto está eliminado.</div>
        ) : null}

        <div className="d-flex gap-2 mb-3">
          {expense.is_active === 1 ? (
            <>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onEdit}>
                Editar
              </button>
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={onDeleted}>
                Eliminar
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={onRestored}>
              Restaurar
            </button>
          )}
        </div>

        {expense.is_active === 1 && nextUnpaid && isEditingDate ? (
          <div className="input-group mb-3">
            <input
              type="date"
              className="form-control"
              value={editedDate}
              onChange={(e) => setEditedDate(e.target.value)}
            />
            <button type="button" className="btn btn-primary" disabled={isPending} onClick={handleSaveDate}>
              Guardar
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={isPending}
              onClick={() => setIsEditingDate(false)}
            >
              Cancelar
            </button>
          </div>
        ) : expense.is_active === 1 && nextUnpaid && isShared ? (
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className={shares!.every((s) => s.is_paid === 1) ? 'badge text-bg-success' : 'text-body-secondary small'}>
                Pagado {shares!.filter((s) => s.is_paid === 1).length}/{shares!.length}
              </span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={isPending}
                onClick={handleStartEditDate}
                aria-label="Editar fecha de vencimiento"
              >
                <i className="bi bi-pencil" /> Vence {nextUnpaid.due_date}
              </button>
            </div>
            {shares!.map((share) => (
              <div key={share.id} className="d-flex align-items-center justify-content-between py-2 border-top">
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={share.is_paid === 1}
                    disabled={isPending}
                    onChange={(e) => handleToggleShare(share.id, e.target.checked)}
                  />
                  <span>{share.display_name}</span>
                </div>
                <span className={share.is_paid === 1 ? 'text-success' : 'text-body-secondary'}>
                  {expense.currency_symbol}
                  {share.amount_owed}
                </span>
              </div>
            ))}
          </div>
        ) : expense.is_active === 1 && nextUnpaid ? (
          <div className="d-flex gap-2 mb-3">
            <button
              type="button"
              className="btn btn-primary flex-grow-1"
              disabled={isPending}
              onClick={handleMarkPaid}
            >
              {isPending ? 'Guardando…' : `Marcar como pagado (vence ${nextUnpaid.due_date})`}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={isPending}
              onClick={handleStartEditDate}
              aria-label="Editar fecha de vencimiento"
            >
              <i className="bi bi-pencil" />
            </button>
          </div>
        ) : null}

        {expense.periodicity === 'monthly' && expense.funding_mode === 'installments' ? (
          <>
            <h3 className="h6 text-body-secondary text-uppercase">Cuotas de este mes</h3>
            <InstallmentsSection recurringExpenseId={expense.id} />
          </>
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

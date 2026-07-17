'use client';

import type { RecurringExpenseRecord } from '@/lib/db/procedures/recurring-expenses';

const STATUS_LABELS: Record<string, string> = {
  vencido: 'Vencido',
  vence_pronto: 'Vence pronto',
  al_dia: 'Al día',
  sin_ocurrencia: 'Sin ciclo',
};

const STATUS_CLASSES: Record<string, string> = {
  vencido: 'text-bg-danger',
  vence_pronto: 'text-bg-warning',
  al_dia: 'text-bg-success',
  sin_ocurrencia: 'text-bg-secondary',
};

export function RecurringExpenseRow({
  expense,
  onClick,
}: {
  expense: RecurringExpenseRecord;
  onClick: () => void;
}) {
  const status = expense.status ?? 'sin_ocurrencia';

  return (
    <li className="list-group-item">
      <button
        type="button"
        className="btn btn-link text-start text-decoration-none p-0 w-100 text-body"
        onClick={onClick}
      >
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className="fw-semibold">{expense.name}</div>
            <div className="text-body-secondary small">
              {expense.currency_symbol}
              {expense.amount} · {expense.category_name} · {expense.responsible_display_name}
            </div>
            {expense.next_due_date ? (
              <div className="text-body-secondary small">Próximo vencimiento: {expense.next_due_date}</div>
            ) : null}
          </div>
          <span className={`badge ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
        </div>
      </button>
    </li>
  );
}

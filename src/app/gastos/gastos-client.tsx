'use client';

import { useState } from 'react';
import { RecurringExpenseRow } from '@/components/gastos/RecurringExpenseRow';
import { RecurringExpenseForm } from '@/components/gastos/RecurringExpenseForm';
import type { ExpenseCategoryRecord, RecurringExpenseRecord } from '@/lib/db/procedures/recurring-expenses';
import type { HouseholdMemberRecord } from '@/lib/db/procedures/household';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

type Panel =
  | { mode: 'create' }
  | { mode: 'edit'; expense: RecurringExpenseRecord }
  | { mode: 'detail'; expense: RecurringExpenseRecord }
  | null;

export function GastosClient({
  expenses,
  categories,
  members,
  currencies,
}: {
  expenses: RecurringExpenseRecord[];
  categories: ExpenseCategoryRecord[];
  members: HouseholdMemberRecord[];
  currencies: CurrencyRecord[];
}) {
  const [panel, setPanel] = useState<Panel>(null);

  return (
    <main className="container-fluid px-3 py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Gastos</h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPanel({ mode: 'create' })}>
          <i className="bi bi-plus-lg me-1" />
          Gasto
        </button>
      </div>

      <ul className="list-group">
        {expenses.map((expense) => (
          <RecurringExpenseRow
            key={expense.id}
            expense={expense}
            onClick={() => setPanel({ mode: 'detail', expense })}
          />
        ))}
      </ul>

      {expenses.length === 0 ? (
        <p className="text-body-secondary">Todavía no registraste gastos recurrentes.</p>
      ) : null}

      {panel && panel.mode !== 'detail' ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1050 }}
        >
          <div className="bg-body w-100 p-3 rounded-top-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">{panel.mode === 'create' ? 'Nuevo gasto' : 'Editar gasto'}</h2>
              <button type="button" className="btn-close" onClick={() => setPanel(null)} aria-label="Cerrar" />
            </div>
            <RecurringExpenseForm
              mode={panel.mode}
              expense={panel.mode === 'edit' ? panel.expense : undefined}
              categories={categories}
              members={members}
              currencies={currencies}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

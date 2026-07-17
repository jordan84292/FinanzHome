'use client';

import { useState } from 'react';
import { RecurringExpenseRow } from '@/components/gastos/RecurringExpenseRow';
import { RecurringExpenseForm } from '@/components/gastos/RecurringExpenseForm';
import { ExpenseDetailPanel } from '@/components/gastos/ExpenseDetailPanel';
import { showError, showSuccess } from '@/lib/ui/alerts';
import { deactivateRecurringExpenseAction, reactivateRecurringExpenseAction } from './actions';
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
  const [tab, setTab] = useState<'active' | 'deleted'>('active');

  const visibleExpenses = expenses.filter((e) => (tab === 'active' ? e.is_active === 1 : e.is_active === 0));

  return (
    <main className="container-fluid px-3 py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Gastos</h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPanel({ mode: 'create' })}>
          <i className="bi bi-plus-lg me-1" />
          Gasto
        </button>
      </div>

      <div className="btn-group mb-3" role="group">
        <button
          type="button"
          className={`btn btn-sm ${tab === 'active' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setTab('active')}
        >
          Activos
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'deleted' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setTab('deleted')}
        >
          Eliminados
        </button>
      </div>

      <ul className="list-group">
        {visibleExpenses.map((expense) => (
          <RecurringExpenseRow
            key={expense.id}
            expense={expense}
            onClick={() => setPanel({ mode: 'detail', expense })}
          />
        ))}
      </ul>

      {visibleExpenses.length === 0 ? (
        <p className="text-body-secondary">
          {tab === 'active' ? 'Todavía no registraste gastos recurrentes.' : 'No hay gastos eliminados.'}
        </p>
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
              onSuccess={() => setPanel(null)}
            />
          </div>
        </div>
      ) : null}

      {panel && panel.mode === 'detail' ? (
        <ExpenseDetailPanel
          expense={panel.expense}
          onClose={() => setPanel(null)}
          onEdit={() => setPanel({ mode: 'edit', expense: panel.expense })}
          onDeleted={() => {
            deactivateRecurringExpenseAction(panel.expense.id)
              .then(() => {
                showSuccess('Gasto eliminado. Podés restaurarlo desde "Eliminados".');
                setPanel(null);
              })
              .catch(() => showError('No se pudo eliminar el gasto. Intentá de nuevo.'));
          }}
          onRestored={() => {
            reactivateRecurringExpenseAction(panel.expense.id)
              .then(() => {
                showSuccess('Gasto restaurado.');
                setPanel(null);
              })
              .catch(() => showError('No se pudo restaurar el gasto. Intentá de nuevo.'));
          }}
        />
      ) : null}
    </main>
  );
}

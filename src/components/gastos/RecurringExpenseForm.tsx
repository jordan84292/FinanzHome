'use client';

import { useActionState, useState } from 'react';
import {
  createRecurringExpenseAction,
  updateRecurringExpenseAction,
  type CreateRecurringExpenseState,
  type UpdateRecurringExpenseState,
} from '@/app/gastos/actions';
import { CurrencyAmountInput } from '@/components/CurrencyAmountInput';
import type { ExpenseCategoryRecord, RecurringExpenseRecord } from '@/lib/db/procedures/recurring-expenses';
import type { HouseholdMemberRecord } from '@/lib/db/procedures/household';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

const initialState: CreateRecurringExpenseState | UpdateRecurringExpenseState = { error: null };

export function RecurringExpenseForm({
  mode,
  expense,
  categories,
  members,
  currencies,
}: {
  mode: 'create' | 'edit';
  expense?: RecurringExpenseRecord;
  categories: ExpenseCategoryRecord[];
  members: HouseholdMemberRecord[];
  currencies: CurrencyRecord[];
}) {
  const action = mode === 'create' ? createRecurringExpenseAction : updateRecurringExpenseAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [periodicity, setPeriodicity] = useState<'weekly' | 'biweekly' | 'one_time'>(
    expense?.periodicity ?? 'weekly',
  );

  return (
    <form action={formAction} className="d-flex flex-column gap-3">
      {mode === 'edit' && expense ? (
        <input type="hidden" name="recurringExpenseId" value={expense.id} />
      ) : null}
      <div>
        <label htmlFor="name" className="form-label">Nombre</label>
        <input id="name" name="name" type="text" defaultValue={expense?.name} className="form-control" required />
      </div>
      <div>
        <label htmlFor="categoryId" className="form-label">Categoría</label>
        <select id="categoryId" name="categoryId" defaultValue={expense?.category_id} className="form-select" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Monto</label>
        <CurrencyAmountInput
          amountName="amount"
          currencyName="currencyId"
          currencies={currencies}
          defaultAmount={expense?.amount}
          defaultCurrencyId={expense?.currency_id}
        />
      </div>
      <div>
        <label htmlFor="responsibleMemberId" className="form-label">Responsable</label>
        <select
          id="responsibleMemberId"
          name="responsibleMemberId"
          defaultValue={expense?.responsible_member_id}
          className="form-select"
          required
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.display_name}
            </option>
          ))}
        </select>
      </div>
      {mode === 'create' ? (
        <>
          <div>
            <label htmlFor="periodicity" className="form-label">Periodicidad</label>
            <select
              id="periodicity"
              name="periodicity"
              className="form-select"
              value={periodicity}
              onChange={(e) => setPeriodicity(e.target.value as 'weekly' | 'biweekly' | 'one_time')}
            >
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="one_time">Pago único</option>
            </select>
          </div>
          {periodicity === 'weekly' ? (
            <div>
              <label htmlFor="dueDayConfig" className="form-label">Día de la semana</label>
              <select id="dueDayConfig" name="dueDayConfig" className="form-select" required>
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {periodicity === 'weekly' || periodicity === 'biweekly' ? (
            <div>
              <label htmlFor="withdrawalDay" className="form-label">Día de retiro de fondos (1-31)</label>
              <input
                id="withdrawalDay"
                name="withdrawalDay"
                type="number"
                min={1}
                max={31}
                className="form-control"
                required
              />
            </div>
          ) : null}
          {periodicity === 'one_time' ? (
            <div>
              <label htmlFor="firstDueDate" className="form-label">Fecha de vencimiento</label>
              <input id="firstDueDate" name="firstDueDate" type="date" className="form-control" required />
            </div>
          ) : null}
        </>
      ) : null}
      {state.error ? (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {state.error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Guardando…' : mode === 'create' ? 'Agregar gasto' : 'Guardar cambios'}
      </button>
    </form>
  );
}

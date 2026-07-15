'use client';

import { useActionState, useState } from 'react';
import { updatePaymentScheduleAction, type UpdatePaymentScheduleState } from './actions';
import type { UserProfileRecord, PaymentFrequency } from '@/lib/db/procedures/profile';

const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

const initialState: UpdatePaymentScheduleState = { error: null, success: false };

export function PaymentScheduleForm({ profile }: { profile: UserProfileRecord | null }) {
  const [state, formAction, pending] = useActionState(updatePaymentScheduleAction, initialState);
  const [frequency, setFrequency] = useState<PaymentFrequency | ''>(profile?.payment_frequency ?? '');

  return (
    <form action={formAction} className="d-flex flex-column gap-3">
      <div>
        <label htmlFor="paymentFrequency" className="form-label">¿Cómo te pagan?</label>
        <select
          id="paymentFrequency"
          name="paymentFrequency"
          className="form-select"
          required
          value={frequency}
          onChange={(event) => setFrequency(event.target.value as PaymentFrequency)}
        >
          <option value="" disabled>Elegí una opción</option>
          <option value="weekly">Semanal</option>
          <option value="semimonthly">Quincenal (15 y fin de mes)</option>
          <option value="monthly">Mensual</option>
        </select>
      </div>

      {frequency === 'weekly' ? (
        <div>
          <label htmlFor="paymentWeekday" className="form-label">Día de la semana</label>
          <select
            id="paymentWeekday"
            name="paymentWeekday"
            className="form-select"
            defaultValue={profile?.payment_weekday ?? ''}
            required
          >
            <option value="" disabled>Elegí un día</option>
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      {frequency === 'monthly' ? (
        <div>
          <label htmlFor="paymentDay" className="form-label">Día del mes</label>
          <input
            id="paymentDay"
            name="paymentDay"
            type="number"
            min={1}
            max={31}
            className="form-control"
            defaultValue={profile?.payment_day ?? ''}
            required
          />
        </div>
      ) : null}

      {state.error ? (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {state.error}
        </div>
      ) : null}
      {state.success ? (
        <div className="alert alert-success py-2 mb-0" role="alert">
          Guardado.
        </div>
      ) : null}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}

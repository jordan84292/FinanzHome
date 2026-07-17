'use client';

import { useState } from 'react';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

export function CurrencyAmountInput({
  amountName,
  currencyName,
  currencies,
  defaultAmount,
  defaultCurrencyId,
}: {
  amountName: string;
  currencyName: string;
  currencies: CurrencyRecord[];
  defaultAmount?: number | null;
  defaultCurrencyId?: number | null;
}) {
  const [selectedCurrencyId, setSelectedCurrencyId] = useState(
    defaultCurrencyId ?? currencies[0]?.id ?? null,
  );
  const selected = currencies.find((c) => c.id === selectedCurrencyId);

  return (
    <div>
      <div className="btn-group w-100 mb-2" role="group" aria-label="Moneda">
        {currencies.map((currency) => (
          <div key={currency.id} className="flex-fill">
            <input
              type="radio"
              className="btn-check"
              name={currencyName}
              id={`${currencyName}-${currency.id}`}
              value={currency.id}
              autoComplete="off"
              checked={selectedCurrencyId === currency.id}
              onChange={() => setSelectedCurrencyId(currency.id)}
            />
            <label
              htmlFor={`${currencyName}-${currency.id}`}
              className={`btn w-100 ${selectedCurrencyId === currency.id ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              {currency.symbol} {currency.code}
            </label>
          </div>
        ))}
      </div>
      <div className="input-group">
        <span className="input-group-text fw-semibold" style={{ minWidth: 44, justifyContent: 'center' }}>
          {selected?.symbol ?? ''}
        </span>
        <input
          type="number"
          step="0.01"
          min={0}
          name={amountName}
          defaultValue={defaultAmount ?? undefined}
          className="form-control"
          placeholder="0.00"
        />
      </div>
    </div>
  );
}

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
  return (
    <div className="input-group">
      <input
        type="number"
        step="0.01"
        min={0}
        name={amountName}
        defaultValue={defaultAmount ?? undefined}
        className="form-control"
        placeholder="0.00"
      />
      <select
        name={currencyName}
        className="form-select flex-grow-0"
        style={{ maxWidth: 100 }}
        defaultValue={defaultCurrencyId ?? ''}
      >
        <option value="" disabled>
          —
        </option>
        {currencies.map((currency) => (
          <option key={currency.id} value={currency.id}>
            {currency.symbol} {currency.code}
          </option>
        ))}
      </select>
    </div>
  );
}

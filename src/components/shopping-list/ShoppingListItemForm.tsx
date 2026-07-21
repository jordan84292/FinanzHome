'use client';

import { useActionState } from 'react';
import {
  addItemAction,
  updateItemAction,
  type AddItemState,
  type UpdateItemState,
} from '@/app/compras/actions';
import { CurrencyAmountInput } from '@/components/CurrencyAmountInput';
import type { ShoppingListItemRecord } from '@/lib/db/procedures/shopping-list';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

const initialState: AddItemState | UpdateItemState = { error: null };
const CRC_ID = 1;

export function ShoppingListItemForm({
  mode,
  shoppingListId,
  item,
  currencies,
}: {
  mode: 'add' | 'edit';
  shoppingListId: number;
  item?: ShoppingListItemRecord;
  currencies: CurrencyRecord[];
}) {
  const action = mode === 'add' ? addItemAction : updateItemAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="d-flex flex-column gap-3">
      {mode === 'add' ? (
        <>
          <input type="hidden" name="shoppingListId" value={shoppingListId} />
          <div>
            <label htmlFor="customName" className="form-label">Producto</label>
            <input
              id="customName"
              name="customName"
              type="text"
              maxLength={150}
              className="form-control"
              placeholder="Nombre del producto"
              required
              autoFocus
            />
          </div>
        </>
      ) : (
        <input type="hidden" name="itemId" value={item?.id} />
      )}
      <div>
        <label htmlFor="quantityNeeded" className="form-label">Cantidad</label>
        <input
          id="quantityNeeded"
          name="quantityNeeded"
          type="number"
          step="0.01"
          min={0.01}
          defaultValue={item?.quantity_needed}
          className="form-control"
          required
        />
      </div>
      <div>
        <label className="form-label">Precio (opcional)</label>
        <CurrencyAmountInput
          amountName="unitPrice"
          currencyName="unitPriceCurrencyId"
          currencies={currencies}
          defaultAmount={item?.unit_price}
          defaultCurrencyId={item?.unit_price_currency_id ?? CRC_ID}
        />
      </div>
      {state.error ? (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {state.error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Guardando…' : mode === 'add' ? 'Agregar' : 'Guardar cambios'}
      </button>
    </form>
  );
}

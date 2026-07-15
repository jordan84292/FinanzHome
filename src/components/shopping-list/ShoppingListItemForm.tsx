'use client';

import { useActionState } from 'react';
import {
  addItemAction,
  updateItemAction,
  type AddItemState,
  type UpdateItemState,
} from '@/app/compras/actions';
import { CurrencyAmountInput } from '@/components/CurrencyAmountInput';
import type { ProductRecord } from '@/lib/db/procedures/products';
import type { ShoppingListItemRecord } from '@/lib/db/procedures/shopping-list';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

const initialState: AddItemState | UpdateItemState = { error: null };

export function ShoppingListItemForm({
  mode,
  shoppingListId,
  item,
  products,
  currencies,
}: {
  mode: 'add' | 'edit';
  shoppingListId: number;
  item?: ShoppingListItemRecord;
  products: ProductRecord[];
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
            <label htmlFor="productId" className="form-label">Producto</label>
            <select id="productId" name="productId" className="form-select" required>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
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
          defaultCurrencyId={item?.unit_price_currency_id}
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

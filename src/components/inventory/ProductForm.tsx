'use client';

import { useActionState, useEffect, useRef } from 'react';
import {
  createProductAction,
  updateProductAction,
  type CreateProductState,
  type UpdateProductState,
} from '@/app/inventario/actions';
import { showSuccess } from '@/lib/ui/alerts';
import { CurrencyAmountInput } from '@/components/CurrencyAmountInput';
import type { ProductCategoryRecord, ProductRecord, UnitOfMeasureRecord } from '@/lib/db/procedures/products';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

const CRC_ID = 1;

const initialState: CreateProductState | UpdateProductState = { error: null };

export function ProductForm({
  mode,
  product,
  categories,
  units,
  currencies,
  onSuccess,
}: {
  mode: 'create' | 'edit';
  product?: ProductRecord;
  categories: ProductCategoryRecord[];
  units: UnitOfMeasureRecord[];
  currencies: CurrencyRecord[];
  onSuccess?: () => void;
}) {
  const action = mode === 'create' ? createProductAction : updateProductAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      showSuccess(mode === 'create' ? 'Producto agregado.' : 'Cambios guardados.');
      onSuccess?.();
    }
    wasPending.current = pending;
  }, [pending, state, mode, onSuccess]);

  return (
    <form action={formAction} className="d-flex flex-column gap-3">
      {mode === 'edit' && product ? <input type="hidden" name="productId" value={product.id} /> : null}
      <div>
        <label htmlFor="name" className="form-label">Nombre</label>
        <input id="name" name="name" type="text" defaultValue={product?.name} className="form-control" required />
      </div>
      <div>
        <label htmlFor="categoryId" className="form-label">Categoría</label>
        <select id="categoryId" name="categoryId" defaultValue={product?.category_id} className="form-select" required>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="unitId" className="form-label">Unidad</label>
        <select id="unitId" name="unitId" defaultValue={product?.unit_id} className="form-select" required>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="optimalQuantity" className="form-label">Cantidad óptima</label>
        <input
          id="optimalQuantity"
          name="optimalQuantity"
          type="number"
          step="0.01"
          min={0}
          defaultValue={product?.optimal_quantity}
          className="form-control"
          required
        />
      </div>
      {mode === 'create' ? (
        <div>
          <label htmlFor="currentQuantity" className="form-label">Cantidad actual</label>
          <input
            id="currentQuantity"
            name="currentQuantity"
            type="number"
            step="0.01"
            min={0}
            defaultValue={0}
            className="form-control"
          />
        </div>
      ) : null}
      <div>
        <label className="form-label">Precio de referencia (opcional)</label>
        <CurrencyAmountInput
          amountName="defaultPrice"
          currencyName="defaultPriceCurrencyId"
          currencies={currencies}
          defaultAmount={product?.default_price}
          defaultCurrencyId={product?.default_price_currency_id ?? CRC_ID}
        />
      </div>
      {state.error ? (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {state.error}
        </div>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Guardando…' : mode === 'create' ? 'Agregar producto' : 'Guardar cambios'}
      </button>
    </form>
  );
}

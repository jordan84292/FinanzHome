'use client';

import { useMemo, useState } from 'react';
import { ProductRow } from '@/components/inventory/ProductRow';
import type { ProductCategoryRecord, ProductRecord, UnitOfMeasureRecord } from '@/lib/db/procedures/products';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

export function InventoryClient({
  products,
  categories,
  units,
  currencies,
}: {
  products: ProductRecord[];
  categories: ProductCategoryRecord[];
  units: UnitOfMeasureRecord[];
  currencies: CurrencyRecord[];
}) {
  const [panel, setPanel] = useState<{ mode: 'create' } | { mode: 'edit'; product: ProductRecord } | null>(
    null,
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ProductRecord[]>();
    for (const product of products) {
      const list = map.get(product.category_name) ?? [];
      list.push(product);
      map.set(product.category_name, list);
    }
    return map;
  }, [products]);

  return (
    <main className="container-fluid px-3 py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Inventario</h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPanel({ mode: 'create' })}>
          <i className="bi bi-plus-lg me-1" />
          Producto
        </button>
      </div>

      {[...grouped.entries()].map(([categoryName, items]) => (
        <section key={categoryName} className="mb-4">
          <h2 className="h6 text-body-secondary text-uppercase">{categoryName}</h2>
          <ul className="list-group">
            {items.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onEdit={() => setPanel({ mode: 'edit', product })}
              />
            ))}
          </ul>
        </section>
      ))}

      {products.length === 0 ? (
        <p className="text-body-secondary">Todavía no cargaste productos.</p>
      ) : null}

      {panel ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1050 }}
        >
          <div className="bg-body w-100 p-3 rounded-top" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">{panel.mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</h2>
              <button type="button" className="btn-close" onClick={() => setPanel(null)} aria-label="Cerrar" />
            </div>
            {/* ProductForm is wired in Task 6 */}
          </div>
        </div>
      ) : null}
    </main>
  );
}

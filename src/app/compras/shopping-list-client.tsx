'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingListItemRow } from '@/components/shopping-list/ShoppingListItemRow';
import { ShoppingListItemForm } from '@/components/shopping-list/ShoppingListItemForm';
import { ConfirmPurchaseButton } from './confirm-purchase-button';
import { SplitPanel } from '@/components/shopping-list/SplitPanel';
import { useOnlineStatus } from '@/lib/pwa/use-online-status';
import type { ProductRecord } from '@/lib/db/procedures/products';
import type { ShoppingListItemRecord, ShoppingListRecord } from '@/lib/db/procedures/shopping-list';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

export function ShoppingListClient({
  list,
  items,
  products,
  currencies,
  displayCurrencySymbol,
}: {
  list: ShoppingListRecord;
  items: ShoppingListItemRecord[];
  products: ProductRecord[];
  currencies: CurrencyRecord[];
  displayCurrencySymbol: string;
}) {
  const [panel, setPanel] = useState<{ mode: 'add' } | { mode: 'edit'; item: ShoppingListItemRecord } | null>(
    null,
  );
  const [confirmedListId, setConfirmedListId] = useState<number | null>(null);
  const [offlineList, setOfflineList] = useState<ShoppingListRecord | null>(null);
  const [offlineItems, setOfflineItems] = useState<ShoppingListItemRecord[] | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (isOnline) {
      setOfflineList(null);
      setOfflineItems(null);

      // Mientras hay red, "calentamos" la cache del service worker pegándole
      // al mismo endpoint que se lee offline — así, si más adelante se pierde
      // la señal, ya hay algo cacheado para mostrar. La UI en sí no usa esta
      // respuesta mientras está online (ya se está mostrando lo que el
      // servidor ya renderizó); esto es puramente para calentar la cache.
      fetch('/api/shopping-list/current').catch(() => {
        // No debería fallar estando online, pero si falla no hay nada más
        // que hacer acá — no afecta lo que se muestra.
      });
      return;
    }
    fetch('/api/shopping-list/current')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          setOfflineList(data.list);
          setOfflineItems(data.items);
        }
      })
      .catch(() => {
        // Sin red y sin nada en cache todavía — nos quedamos con lo último
        // que ya se renderizó desde el servidor.
      });
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) {
      setPanel(null);
    }
  }, [isOnline]);

  const displayList = offlineList ?? list;
  const displayItems = offlineItems ?? items;

  return (
    <main className="container-fluid px-3 py-4 pb-bottom-nav">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Lista de compras</h1>
        <div className="d-flex gap-2">
          <Link href="/compras/pagos" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-cash-coin me-1" />
            Pagos
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!isOnline}
            onClick={() => setPanel({ mode: 'add' })}
          >
            <i className="bi bi-plus-lg me-1" />
            Producto
          </button>
        </div>
      </div>

      <ul className="list-group mb-4">
        {displayItems.map((item) => (
          <ShoppingListItemRow
            key={item.id}
            item={item}
            disabled={!isOnline}
            onEdit={() => setPanel({ mode: 'edit', item })}
          />
        ))}
      </ul>

      {displayItems.length === 0 ? (
        <p className="text-body-secondary">No falta nada por ahora — tu inventario está al día.</p>
      ) : null}

      {panel ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1050 }}
        >
          <div className="bg-body w-100 p-3 rounded-top-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">{panel.mode === 'add' ? 'Agregar producto' : 'Editar producto'}</h2>
              <button type="button" className="btn-close" onClick={() => setPanel(null)} aria-label="Cerrar" />
            </div>
            <ShoppingListItemForm
              mode={panel.mode}
              shoppingListId={displayList.id}
              item={panel.mode === 'edit' ? panel.item : undefined}
              products={products}
              currencies={currencies}
            />
          </div>
        </div>
      ) : null}

      {displayItems.length > 0 ? (
        <div
          className="position-fixed bottom-0 start-0 w-100 bg-body border-top p-3"
          style={{ zIndex: 1040 }}
        >
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div>
              <div className="text-body-secondary small">Total estimado</div>
              <div className="h5 mb-0">
                {displayCurrencySymbol}
                {displayList.total_estimated_live ?? 0}
              </div>
            </div>
            <ConfirmPurchaseButton
              shoppingListId={displayList.id}
              disabled={!isOnline}
              onConfirmed={(id, isShared) => {
                if (isShared) setConfirmedListId(id);
              }}
            />
          </div>
          <Link href="/inventario" className="btn btn-outline-secondary btn-sm w-100">
            <i className="bi bi-arrow-left me-1" />
            Volver a inventario sin confirmar
          </Link>
        </div>
      ) : null}

      {confirmedListId ? (
        <SplitPanel shoppingListId={confirmedListId} onClose={() => setConfirmedListId(null)} />
      ) : null}
    </main>
  );
}

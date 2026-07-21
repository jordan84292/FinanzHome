'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { markSplitPaidAction } from '@/app/compras/actions';
import { showError } from '@/lib/ui/alerts';
import type { ShoppingListPaymentRecord } from '@/lib/db/procedures/shopping-list-splits';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PaymentRow({ payment }: { payment: ShoppingListPaymentRecord }) {
  const [isPaid, setIsPaid] = useState(payment.is_paid === 1);
  const [isPending, startTransition] = useTransition();

  function toggle(): void {
    const next = !isPaid;
    setIsPaid(next);
    startTransition(() => {
      markSplitPaidAction(payment.split_id, next).then((result) => {
        if (result.error) {
          setIsPaid(!next);
          showError(result.error);
        }
      });
    });
  }

  return (
    <div className="d-flex align-items-center justify-content-between py-2 border-top">
      <div className="d-flex align-items-center gap-2">
        <input
          type="checkbox"
          className="form-check-input"
          checked={isPaid}
          disabled={isPending}
          onChange={toggle}
        />
        <span>{payment.display_name}</span>
      </div>
      <span className={isPaid ? 'text-success' : 'text-body-secondary'}>
        {payment.currency_symbol}
        {payment.amount_owed}
      </span>
    </div>
  );
}

export function PagosPendientesClient({ payments }: { payments: ShoppingListPaymentRecord[] }) {
  const groups = useMemo(() => {
    const map = new Map<number, ShoppingListPaymentRecord[]>();
    for (const payment of payments) {
      const list = map.get(payment.shopping_list_id) ?? [];
      list.push(payment);
      map.set(payment.shopping_list_id, list);
    }
    return [...map.entries()];
  }, [payments]);

  return (
    <main className="container-fluid px-3 py-4 pb-bottom-nav">
      <div className="d-flex align-items-center gap-2 mb-3">
        <Link href="/compras" className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left" />
        </Link>
        <h1 className="h4 mb-0">Compras pendientes de pago</h1>
      </div>

      {groups.length === 0 ? (
        <p className="text-body-secondary">Todavía no hay compras confirmadas.</p>
      ) : (
        <div className="d-flex flex-column gap-3">
          {groups.map(([shoppingListId, rows]) => {
            const first = rows[0];
            const allPaid = rows.every((r) => r.is_paid === 1);
            return (
              <div key={shoppingListId} className={`card ${allPaid ? 'border-success' : ''}`}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <div className="fw-semibold">{formatDate(first.confirmed_at)}</div>
                      <div className="text-body-secondary small">
                        Total: {first.currency_symbol}
                        {first.total_actual}
                        {first.paid_by_display_name ? ` · Pagó ${first.paid_by_display_name}` : ''}
                      </div>
                    </div>
                    {allPaid ? <span className="badge text-bg-success">Todos pagaron</span> : null}
                  </div>
                  {rows.map((payment) => (
                    <PaymentRow key={payment.split_id} payment={payment} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

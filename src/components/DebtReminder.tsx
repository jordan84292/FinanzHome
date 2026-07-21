'use client';

import { useEffect } from 'react';
import { getMyShoppingDebtsAction } from '@/app/compras/actions';
import { showInfo } from '@/lib/ui/alerts';

// One check per app open, not per navigation — sessionStorage clears when the
// tab/PWA session ends, so the next time the app is opened this runs again
// and, if the debt is still unpaid, the reminder reappears.
const SESSION_FLAG = 'finanzhome:debt-reminder-shown';

export function DebtReminder() {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_FLAG)) return;
    sessionStorage.setItem(SESSION_FLAG, '1');

    getMyShoppingDebtsAction()
      .then((result) => {
        if (result.error || result.debts.length === 0) return;
        const lines = result.debts.map((debt) => {
          const symbol = debt.currency_symbol ?? '';
          const comprasWord = debt.pending_count === 1 ? 'compra pendiente' : 'compras pendientes';
          return `Le debés a ${debt.payer_display_name}: ${symbol}${debt.amount_owed} (${debt.pending_count} ${comprasWord})`;
        });
        showInfo('Tenés pagos pendientes', lines.join('\n'));
      })
      .catch(() => {
        // No autenticado, sin hogar todavía, o error de red — no hay nada que mostrar.
      });
  }, []);

  return null;
}

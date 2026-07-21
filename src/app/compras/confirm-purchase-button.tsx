'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPurchaseAction } from './actions';
import { showError, showSuccess } from '@/lib/ui/alerts';
import type { HouseholdMemberRecord } from '@/lib/db/procedures/household';

export function ConfirmPurchaseButton({
  shoppingListId,
  estimatedTotal,
  currencySymbol,
  members,
  currentMemberId,
  disabled = false,
  onConfirmed,
}: {
  shoppingListId: number;
  estimatedTotal: number;
  currencySymbol: string;
  members: HouseholdMemberRecord[];
  currentMemberId: number;
  disabled?: boolean;
  onConfirmed: (shoppingListId: number, isShared: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [isShared, setIsShared] = useState(true);
  const [actualTotal, setActualTotal] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState(currentMemberId);
  const router = useRouter();

  function handleOpen(): void {
    setActualTotal(estimatedTotal.toString());
    setIsShared(true);
    setPaidByMemberId(currentMemberId);
    setShowModal(true);
  }

  function handleConfirm(): void {
    const parsedTotal = Number(actualTotal);
    if (!actualTotal || Number.isNaN(parsedTotal) || parsedTotal < 0) {
      showError('Ingresá el monto gastado.');
      return;
    }
    setShowModal(false);
    startTransition(() => {
      confirmPurchaseAction(shoppingListId, isShared, parsedTotal, isShared ? paidByMemberId : currentMemberId)
        .then((result) => {
          if (result.error) {
            showError(result.error);
            return;
          }
          showSuccess(
            isShared ? 'Compra confirmada. Tu inventario se actualizó.' : 'Compra confirmada solo para vos.',
          );
          onConfirmed(shoppingListId, isShared);
          router.refresh();
        })
        .catch(() => {
          showError('No se pudo confirmar la compra. Intentá de nuevo.');
        });
    });
  }

  return (
    <>
      <button type="button" className="btn btn-primary" disabled={disabled || isPending} onClick={handleOpen}>
        {isPending ? 'Confirmando…' : 'Confirmar compra'}
      </button>

      {showModal ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1070 }}
        >
          <div className="bg-body w-100 p-3 rounded-top-4">
            <h2 className="h6 mb-3">Confirmar compra</h2>

            <label className="form-label small text-body-secondary" htmlFor="actual-total-input">
              Monto total gastado (el estimado era {currencySymbol}
              {estimatedTotal}, es solo de referencia)
            </label>
            <div className="input-group mb-3">
              <span className="input-group-text">{currencySymbol}</span>
              <input
                id="actual-total-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                className="form-control"
                value={actualTotal}
                onChange={(e) => setActualTotal(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mb-1 small text-body-secondary">¿Esta compra se divide entre miembros del hogar?</div>
            <div className="d-flex gap-2 mb-3">
              <button
                type="button"
                className={`btn flex-grow-1 ${isShared ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setIsShared(true)}
              >
                Compartida
              </button>
              <button
                type="button"
                className={`btn flex-grow-1 ${!isShared ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setIsShared(false)}
              >
                Solo mía
              </button>
            </div>

            {isShared ? (
              <div className="mb-3">
                <label className="form-label small text-body-secondary" htmlFor="paid-by-select">
                  ¿Quién pagó?
                </label>
                <select
                  id="paid-by-select"
                  className="form-select"
                  value={paidByMemberId}
                  onChange={(e) => setPaidByMemberId(Number(e.target.value))}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.id === currentMemberId ? `${member.display_name} (vos)` : member.display_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="d-flex gap-2">
              <button type="button" className="btn btn-primary flex-grow-1" disabled={isPending} onClick={handleConfirm}>
                Confirmar compra
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={isPending}
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

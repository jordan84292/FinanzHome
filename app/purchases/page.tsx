'use client';

import { useEffect, useState } from 'react';
import { useHouseholdStore } from '@/lib/store/household.store';
import { usePurchaseStore } from '@/lib/store/purchase.store';
import { useInventoryStore } from '@/lib/store/inventory.store';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import type { CreatePurchaseDto, CreatePurchaseItemDto } from '@/types/purchase.types';
import { format } from 'date-fns';

export default function PurchasesPage() {
  const { currentHousehold } = useHouseholdStore();
  const {
    purchases,
    supermarkets,
    isLoading,
    error,
    fetchPurchases,
    fetchSupermarkets,
    createPurchase,
    deletePurchase,
    clearError,
  } = usePurchaseStore();

  const { products, fetchProducts } = useInventoryStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<CreatePurchaseDto>({
    supermarket_id: 0,
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
    items: [],
  });

  const [currentItem, setCurrentItem] = useState<CreatePurchaseItemDto>({
    product_id: 0,
    quantity: 1,
    unit_price: 0,
  });

  useEffect(() => {
    if (currentHousehold) {
      fetchPurchases(currentHousehold.id);
      fetchSupermarkets(currentHousehold.id);
      fetchProducts(currentHousehold.id);
    }
  }, [currentHousehold, fetchPurchases, fetchSupermarkets, fetchProducts]);

  const handleAddItem = () => {
    if (currentItem.product_id && currentItem.quantity && currentItem.unit_price) {
      setPurchaseForm({
        ...purchaseForm,
        items: [...purchaseForm.items, { ...currentItem }],
      });
      setCurrentItem({ product_id: 0, quantity: 1, unit_price: 0 });
    }
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseForm({
      ...purchaseForm,
      items: purchaseForm.items.filter((_, i) => i !== index),
    });
  };

  const calculateTotal = () => {
    return purchaseForm.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentHousehold) return;

    try {
      await createPurchase(currentHousehold.id, purchaseForm);
      setShowCreateModal(false);
      setPurchaseForm({
        supermarket_id: 0,
        purchase_date: new Date().toISOString().split('T')[0],
        notes: '',
        items: [],
      });
    } catch (error) {
      console.error('Error creating purchase:', error);
    }
  };

  const handleDelete = async (purchaseId: number) => {
    if (!currentHousehold) return;
    if (!confirm('¿Eliminar esta compra?')) return;

    try {
      await deletePurchase(currentHousehold.id, purchaseId);
    } catch (error) {
      console.error('Error deleting purchase:', error);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="og-page-wrapper">
        {/* Header */}
        <div className="og-page-header">
          <div className="og-page-header-left">
            <h1 className="og-page-title">
              <i className="bi bi-cart3" style={{ marginRight: '8px', color: 'var(--og-gold)' }}></i>
              Compras
            </h1>
            <p className="og-page-sub">Registra tus compras de supermercado</p>
          </div>
          <div className="og-page-actions">
            <button
              className="og-btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={isLoading || !currentHousehold}
            >
              <i className="bi bi-plus-circle"></i>
              Nueva Compra
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="og-alert og-alert-danger og-alert-dismissible">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span>{error}</span>
            <button className="og-alert-close" onClick={clearError}>✕</button>
          </div>
        )}

        {/* No Household Warning */}
        {!currentHousehold && (
          <div className="og-alert og-alert-warn">
            <i className="bi bi-exclamation-triangle"></i>
            <span>Selecciona un hogar para ver las compras</span>
          </div>
        )}

        {/* Purchases Table */}
        {currentHousehold && (
          <div className="og-card">
            {purchases.length === 0 ? (
              <div className="og-empty-state">
                <i className="bi bi-cart-x og-empty-icon"></i>
                <h4 className="og-empty-title">No hay compras registradas</h4>
                <p className="og-empty-text">Comienza registrando tu primera compra</p>
                <button className="og-btn-primary" onClick={() => setShowCreateModal(true)}>
                  <i className="bi bi-plus-circle"></i>
                  Registrar Primera Compra
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="og-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Supermercado</th>
                      <th>Total</th>
                      <th>Productos</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((purchase) => (
                      <tr key={purchase.purchase_id}>
                        <td>{format(new Date(purchase.purchase_date), 'dd/MM/yyyy')}</td>
                        <td>{purchase.supermarket_name}</td>
                        <td>
                          <strong style={{ color: 'var(--og-gold)' }}>₡{purchase.total_amount.toLocaleString()}</strong>
                        </td>
                        <td>
                          <span className="og-badge og-badge-neutral">{purchase.items_count || 0} items</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="og-btn-danger og-btn-sm"
                            onClick={() => handleDelete(purchase.purchase_id)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create Purchase Modal */}
        {showCreateModal && (
          <div className="og-modal-backdrop">
            <div className="og-modal og-modal-lg">
              <form onSubmit={handleSubmit}>
                <div className="og-modal-header">
                  <h3 className="og-modal-title">
                    <i className="bi bi-plus-circle" style={{ marginRight: '8px' }}></i>
                    Nueva Compra
                  </h3>
                  <button type="button" className="og-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
                </div>
                <div className="og-modal-body">
                  <div className="og-form-row og-form-row--2" style={{ marginBottom: '16px' }}>
                    <div className="og-field og-field--select">
                      <label className="og-form-label">Supermercado *</label>
                      <select
                        className="og-form-control"
                        value={purchaseForm.supermarket_id}
                        onChange={(e) =>
                          setPurchaseForm({ ...purchaseForm, supermarket_id: parseInt(e.target.value) })
                        }
                        required
                      >
                        <option value="0">Selecciona un supermercado</option>
                        {supermarkets.map((s) => (
                          <option key={s.supermarket_id} value={s.supermarket_id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="og-field">
                      <label className="og-form-label">Fecha *</label>
                      <input
                        type="date"
                        className="og-form-control"
                        value={purchaseForm.purchase_date}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="og-divider"></div>

                  <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--og-ivory-dim)', marginBottom: '14px' }}>
                    <i className="bi bi-box-seam" style={{ marginRight: '6px' }}></i>Productos
                  </h4>
                  
                  <div className="og-form-row og-form-row--4" style={{ marginBottom: '16px' }}>
                    <div className="og-field og-field--select">
                      <label className="og-form-label">Producto</label>
                      <select
                        className="og-form-control"
                        value={currentItem.product_id}
                        onChange={(e) => setCurrentItem({ ...currentItem, product_id: parseInt(e.target.value) })}
                      >
                        <option value="0">Selecciona un producto</option>
                        {products.map((p) => (
                          <option key={p.product_id} value={p.product_id}>
                            {p.name} {p.brand && `- ${p.brand}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="og-field">
                      <label className="og-form-label">Cantidad</label>
                      <input
                        type="number"
                        className="og-form-control"
                        value={currentItem.quantity}
                        onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseFloat(e.target.value) })}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="og-field">
                      <label className="og-form-label">Precio Unit.</label>
                      <input
                        type="number"
                        className="og-form-control"
                        value={currentItem.unit_price}
                        onChange={(e) => setCurrentItem({ ...currentItem, unit_price: parseFloat(e.target.value) })}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button type="button" className="og-btn-primary" style={{ width: '100%' }} onClick={handleAddItem}>
                        <i className="bi bi-plus"></i>
                      </button>
                    </div>
                  </div>

                  {purchaseForm.items.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="og-table">
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>P. Unit.</th>
                            <th>Subtotal</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchaseForm.items.map((item, index) => {
                            const product = products.find((p) => p.product_id === item.product_id);
                            return (
                              <tr key={index}>
                                <td>{product?.name}</td>
                                <td>{item.quantity}</td>
                                <td>₡{item.unit_price}</td>
                                <td style={{ color: 'var(--og-gold)', fontWeight: 600 }}>₡{(item.quantity * item.unit_price).toFixed(2)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="og-btn-danger og-btn-sm"
                                    onClick={() => handleRemoveItem(index)}
                                  >
                                    <i className="bi bi-x"></i>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600 }}>Total:</td>
                            <td colSpan={2} style={{ color: 'var(--og-gold)', fontWeight: 600 }}>₡{calculateTotal().toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
                <div className="og-modal-footer">
                  <button type="button" className="og-btn-ghost" onClick={() => setShowCreateModal(false)} disabled={isLoading}>
                    Cancelar
                  </button>
                  <button type="submit" className="og-btn-primary" disabled={isLoading || purchaseForm.items.length === 0}>
                    {isLoading ? (
                      <>
                        <span className="og-spinner-sm"></span>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg"></i>
                        Guardar Compra
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
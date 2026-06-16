'use client';

import { useEffect, useState, useCallback } from 'react';
import { useHouseholdStore } from '@/lib/store/household.store';
import { useSupermarketStore } from '@/lib/store/supermarket.store';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Swal from 'sweetalert2';
import apiClient from '@/lib/api/config';

interface ShoppingListItem {
  tempId?: string;
  item_id: number;
  product_id: number | null;
  name: string;
  category_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  is_checked: boolean;
  is_extra: boolean;
}

interface SavedShoppingList {
  list_id: number;
  status: string;
  total_amount: number;
  supermarket_id: number;
  supermarket_name: string;
  total_items: number;
  checked_items: number;
  created_at: string;
}

interface GenerateListResponse {
  list_id: number;
  items: Array<{
    product_id: number;
    name: string;
    category_name: string;
    quantity: number;
    unit_price: number;
    is_extra: boolean;
  }>;
}

interface CompleteListRequest {
  items: ShoppingListItem[];
  supermarket_id: number;
  total_amount: number;
}

export default function ShoppingListsPage() {
  const { currentHousehold } = useHouseholdStore();
  const { supermarkets = [], fetchSupermarkets } = useSupermarketStore();

  const [savedLists, setSavedLists] = useState<SavedShoppingList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState<{ tempId: string; price: number } | null>(null);

  const [localItems, setLocalItems] = useState<ShoppingListItem[]>([]);
  const [extraForm, setExtraForm] = useState({ name: '', quantity: 1, unit_price: 0, category_name: 'Producto Extra' });
  const [completeForm, setCompleteForm] = useState({ supermarket_id: 0 });

  const fetchSavedLists = useCallback(async () => {
    if (!currentHousehold) return;
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/households/${currentHousehold.id}/shopping-lists`);
      setSavedLists(response.data.data?.lists || []);
    } catch (error: any) {
      console.error('Error fetching lists:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentHousehold]);

  useEffect(() => {
    if (currentHousehold) {
      fetchSupermarkets(currentHousehold.id);
      fetchSavedLists();
    }
  }, [currentHousehold, fetchSavedLists, fetchSupermarkets]);

  const handleGenerateList = async () => {
    if (!currentHousehold) return;
    setIsLoading(true);
    try {
      const response = await apiClient.post<{ success: boolean; data: GenerateListResponse }>(
        `/households/${currentHousehold.id}/shopping-lists/generate`
      );
      
      if (response.data.data?.items) {
        const items: ShoppingListItem[] = response.data.data.items.map((item, index) => ({
          tempId: `temp-${Date.now()}-${index}`,
          item_id: 0,
          product_id: item.product_id,
          name: item.name,
          category_name: item.category_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price,
          is_checked: false,
          is_extra: item.is_extra,
        }));
        setLocalItems(items);
        setShowListModal(true);
      }
    } catch (error: any) {
      console.error('generateList error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo generar la lista',
        confirmButtonColor: 'var(--og-primary)'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseListModal = () => {
    setLocalItems([]);
    setShowListModal(false);
    setEditingPrice(null);
  };

  const handleToggleItem = (tempId: string) => {
    setLocalItems(prev =>
      prev.map(item =>
        item.tempId === tempId ? { ...item, is_checked: !item.is_checked } : item
      )
    );
  };

  const handleUpdatePrice = (tempId: string) => {
    if (!editingPrice || editingPrice.tempId !== tempId) return;
    
    setLocalItems(prev =>
      prev.map(item =>
        item.tempId === tempId
          ? { ...item, unit_price: editingPrice.price, subtotal: item.quantity * editingPrice.price }
          : item
      )
    );
    setEditingPrice(null);
  };

  const handleAddExtra = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem: ShoppingListItem = {
      tempId: `temp-${Date.now()}`,
      item_id: 0,
      product_id: null,
      name: extraForm.name,
      category_name: extraForm.category_name,
      quantity: extraForm.quantity,
      unit_price: extraForm.unit_price,
      subtotal: extraForm.quantity * extraForm.unit_price,
      is_checked: true,
      is_extra: true,
    };
    setLocalItems(prev => [...prev, newItem]);
    setShowExtraModal(false);
    setExtraForm({ name: '', quantity: 1, unit_price: 0, category_name: 'Producto Extra' });
    Swal.fire({
      icon: 'success',
      title: '¡Producto agregado!',
      text: 'Producto extra añadido a la lista',
      confirmButtonColor: 'var(--og-primary)'
    });
  };

  const handleDeleteItem = (tempId: string) => {
    setLocalItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  const handleCompleteList = async (e: React.FormEvent) => {
    e.preventDefault();
    const checkedItems = localItems.filter(item => item.is_checked);
    if (checkedItems.length === 0) return;
    
    if (!currentHousehold) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay hogar seleccionado',
        confirmButtonColor: 'var(--og-primary)'
      });
      return;
    }

    // Validar supermarket seleccionado
    if (!completeForm.supermarket_id) {
      Swal.fire({
        icon: 'warning',
        title: 'Supermercado requerido',
        text: 'Por favor selecciona un supermercado',
        confirmButtonColor: 'var(--og-primary)'
      });
      return;
    }

    try {
      const totalAmount = checkedItems.reduce((sum, item) => sum + item.subtotal, 0);
      
      const response = await apiClient.post(
        `/households/${currentHousehold.id}/shopping-lists/complete`,
        {
          items: checkedItems.map(item => ({
            product_id: item.product_id,
            name: item.name,
            category_name: item.category_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            is_checked: item.is_checked,
            is_extra: item.is_extra,
          })),
          supermarket_id: completeForm.supermarket_id,
          total_amount: totalAmount,
        } as CompleteListRequest
      );

      if (response.data.success) {
        setShowCompleteModal(false);
        handleCloseListModal();
        fetchSavedLists();
        
        Swal.fire({
          icon: 'success',
          title: '¡Compra completada!',
          text: 'La lista ha sido guardada exitosamente',
          confirmButtonColor: 'var(--og-primary)'
        });
      } else {
        throw new Error(response.data.message || 'Error desconocido');
      }
    } catch (error: any) {
      console.error('Complete list error:', error.response?.data || error);
      
      Swal.fire({
        icon: 'error',
        title: 'Error al completar compra',
        text: error.response?.data?.message || error.message || 'No se pudo completar la compra. Revisa la consola para detalles.',
        confirmButtonColor: 'var(--og-primary)'
      });
    }
  };

  const handleDeleteSavedList = async (listId: number) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar lista?',
      text: 'Esta acción no se puede deshacer',
      showCancelButton: true,
      confirmButtonColor: 'var(--og-primary)',
      cancelButtonColor: 'var(--og-danger)',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await apiClient.delete(`/households/${currentHousehold?.id}/shopping-lists/${listId}`);
        fetchSavedLists();
        Swal.fire({
          icon: 'success',
          title: 'Eliminada',
          text: 'La lista ha sido eliminada',
          confirmButtonColor: 'var(--og-primary)'
        });
      } catch (error: any) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.message || 'No se pudo eliminar la lista',
          confirmButtonColor: 'var(--og-primary)'
        });
      }
    }
  };

  const allChecked = localItems.length > 0 && localItems.every(item => item.is_checked);
  const totalAmount = localItems
    .filter(item => item.is_checked)
    .reduce((sum, item) => sum + item.subtotal, 0);
  const checkedCount = localItems.filter(i => i.is_checked).length;
  const progressPercent = localItems.length > 0 ? (checkedCount / localItems.length) * 100 : 0;

  const groupedItems = localItems.reduce((acc, item) => {
    const cat = item.category_name || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, ShoppingListItem[]>);

  return (
    <AuthenticatedLayout>
      <div className="og-page-wrapper">
        <div className="og-page-header">
          <div className="og-page-header-left">
            <h1 className="og-page-title">
              <i className="bi bi-cart3" style={{ marginRight: '8px', color: 'var(--og-gold)' }}></i>
              Módulo de Compras
            </h1>
            <p className="og-page-sub">Genera tu checklist de compras basado en el stock objetivo</p>
          </div>
          <div className="og-page-actions">
            <button className="og-btn-primary" onClick={handleGenerateList} disabled={isLoading || !currentHousehold}>
              <i className="bi bi-magic"></i>
              Generar Lista
            </button>
          </div>
        </div>

        {!currentHousehold && (
          <div className="og-alert og-alert-warn">
            <i className="bi bi-exclamation-triangle"></i>
            <span>Selecciona un hogar para gestionar compras</span>
          </div>
        )}

        <div className="og-card">
          <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="bi bi-archive"></i>
            Listas Guardadas
          </h3>
          {savedLists.length === 0 ? (
            <div className="og-empty-state">
              <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
              <p style={{ margin: '10px 0 0', opacity: 0.6 }}>No hay listas guardadas</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {savedLists.map((list) => (
                <div
                  key={list.list_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="bi bi-list-task"></i>
                      Lista #{list.list_id}
                      <span className={`og-badge ${list.status === 'completed' ? 'og-badge-success' : 'og-badge-neutral'}`}>
                        {list.status === 'completed' ? 'Completada' : list.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '4px' }}>
                      {new Date(list.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--og-gold)' }}>
                        ${Number(list.total_amount).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
)}
        </div>

        {showCompleteModal && (
          <div className="og-modal-backdrop" data-level="1">
            <div className="og-modal">
              <form onSubmit={handleCompleteList}>
                <div className="og-modal-header">
                  <h3 className="og-modal-title">
                    <i className="bi bi-credit-card" style={{ marginRight: '8px' }}></i>
                    Completar Compra
                  </h3>
                  <button type="button" className="og-modal-close" onClick={() => setShowCompleteModal(false)}>X</button>
                </div>
                <div className="og-modal-body">
                  <div style={{
                    textAlign: 'center',
                    marginBottom: '24px',
                    padding: '24px',
                    background: 'linear-gradient(135deg, rgba(255,193,7,0.15) 0%, rgba(255,193,7,0.05) 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,193,7,0.2)'
                  }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '8px' }}>Total a Pagar</div>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--og-gold)', lineHeight: 1 }}>
                      ${totalAmount.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '8px' }}>
                      {localItems.length} producto(s)
                    </div>
                  </div>
                  <div className="og-field og-field--select">
                    <label className="og-form-label">Supermercado <span className="og-label-required">*</span></label>
                    <select
                      className="og-form-control"
                      value={completeForm.supermarket_id}
                      onChange={(e) => setCompleteForm({ ...completeForm, supermarket_id: parseInt(e.target.value) })}
                      required
                    >
                      <option value={0}>Selecciona un supermercado</option>
                      {supermarkets.map((s) => (
                        <option key={s.supermarket_id} value={s.supermarket_id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="og-modal-footer">
                  <button type="button" className="og-btn-ghost" onClick={() => {
                    setShowCompleteModal(false);
                    setShowListModal(true);
                  }}>
                    <i className="bi bi-arrow-left"></i>
                    Volver a la Lista
                  </button>
                  <button type="submit" className="og-btn-primary">
                    <i className="bi bi-check-circle"></i>
                    Confirmar Compra
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showListModal && (
          <div className="og-modal-backdrop" data-level="0">
            <div className="og-modal" style={{ maxWidth: '95vw', width: '900px', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="og-modal-header" style={{ background: 'linear-gradient(135deg, rgba(255,193,7,0.15) 0%, rgba(255,193,7,0.05) 100%)', borderBottom: '1px solid rgba(255,193,7,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'var(--og-gold-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <i className="bi bi-cart-check" style={{ fontSize: '24px', color: 'var(--og-gold)' }}></i>
                  </div>
                  <div>
                    <h3 className="og-modal-title" style={{ margin: 0 }}>
                      <i className="bi bi-list-check" style={{ marginRight: '8px' }}></i>
                      Checklist de Compras
                    </h3>
                    <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: '0.85rem' }}>
                      {checkedCount} de {localItems.length} productos marcados
                    </p>
                  </div>
                </div>
                <button type="button" className="og-modal-close" onClick={handleCloseListModal}>X</button>
              </div>
              
              <div className="og-modal-body" style={{ padding: '20px', flex: 1, overflow: 'auto', background: 'var(--color-background)' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span style={{ opacity: 0.7 }}>Progreso</span>
                      <span style={{ fontWeight: 600 }}>{Math.round(progressPercent)}%</span>
                    </div>
                    <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        background: progressPercent === 100 
                          ? 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)'
                          : 'linear-gradient(90deg, var(--og-gold) 0%, #fbbf24 100%)',
                        transition: 'width 0.4s ease',
                        borderRadius: '5px',
                      }} />
                    </div>
                  </div>
                  <button 
                    className="og-btn-secondary"
                    onClick={() => setShowExtraModal(true)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      padding: '10px 20px',
                      background: 'rgba(255,193,7,0.15)',
                      border: '1px solid rgba(255,193,7,0.3)',
                      color: 'var(--og-gold)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    <i className="bi bi-plus-circle"></i>
                    Agregar Producto
                  </button>
                </div>

                {Object.entries(groupedItems).map(([category, categoryItems]) => (
                  <div key={category} className="og-card" style={{ marginBottom: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px',
                      marginBottom: '14px',
                      paddingBottom: '10px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'var(--og-gold-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <i className="bi bi-folder" style={{ color: 'var(--og-gold)' }}></i>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--og-gold)', fontWeight: 600 }}>
                        {category}
                      </h3>
                      <span style={{ 
                        marginLeft: 'auto',
                        fontSize: '0.8rem', 
                        opacity: 0.5,
                        background: 'rgba(255,255,255,0.05)',
                        padding: '2px 8px',
                        borderRadius: '10px'
                      }}>
                        {categoryItems.filter(i => i.is_checked).length}/{categoryItems.length}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {categoryItems.map((item) => (
                        <div
                          key={item.tempId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 14px',
                            background: item.is_checked 
                              ? 'linear-gradient(135deg, rgba(74, 222, 128, 0.12) 0%, rgba(74, 222, 128, 0.05) 100%)'
                              : 'rgba(255,255,255,0.02)',
                            borderRadius: '10px',
                            border: `1px solid ${item.is_checked ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255,255,255,0.05)'}`,
                            transition: 'all 0.25s ease',
                          }}
                        >
                          <button
                            onClick={() => handleToggleItem(item.tempId!)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: `2px solid ${item.is_checked ? '#4ade80' : 'rgba(255,255,255,0.25)'}`,
                              background: item.is_checked ? '#4ade80' : 'transparent',
                              color: item.is_checked ? '#000' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              flexShrink: 0,
                            }}
                          >
                            {item.is_checked && <i className="bi bi-check-lg" style={{ fontSize: '16px' }}></i>}
                          </button>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{
                                textDecoration: item.is_checked ? 'line-through' : 'none',
                                opacity: item.is_checked ? 0.6 : 1,
                                fontWeight: 500,
                              }}>
                                {item.name}
                              </span>
                              {item.is_extra && (
                                <span style={{ 
                                  fontSize: '10px',
                                  background: 'rgba(255,193,7,0.2)',
                                  color: 'var(--og-gold)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 500
                                }}>
                                  EXTRA
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '2px' }}>
                              {item.quantity} — ${Number(item.unit_price).toFixed(2)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {editingPrice?.tempId === item.tempId ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  value={editingPrice?.price ?? 0}
                                  onChange={(e) => editingPrice && setEditingPrice({ ...editingPrice, price: parseFloat(e.target.value) })}
                                  style={{
                                    width: '90px',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--og-gold)',
                                    background: 'var(--color-obsidian)',
                                    color: '#fff',
                                    fontSize: '0.9rem',
                                  }}
                                  autoFocus
                                />
                                <button 
                                  className="og-btn-primary og-btn-sm" 
                                  onClick={() => handleUpdatePrice(item.tempId!)}
                                  style={{ padding: '8px 12px' }}
                                >
                                  <i className="bi bi-check"></i>
                                </button>
                                <button 
                                  className="og-btn-ghost og-btn-sm" 
                                  onClick={() => setEditingPrice(null)}
                                  style={{ padding: '8px 12px' }}
                                >
                                  <i className="bi bi-x"></i>
                                </button>
                              </div>
                            ) : (
                              <button
                                className="og-btn-ghost"
                                onClick={() => setEditingPrice({ tempId: item.tempId!, price: item.unit_price })}
                                title="Editar precio"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 14px',
                                  background: 'rgba(255,255,255,0.03)',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                }}
                              >
                                <span style={{ fontWeight: 700, color: 'var(--og-gold)', fontSize: '1rem' }}>
                                  ${Number(item.subtotal).toFixed(2)}
                                </span>
                                <i className="bi bi-pencil" style={{ fontSize: '0.75rem', opacity: 0.5 }}></i>
                              </button>
                            )}
                          </div>

                          <button
                            className="og-btn-danger og-btn-sm"
                            onClick={() => handleDeleteItem(item.tempId!)}
                            title="Eliminar"
                            style={{ 
                              flexShrink: 0,
                              padding: '8px 10px',
                              background: 'rgba(220, 53, 69, 0.1)',
                              border: '1px solid rgba(220, 53, 69, 0.2)',
                              borderRadius: '8px',
                            }}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {localItems.length === 0 && (
                  <div className="og-empty-state" style={{ padding: '40px' }}>
                    <i className="bi bi-cart-x" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                    <h4 className="og-empty-title">Lista vacía</h4>
                    <p className="og-empty-text">Agrega productos a tu lista de compras</p>
                  </div>
                )}
              </div>

              <div className="og-modal-footer" style={{ 
                background: 'linear-gradient(135deg, rgba(255,193,7,0.2) 0%, rgba(255,193,7,0.08) 100%)',
                borderTop: '1px solid rgba(255,193,7,0.3)',
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Total a Pagar</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--og-gold)', lineHeight: 1 }}>
                    ${totalAmount.toFixed(2)}
                  </div>
                </div>
                <button
                  className="og-btn-primary"
                  disabled={!allChecked || localItems.length === 0}
                  onClick={() => {
                    setShowListModal(false);
                    setShowCompleteModal(true);
                  }}
                  style={{
                    padding: '14px 32px',
                    fontSize: '1rem',
                    opacity: allChecked && localItems.length > 0 ? 1 : 0.5,
                    cursor: allChecked && localItems.length > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <i className="bi bi-credit-card" style={{ fontSize: '1.2rem' }}></i>
                  Completar Compra
                </button>
              </div>
              {!allChecked && localItems.length > 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '10px',
                  background: 'rgba(255,193,7,0.1)',
                  fontSize: '0.85rem',
                  color: 'var(--og-gold)',
                }}>
                  <i className="bi bi-info-circle"></i> Marca todos los productos para habilitar el botón de compra
                </div>
              )}
            </div>
          </div>
        )}

        {showExtraModal && (
          <div className="og-modal-backdrop" data-level="2">
            <div className="og-modal">
              <form onSubmit={handleAddExtra}>
                <div className="og-modal-header">
                  <h3 className="og-modal-title">
                    <i className="bi bi-plus-circle" style={{ marginRight: '8px' }}></i>
                    Agregar Producto
                  </h3>
                  <button type="button" className="og-modal-close" onClick={() => setShowExtraModal(false)}>X</button>
                </div>
                <div className="og-modal-body">
                  <div className="og-field" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Nombre del Producto <span className="og-label-required">*</span></label>
                    <input
                      type="text"
                      className="og-form-control"
                      value={extraForm.name}
                      onChange={(e) => setExtraForm({ ...extraForm, name: e.target.value })}
                      required
                      placeholder="Ej: Detergente para ropa"
                    />
                  </div>
                  
                  <div className="og-field" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Tipo de Producto <span className="og-label-required">*</span></label>
                    <select
                      className="og-form-control"
                      value={extraForm.category_name}
                      onChange={(e) => setExtraForm({ ...extraForm, category_name: e.target.value })}
                      required
                    >
                      <option value="Producto Extra">Producto Extra</option>
                      <option value="Alimentos y Bebidas">Alimentos y Bebidas</option>
                      <option value="Limpieza y Hogar">Limpieza y Hogar</option>
                      <option value="Higiene Personal">Higiene Personal</option>
                      <option value="Salud y Medicinas">Salud y Medicinas</option>
                      <option value="Mascotas">Mascotas</option>
                      <option value="Otros">Otros</option>
                    </select>
                    <small style={{ color: 'var(--og-ivory-dim)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      <i className="bi bi-info-circle" style={{ marginRight: '4px' }}></i>
                      Selecciona la categoría para este producto
                    </small>
                  </div>

                  <div className="og-form-row og-form-row--2" style={{ marginBottom: '14px' }}>
                    <div className="og-field">
                      <label className="og-form-label">Cantidad <span className="og-label-required">*</span></label>
                      <input
                        type="number"
                        className="og-form-control"
                        value={extraForm.quantity}
                        onChange={(e) => setExtraForm({ ...extraForm, quantity: parseFloat(e.target.value) })}
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="og-field">
                      <label className="og-form-label">Precio Unitario <span className="og-label-required">*</span></label>
                      <input
                        type="number"
                        className="og-form-control"
                        value={extraForm.unit_price}
                        onChange={(e) => setExtraForm({ ...extraForm, unit_price: parseFloat(e.target.value) })}
                        min="0"
                        step="0.01"
                        required
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <div className="og-modal-footer">
                  <button type="button" className="og-btn-ghost" onClick={() => setShowExtraModal(false)}>Cancelar</button>
                  <button type="submit" className="og-btn-primary">
                    <i className="bi bi-plus-lg"></i>
                    Agregar
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
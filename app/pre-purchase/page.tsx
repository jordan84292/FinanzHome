'use client';

import { useEffect, useState } from 'react';
import { useHouseholdStore } from '@/lib/store/household.store';
import { useInventoryStore } from '@/lib/store/inventory.store';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Swal from 'sweetalert2';
import apiClient from '@/lib/api/config';

interface Product {
  product_id: number;
  name: string;
  brand: string;
  category_id: number;
  category_name: string;
  category_icon: string;
  current_quantity: number;
  target_quantity: number;
  min_quantity: number;
  price: number;
  media_type: string;
  supermarket_id: number;
  supermarket_name: string;
  is_active: boolean;
  stock_status: 'out_of_stock' | 'low_stock' | 'below_target' | 'ok';
}

export default function PrePurchasePage() {
  const { currentHousehold } = useHouseholdStore();
  const { 
    products = [], 
    isLoading: productsLoading, 
    fetchPrePurchaseProducts 
  } = useInventoryStore();

  const [isSaving, setIsSaving] = useState(false);
  const [editedQuantities, setEditedQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    if (currentHousehold) {
      fetchPrePurchaseProducts(currentHousehold.id);
    }
  }, [currentHousehold, fetchPrePurchaseProducts]);

  useEffect(() => {
    if (products.length > 0) {
      const initialQuantities: Record<number, number> = {};
      products.forEach((p) => {
        initialQuantities[p.product_id] = p.current_quantity;
      });
      setEditedQuantities(initialQuantities);
    }
  }, [products]);

  const handleQuantityChange = (productId: number, value: number) => {
    setEditedQuantities(prev => ({ ...prev, [productId]: Math.max(0, value) }));
  };

  const handleSaveAll = async () => {
    if (!currentHousehold) return;
    
    const changes = Object.entries(editedQuantities)
      .filter(([_, qty]) => products.find(p => p.product_id === parseInt(_))?.current_quantity !== qty)
      .map(([productId, current_quantity]) => ({
        product_id: parseInt(productId),
        current_quantity,
      }));

    if (changes.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin cambios',
        text: 'No hay modificaciones para guardar',
        confirmButtonColor: 'var(--og-primary)',
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.put(`/households/${currentHousehold.id}/inventory/stock`, {
        products: changes,
      });
      Swal.fire({
        icon: 'success',
        title: '¡Guardado!',
        text: `Se actualizaron ${changes.length} productos`,
        confirmButtonColor: 'var(--og-primary)',
      });
      fetchPrePurchaseProducts(currentHousehold.id);
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudieron guardar los cambios',
        confirmButtonColor: 'var(--og-primary)',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = Object.entries(editedQuantities).some(
    ([productId, qty]) => products.find(p => p.product_id === parseInt(productId))?.current_quantity !== qty
  );

  const getMediaLabel = (type: string) => {
    const labels: Record<string, string> = { unit: 'und', kg: 'kg', g: 'g', l: 'L', ml: 'ml', lb: 'lb', oz: 'oz', gal: 'gal' };
    return labels[type] || '';
  };

  const getStockStatusBadge = (status: string, current: number, min: number, target: number) => {
    const unit = '';
    switch (status) {
      case 'out_of_stock':
        return <span className="og-badge og-badge-red">Agotado</span>;
      case 'low_stock':
        return <span className="og-badge og-badge-warn">Stock Bajo (&lt; {min})</span>;
      case 'below_target':
        return <span className="og-badge og-badge-info">Por debajo del objetivo (&lt; {target})</span>;
      case 'ok':
        return <span className="og-badge og-badge-green">OK</span>;
      default:
        return <span className="og-badge og-badge-neutral">{current}</span>;
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="og-page-wrapper">
        <div className="og-page-header">
          <div className="og-page-header-left">
            <h1 className="og-page-title">
              <i className="bi bi-clipboard-check" style={{ marginRight: '8px', color: 'var(--og-gold)' }}></i>
              Registro Previo a Compra
            </h1>
            <p className="og-page-sub">Revisa y ajusta el stock actual antes de generar la lista de compras</p>
          </div>
          <div className="og-page-actions">
            <button
              className="og-btn-primary"
              onClick={handleSaveAll}
              disabled={isSaving || !hasChanges || productsLoading || !currentHousehold}
            >
              <i className="bi bi-save"></i>
              {isSaving ? 'Guardando...' : 'Guardar Todos los Cambios'}
            </button>
          </div>
        </div>

        {!currentHousehold && (
          <div className="og-alert og-alert-warn">
            <i className="bi bi-exclamation-triangle"></i>
            <span>Selecciona un hogar para ver el registro previo a compra</span>
          </div>
        )}

        {currentHousehold && productsLoading && (
          <div className="og-card" style={{ textAlign: 'center', padding: '40px' }}>
            <div className="og-spinner" style={{ margin: '0 auto 16px' }}></div>
            <p>Cargando productos...</p>
          </div>
        )}

        {currentHousehold && !productsLoading && products.length === 0 && (
          <div className="og-card">
            <div className="og-empty-state">
              <i className="bi bi-inbox og-empty-icon"></i>
              <h4 className="og-empty-title">No hay productos</h4>
              <p className="og-empty-text">Añade productos al inventario para gestionar el stock previo a compra</p>
            </div>
          </div>
        )}

        {currentHousehold && !productsLoading && products.length > 0 && (
          <div className="og-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="og-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Stock Actual</th>
                    <th>Stock Mínimo</th>
                    <th>Stock Objetivo</th>
                    <th>Estado</th>
                    <th>Precio Est.</th>
                    <th>Supermercado</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const unit = getMediaLabel(product.media_type);
                    const editedQty = editedQuantities[product.product_id] ?? product.current_quantity;
                    const hasProductChanged = editedQty !== product.current_quantity;
                    return (
                      <tr key={product.product_id} style={hasProductChanged ? { backgroundColor: 'rgba(255, 193, 7, 0.08)' } : {}}>
                        <td>
                          <strong>{product.name}</strong>
                          {product.brand && <div className="og-text-muted" style={{ fontSize: '11px' }}>{product.brand}</div>}
                        </td>
                        <td>
                          {product.category_icon && <i className={`bi ${product.category_icon}`} style={{ marginRight: '6px', color: 'var(--og-gold)' }}></i>}
                          {product.category_name}
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editedQty}
                            onChange={(e) => handleQuantityChange(product.product_id, parseFloat(e.target.value) || 0)}
                            className="og-form-control"
                            style={{ width: '100px', padding: '6px 10px', fontSize: '0.9rem' }}
                          />
                          {unit && <span className="og-text-muted" style={{ marginLeft: '4px', fontSize: '0.8rem' }}>{unit}</span>}
                        </td>
                        <td>{product.min_quantity}{unit ? ` ${unit}` : ''}</td>
                        <td>{product.target_quantity}{unit ? ` ${unit}` : ''}</td>
                         <td>
                           {getStockStatusBadge(
                             product.stock_status || 'ok',
                             editedQty,
                             product.min_quantity,
                             product.target_quantity
                           )}
                         </td>
                         <td>{product.price ? `$${Number(product.price).toFixed(2)}` : '-'}</td>
                        <td>{product.supermarket_name || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasChanges && (
              <div className="og-alert og-alert-info" style={{ marginTop: '16px' }}>
                <i className="bi bi-info-circle"></i>
                <span>Hay {Object.entries(editedQuantities).filter(([id, qty]) => products.find(p => p.product_id === parseInt(id))?.current_quantity !== qty).length} producto(s) con cambios pendientes. Haz clic en "Guardar Todos los Cambios" para aplicar.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
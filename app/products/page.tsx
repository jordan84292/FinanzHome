'use client';

import { useEffect, useState } from 'react';
import { useHouseholdStore } from '@/lib/store/household.store';
import { useInventoryStore } from '@/lib/store/inventory.store';
import { useSupermarketStore } from '@/lib/store/supermarket.store';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import type { CreateProductDto, UpdateProductDto, UpdateStockDto } from '@/types/inventory.types';
import Swal from 'sweetalert2';

/**
 * Página de Productos - FinanzHome
 * Gestión de productos del hogar (independiente por hogar)
 */
export default function ProductsPage() {
  const { currentHousehold } = useHouseholdStore();
  const {
    products = [],
    categories = [],
    isLoading,
    error,
    fetchProducts,
    fetchCategories,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock,
    clearError,
  } = useInventoryStore();
  
  const { 
    supermarkets = [], 
    fetchSupermarkets 
  } = useSupermarketStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createForm, setCreateForm] = useState<CreateProductDto>({
    name: '',
    brand: '',
    category_id: 0,
    media_type: 'unit',
    target_quantity: 0,
    min_quantity: 0,
    price: undefined,
    supermarket_id: undefined,
    description: '',
  });

  const [editForm, setEditForm] = useState<UpdateProductDto>({
    name: '',
    brand: '',
    category_id: 0,
    media_type: 'unit',
    target_quantity: 0,
    min_quantity: 0,
    price: undefined,
    supermarket_id: undefined,
    description: '',
  });

  const [stockForm, setStockForm] = useState<UpdateStockDto>({
    operation: 'add',
    quantity_change: 0,
  });

  // Filtrar productos
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (product.brand && product.brand.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 0 || product.category_id === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Cargar datos al montar
  useEffect(() => {
    if (currentHousehold) {
      fetchProducts(currentHousehold.id);
      fetchCategories(currentHousehold.id);
      fetchSupermarkets(currentHousehold.id);
    }
  }, [currentHousehold, fetchProducts, fetchCategories, fetchSupermarkets]);

  // Handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentHousehold) return;

    // Preparar datos, excluyendo campos vacíos y convirtiendo valores
    const productData = {
      name: createForm.name,
      brand: createForm.brand || undefined,
      category_id: createForm.category_id,
      media_type: createForm.media_type,
      target_quantity: createForm.target_quantity || 0,
      min_quantity: createForm.min_quantity || 0,
      price: createForm.price,
      supermarket_id: createForm.supermarket_id || undefined,
      description: createForm.description || undefined,
    };

    setIsSubmitting(true);
    try {
      await createProduct(currentHousehold.id, productData);
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        brand: '',
        category_id: 0,
        media_type: 'unit',
        target_quantity: 0,
        min_quantity: 0,
        price: undefined,
        supermarket_id: undefined,
        description: '',
      });
      Swal.fire({
        icon: 'success',
        title: '¡Producto creado!',
        text: 'El producto se ha añadido al inventario.',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo crear el producto',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentHousehold || !selectedProductId) return;

    // Preparar datos, excluyendo campos vacíos
    const productData = {
      ...editForm,
      supermarket_id: editForm.supermarket_id || undefined,
    };

    setIsSubmitting(true);
    try {
      await updateProduct(currentHousehold.id, selectedProductId, productData);
      setShowEditModal(false);
      setSelectedProductId(null);
      setEditForm({
        name: '',
        brand: '',
        category_id: 0,
        media_type: 'unit',
        target_quantity: 0,
        min_quantity: 0,
        price: undefined,
        supermarket_id: undefined,
        description: '',
      });
      Swal.fire({
        icon: 'success',
        title: '¡Producto actualizado!',
        text: 'Los cambios se han guardado exitosamente.',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo actualizar el producto',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentHousehold || !selectedProductId) return;

    setIsSubmitting(true);
    try {
      await updateStock(currentHousehold.id, selectedProductId, stockForm);
      setShowStockModal(false);
      setStockForm({
        operation: 'add',
        quantity_change: 0,
      });
      setSelectedProductId(null);
      Swal.fire({
        icon: 'success',
        title: '¡Stock actualizado!',
        text: 'La cantidad ha sido modificada.',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo actualizar el stock',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: number, productName: string) => {
    if (!currentHousehold) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar producto?',
      text: `¿Estás seguro de que deseas eliminar "${productName}"?`,
      showCancelButton: true,
      confirmButtonColor: 'var(--og-danger)',
      cancelButtonColor: 'var(--og-secondary)',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: 'var(--og-surface-2)',
      color: 'var(--og-ivory)',
    });

    if (!result.isConfirmed) return;

    try {
      await deleteProduct(currentHousehold.id, productId);
      Swal.fire({
        icon: 'success',
        title: '¡Eliminado!',
        text: 'El producto ha sido eliminado.',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo eliminar el producto',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    }
  };

  const openStockModal = (productId: number) => {
    setSelectedProductId(productId);
    setShowStockModal(true);
  };

  const openEditModal = (product: any) => {
    setSelectedProductId(product.product_id);
    setEditForm({
      name: product.name || '',
      brand: product.brand || '',
      category_id: product.category_id || 0,
      media_type: product.media_type || 'unit',
      target_quantity: product.target_quantity || 0,
      min_quantity: product.min_quantity || 0,
      price: product.price || undefined,
      supermarket_id: product.supermarket_id || undefined,
      description: product.description || '',
    });
    setShowEditModal(true);
  };

  const getStockStatus = (current: number) => {
    if (current === 0) return { label: 'Agotado', class: 'og-badge-red' };
    if (current <= 1) return { label: 'Stock Bajo', class: 'og-badge-warn' };
    return { label: 'En Stock', class: 'og-badge-green' };
  };

  const getMediaTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      unit: 'und',
      kg: 'kg',
      g: 'g',
      lb: 'lb',
      oz: 'oz',
      l: 'L',
      ml: 'ml',
      gal: 'gal',
      other: '',
    };
    return labels[type] || '';
  };

  return (
    <AuthenticatedLayout>
      <div className="og-page-wrapper">
        {/* Header */}
        <div className="og-page-header">
          <div className="og-page-header-left">
            <h1 className="og-page-title">
              <i className="bi bi-box-seam" style={{ marginRight: '8px', color: 'var(--og-gold)' }}></i>
              Productos
            </h1>
            <p className="og-page-sub">Gestiona los productos de tu hogar</p>
          </div>
          <div className="og-page-actions">
            <button
              className="og-btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={!currentHousehold}
            >
              <i className="bi bi-plus-circle"></i>
              Añadir Producto
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="og-alert og-alert-danger">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span>{error}</span>
            <button className="og-alert-close" onClick={clearError}>✕</button>
          </div>
        )}

        {/* No Household Warning */}
        {!currentHousehold && (
          <div className="og-alert og-alert-warn">
            <i className="bi bi-exclamation-triangle"></i>
            <span>Selecciona un hogar para ver los productos</span>
          </div>
        )}

        {/* Filters */}
        {currentHousehold && (
          <div className="og-card og-card-sm" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="og-field" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                <input
                  type="text"
                  className="og-form-control"
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="og-field og-field--select" style={{ minWidth: '180px', marginBottom: 0 }}>
                <select
                  className="og-form-control"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(parseInt(e.target.value))}
                >
                  <option value="0">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--og-ivory-muted)' }}>
                {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Products Table */}
        {currentHousehold && (
          <div className="og-card">
            {filteredProducts.length === 0 ? (
              <div className="og-empty-state">
                <i className="bi bi-inbox og-empty-icon"></i>
                <h4 className="og-empty-title">No hay productos</h4>
                <p className="og-empty-text">Comienza añadiendo productos a tu inventario</p>
                <button className="og-btn-primary" onClick={() => setShowCreateModal(true)}>
                  <i className="bi bi-plus-circle"></i>
                  Añadir Primer Producto
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="og-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th>Stock</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const status = getStockStatus(product.current_quantity);
                      const unitLabel = getMediaTypeLabel(product.media_type);
                      return (
                        <tr key={product.product_id}>
                          <td>
                            <div>
                              <strong>{product.name}</strong>
                              {product.brand && (
                                <div className="og-text-muted" style={{ fontSize: '11px' }}>{product.brand}</div>
                              )}
                            </div>
                          </td>
                          <td>{product.category_name}</td>
                          <td>
                            <span className="og-badge og-badge-gold">
                              {product.current_quantity}{unitLabel ? ` ${unitLabel}` : ''}
                            </span>
                          </td>
                          <td>
                            <span className={`og-badge ${status.class}`}>
                              {status.label}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                className="og-btn-ghost og-btn-sm"
                                onClick={() => openEditModal(product)}
                                title="Editar"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="og-btn-ghost og-btn-sm"
                                onClick={() => openStockModal(product.product_id)}
                                title="Gestionar Stock"
                              >
                                <i className="bi bi-boxes"></i>
                              </button>
                              <button
                                className="og-btn-danger og-btn-sm"
                                onClick={() => handleDelete(product.product_id, product.name)}
                                title="Eliminar"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create Product Modal */}
        {showCreateModal && (
          <div className="og-modal-backdrop" onClick={() => setShowCreateModal(false)}>
            <div className="og-modal og-modal-lg" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleCreateSubmit}>
                <div className="og-modal-header">
                  <h3 className="og-modal-title">
                    <i className="bi bi-plus-circle" style={{ marginRight: '8px' }}></i>
                    Añadir Producto
                  </h3>
                  <button type="button" className="og-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
                </div>
                <div className="og-modal-body">
                  <div className="og-form-row og-form-row--2" style={{ marginBottom: '14px' }}>
                    <div className="og-field">
                      <label className="og-form-label">Nombre <span className="og-label-required">*</span></label>
                      <input
                        type="text"
                        className="og-form-control"
                        value={createForm.name}
                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                        required
                        maxLength={100}
                        placeholder="Ej: Arroz"
                      />
                    </div>
                    <div className="og-field">
                      <label className="og-form-label">Marca</label>
                      <input
                        type="text"
                        className="og-form-control"
                        value={createForm.brand}
                        onChange={(e) => setCreateForm({ ...createForm, brand: e.target.value })}
                        maxLength={100}
                        placeholder="Ej: Tio Juan"
                      />
                    </div>
                  </div>

                  <div className="og-form-row og-form-row--2" style={{ marginBottom: '14px' }}>
                    <div className="og-field og-field--select">
                      <label className="og-form-label">Categoría <span className="og-label-required">*</span></label>
                      <select
                        className="og-form-control"
                        value={createForm.category_id}
                        onChange={(e) => setCreateForm({ ...createForm, category_id: parseInt(e.target.value) })}
                        required
                      >
                        <option value="0">Selecciona una categoría</option>
                        {categories.map((cat) => (
                          <option key={cat.category_id} value={cat.category_id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="og-field og-field--select">
                      <label className="og-form-label">Tipo de Medida <span className="og-label-required">*</span></label>
                      <select
                        className="og-form-control"
                        value={createForm.media_type}
                        onChange={(e) => setCreateForm({ ...createForm, media_type: e.target.value as any })}
                        required
                      >
                        <option value="unit">Unidad</option>
                        <option value="kg">Kilogramo (kg)</option>
                        <option value="g">Gramo (g)</option>
                        <option value="lb">Libra (lb)</option>
                        <option value="oz">Onza (oz)</option>
                        <option value="l">Litro (L)</option>
                        <option value="ml">Mililitro (ml)</option>
                        <option value="gal">Galón</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="og-form-row og-form-row--2" style={{ marginBottom: '14px' }}>
                    <div className="og-field">
                      <label className="og-form-label">Precio Estimado</label>
                      <input
                        type="number"
                        className="og-form-control"
                        value={createForm.price || ''}
                        onChange={(e) => setCreateForm({ ...createForm, price: e.target.value ? parseFloat(e.target.value) : undefined })}
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                    <div className="og-field og-field--select">
                      <label className="og-form-label">Supermercado Preferido</label>
                      <select
                        className="og-form-control"
                        value={createForm.supermarket_id || ''}
                        onChange={(e) => setCreateForm({ ...createForm, supermarket_id: e.target.value ? parseInt(e.target.value) : undefined })}
                      >
                        <option value="">Sin preferencia</option>
                        {supermarkets.map((s) => (
                          <option key={s.supermarket_id} value={s.supermarket_id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="og-form-row og-form-row--2" style={{ marginBottom: '14px' }}>
                    <div className="og-field">
                      <label className="og-form-label">Stock Objetivo</label>
                      <input
                        type="number"
                        className="og-form-control"
                        value={createForm.target_quantity || ''}
                        onChange={(e) => setCreateForm({ ...createForm, target_quantity: e.target.value ? parseFloat(e.target.value) : 0 })}
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                    <div className="og-field">
                      <label className="og-form-label">Stock Mínimo</label>
                      <input
                        type="number"
                        className="og-form-control"
                        value={createForm.min_quantity || ''}
                        onChange={(e) => setCreateForm({ ...createForm, min_quantity: e.target.value ? parseFloat(e.target.value) : 0 })}
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="og-field" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Descripción</label>
                    <textarea
                      className="og-form-control og-form-textarea"
                      value={createForm.description || ''}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="Descripción adicional del producto (opcional)"
                      rows={2}
                    />
                  </div>
                </div>
                <div className="og-modal-footer">
                  <button type="button" className="og-btn-ghost" onClick={() => setShowCreateModal(false)} disabled={isSubmitting}>
                    Cancelar
                  </button>
                  <button type="submit" className="og-btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span>
                        <span className="og-spinner-sm"></span>
                        Creando...
                      </span>
                    ) : (
                      <span>
                        <i className="bi bi-check-lg"></i>
                        Crear Producto
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Product Modal */}
        {showEditModal && (
          <div className="og-modal-backdrop" onClick={() => setShowEditModal(false)}>
            <div className="og-modal og-modal-lg" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleEditSubmit}>
                <div className="og-modal-header">
                  <h3 className="og-modal-title">
                    <i className="bi bi-pencil" style={{ marginRight: '8px' }}></i>
                    Editar Producto
                  </h3>
                  <button type="button" className="og-modal-close" onClick={() => setShowEditModal(false)}>✕</button>
                </div>
                <div className="og-modal-body">
                  <div className="og-form-row og-form-row--2" style={{ marginBottom: '14px' }}>
                    <div className="og-field">
                      <label className="og-form-label">Nombre <span className="og-label-required">*</span></label>
                      <input
                        type="text"
                        className="og-form-control"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        required
                        maxLength={100}
                        placeholder="Ej: Arroz"
                      />
                    </div>
                    <div className="og-field">
                      <label className="og-form-label">Marca</label>
                      <input
                        type="text"
                        className="og-form-control"
                        value={editForm.brand}
                        onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                        maxLength={100}
                        placeholder="Ej: Tio Juan"
                      />
                    </div>
                  </div>

                  <div className="og-form-row og-form-row--2" style={{ marginBottom: '14px' }}>
                    <div className="og-field og-field--select">
                      <label className="og-form-label">Categoría <span className="og-label-required">*</span></label>
                      <select
                        className="og-form-control"
                        value={editForm.category_id}
                        onChange={(e) => setEditForm({ ...editForm, category_id: parseInt(e.target.value) })}
                        required
                      >
                        <option value="0">Selecciona una categoría</option>
                        {categories.map((cat) => (
                          <option key={cat.category_id} value={cat.category_id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="og-field og-field--select">
                      <label className="og-form-label">Tipo de Medida <span className="og-label-required">*</span></label>
                      <select
                        className="og-form-control"
                        value={editForm.media_type}
                        onChange={(e) => setEditForm({ ...editForm, media_type: e.target.value as any })}
                        required
                      >
                        <option value="unit">Unidad</option>
                        <option value="kg">Kilogramo (kg)</option>
                        <option value="g">Gramo (g)</option>
                        <option value="lb">Libra (lb)</option>
                        <option value="oz">Onza (oz)</option>
                        <option value="l">Litro (L)</option>
                        <option value="ml">Mililitro (ml)</option>
                        <option value="gal">Galón</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="og-form-row og-form-row--2" style={{ marginBottom: '14px' }}>
                    <div className="og-field">
                      <label className="og-form-label">Stock Objetivo</label>
                      <input
                        type="number"
                        className="og-form-control"
                        value={editForm.target_quantity || ''}
                        onChange={(e) => setEditForm({ ...editForm, target_quantity: e.target.value ? parseFloat(e.target.value) : 0 })}
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                    <div className="og-field">
                      <label className="og-form-label">Stock Mínimo</label>
                      <input
                        type="number"
                        className="og-form-control"
                        value={editForm.min_quantity || ''}
                        onChange={(e) => setEditForm({ ...editForm, min_quantity: e.target.value ? parseFloat(e.target.value) : 0 })}
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="og-form-row og-form-row--2" style={{ marginBottom: '14px' }}>
                    <div className="og-field">
                      <label className="og-form-label">Precio Estimado</label>
                      <input
                        type="number"
                        className="og-form-control"
                        value={editForm.price || ''}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value ? parseFloat(e.target.value) : undefined })}
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                    <div className="og-field og-field--select">
                      <label className="og-form-label">Supermercado Preferido</label>
                      <select
                        className="og-form-control"
                        value={editForm.supermarket_id || ''}
                        onChange={(e) => setEditForm({ ...editForm, supermarket_id: e.target.value ? parseInt(e.target.value) : undefined })}
                      >
                        <option value="">Sin preferencia</option>
                        {supermarkets.map((s) => (
                          <option key={s.supermarket_id} value={s.supermarket_id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="og-field" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Descripción</label>
                    <textarea
                      className="og-form-control og-form-textarea"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Descripción adicional del producto (opcional)"
                      rows={2}
                    />
                  </div>
                </div>
                <div className="og-modal-footer">
                  <button type="button" className="og-btn-ghost" onClick={() => setShowEditModal(false)} disabled={isSubmitting}>
                    Cancelar
                  </button>
                  <button type="submit" className="og-btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span>
                        <span className="og-spinner-sm"></span>
                        Guardando...
                      </span>
                    ) : (
                      <span>
                        <i className="bi bi-check-lg"></i>
                        Guardar Cambios
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Stock Management Modal */}
        {showStockModal && selectedProductId && (
          <div className="og-modal-backdrop" onClick={() => {
            setShowStockModal(false);
            setSelectedProductId(null);
          }}>
            <div className="og-modal" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleStockSubmit}>
                <div className="og-modal-header">
                  <h3 className="og-modal-title">
                    <i className="bi bi-boxes" style={{ marginRight: '8px' }}></i>
                    Gestionar Stock
                  </h3>
                  <button type="button" className="og-modal-close" onClick={() => {
                    setShowStockModal(false);
                    setSelectedProductId(null);
                  }}>✕</button>
                </div>
                <div className="og-modal-body">
                  <div className="og-field og-field--select" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Tipo de Operación</label>
                    <select
                      className="og-form-control"
                      value={stockForm.operation}
                      onChange={(e) => setStockForm({ ...stockForm, operation: e.target.value as 'add' | 'subtract' | 'set' })}
                    >
                      <option value="add">Añadir Stock</option>
                      <option value="subtract">Restar Stock</option>
                      <option value="set">Ajustar a Cantidad</option>
                    </select>
                  </div>

                  <div className="og-field" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Cantidad <span className="og-label-required">*</span></label>
                    <input
                      type="number"
                      className="og-form-control"
                      value={stockForm.quantity_change || ''}
                      onChange={(e) => setStockForm({ ...stockForm, quantity_change: e.target.value ? parseFloat(e.target.value) : 0 })}
                      min="0"
                      step="0.01"
                      required
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="og-modal-footer">
                  <button type="button" className="og-btn-ghost" onClick={() => {
                    setShowStockModal(false);
                    setSelectedProductId(null);
                  }} disabled={isSubmitting}>
                    Cancelar
                  </button>
                  <button type="submit" className="og-btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span>
                        <span className="og-spinner-sm"></span>
                        Actualizando...
                      </span>
                    ) : (
                      <span>
                        <i className="bi bi-check-lg"></i>
                        Actualizar Stock
                      </span>
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
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useHouseholdStore } from '@/lib/store/household.store';
import { useInventoryStore } from '@/lib/store/inventory.store';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Swal from 'sweetalert2';
import type { Category, CreateCategoryDto } from '@/types/inventory.types';

// Props para el modal de categoría
interface CategoryModalProps {
  isEdit: boolean;
  category?: Category | null;
  onClose: () => void;
  onSubmit: (data: CreateCategoryDto) => Promise<void>;
  isSubmitting: boolean;
}

// Componente Modal de Categoría (definido fuera para evitar re-creación)
function CategoryModal({ isEdit, category, onClose, onSubmit, isSubmitting }: CategoryModalProps) {
  const [formData, setFormData] = useState<CreateCategoryDto>({
    name: category?.name || '',
    description: category?.description || '',
  });

  // Sincronizar cuando cambia la categoría (para edición)
  useEffect(() => {
    setFormData({
      name: category?.name || '',
      description: category?.description || '',
    });
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="og-modal-backdrop" onClick={onClose}>
      <div className="og-modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="og-modal-header">
            <h3 className="og-modal-title">
              <i className={`bi ${isEdit ? 'bi-pencil' : 'bi-plus-circle'}`} style={{ marginRight: '8px' }}></i>
              {isEdit ? 'Editar Categoría' : 'Nueva Categoría'}
            </h3>
            <button type="button" className="og-modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="og-modal-body">
            <div className="og-field" style={{ marginBottom: '14px' }}>
              <label className="og-form-label">Nombre <span className="og-label-required">*</span></label>
              <input
                type="text"
                className="og-form-control"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
                placeholder="Ej: Lácteos, Bebidas, Limpieza"
              />
            </div>

            <div className="og-field" style={{ marginBottom: '14px' }}>
              <label className="og-form-label">Descripción</label>
              <textarea
                className="og-form-control og-form-textarea"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                maxLength={500}
                placeholder="Descripción opcional de la categoría"
                rows={3}
              />
            </div>
          </div>
          <div className="og-modal-footer">
            <button type="button" className="og-btn-ghost" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="og-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="og-spinner-sm"></span>
                  {isEdit ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg"></i>
                  {isEdit ? 'Actualizar Categoría' : 'Crear Categoría'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Página de Categorías - FinanzHome
 * Gestión de categorías de productos del hogar
 */
export default function CategoriesPage() {
  const { currentHousehold } = useHouseholdStore();
  const {
    categories = [],
    isLoading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    clearError,
  } = useInventoryStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Cargar datos al montar
  useEffect(() => {
    if (currentHousehold) {
      fetchCategories(currentHousehold.id);
    }
  }, [currentHousehold, fetchCategories]);

  // Handler para crear categoría
  const handleCreateSubmit = useCallback(async (data: CreateCategoryDto) => {
    if (!currentHousehold) return;

    setIsSubmitting(true);
    try {
      await createCategory(currentHousehold.id, data);
      setShowCreateModal(false);
      Swal.fire({
        icon: 'success',
        title: '¡Categoría creada!',
        text: 'La categoría se ha añadido exitosamente.',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo crear la categoría',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentHousehold, createCategory]);

  // Handler para editar categoría
  const handleEditCategory = useCallback((category: Category) => {
    setEditingCategory(category);
    setShowEditModal(true);
  }, []);

  // Handler para actualizar categoría
  const handleUpdateSubmit = useCallback(async (data: CreateCategoryDto) => {
    if (!currentHousehold || !editingCategory) return;

    setIsSubmitting(true);
    try {
      await updateCategory(currentHousehold.id, editingCategory.category_id, data);
      setShowEditModal(false);
      setEditingCategory(null);
      // Recargar categorías después de actualizar
      await fetchCategories(currentHousehold.id);
      Swal.fire({
        icon: 'success',
        title: '¡Categoría actualizada!',
        text: 'La categoría se ha actualizado exitosamente.',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo actualizar la categoría',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentHousehold, editingCategory, updateCategory, fetchCategories]);

  // Handler para eliminar categoría
  const handleDeleteCategory = useCallback(async (category: Category) => {
    if (!currentHousehold) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar categoría?',
      text: `¿Estás seguro de eliminar "${category.name}"? Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: 'var(--og-gold)',
      background: 'var(--og-surface-2)',
      color: 'var(--og-ivory)',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        await deleteCategory(currentHousehold.id, category.category_id);
        // Recargar categorías después de eliminar
        await fetchCategories(currentHousehold.id);
        Swal.fire({
          icon: 'success',
          title: '¡Categoría eliminada!',
          text: 'La categoría se ha eliminado exitosamente.',
          confirmButtonColor: 'var(--og-gold)',
          background: 'var(--og-surface-2)',
          color: 'var(--og-ivory)',
        });
      } catch (error: any) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'No se pudo eliminar la categoría',
          confirmButtonColor: 'var(--og-gold)',
          background: 'var(--og-surface-2)',
          color: 'var(--og-ivory)',
        });
      }
    }
  }, [currentHousehold, deleteCategory, fetchCategories]);

  // Cerrar modal de edición
  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingCategory(null);
  }, []);

  // Cerrar modal de creación
  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  return (
    <AuthenticatedLayout>
      <div className="og-page-wrapper">
        {/* Header */}
        <div className="og-page-header">
          <div className="og-page-header-left">
            <h1 className="og-page-title">
              <i className="bi bi-tags" style={{ marginRight: '8px', color: 'var(--og-gold)' }}></i>
              Categorías
            </h1>
            <p className="og-page-sub">Organiza tus productos por categorías</p>
          </div>
          <div className="og-page-actions">
            <button
              className="og-btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={!currentHousehold}
            >
              <i className="bi bi-plus-circle"></i>
              Nueva Categoría
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
            <span>Selecciona un hogar para ver las categorías</span>
          </div>
        )}

        {/* Categories Grid */}
        {currentHousehold && (
          <>
            {categories.length === 0 ? (
              <div className="og-card">
                <div className="og-empty-state">
                  <i className="bi bi-tags og-empty-icon"></i>
                  <h4 className="og-empty-title">No hay categorías</h4>
                  <p className="og-empty-text">Comienza creando categorías para organizar tus productos</p>
                  <button className="og-btn-primary" onClick={() => setShowCreateModal(true)}>
                    <i className="bi bi-plus-circle"></i>
                    Crear Primera Categoría
                  </button>
                </div>
              </div>
            ) : (
              <div className="og-grid og-grid-3">
                {categories.map((category) => (
                  <div key={category.category_id} className="og-card" style={{ cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ 
                          fontSize: '14px', 
                          fontWeight: 600, 
                          color: 'var(--og-ivory)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {category.name}
                        </h3>
                        {category.description && (
                          <p style={{ 
                            fontSize: '11px', 
                            color: 'var(--og-ivory-muted)',
                            margin: '4px 0 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {category.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                        <button
                          onClick={() => handleEditCategory(category)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--og-ivory-muted)',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--og-ivory-ghost)';
                            e.currentTarget.style.color = 'var(--og-ivory)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--og-ivory-muted)';
                          }}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--og-ivory-muted)',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(220, 53, 69, 0.2)';
                            e.currentTarget.style.color = '#dc3545';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--og-ivory-muted)';
                          }}
                          title="Eliminar"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create Category Modal */}
        {showCreateModal && (
          <CategoryModal
            isEdit={false}
            onClose={handleCloseCreateModal}
            onSubmit={handleCreateSubmit}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Edit Category Modal */}
        {showEditModal && (
          <CategoryModal
            isEdit={true}
            category={editingCategory}
            onClose={handleCloseEditModal}
            onSubmit={handleUpdateSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </AuthenticatedLayout>
  );
}
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useHouseholdStore } from '@/lib/store/household.store';
import { useSupermarketStore } from '@/lib/store/supermarket.store';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import type { CreateSupermarketDto, UpdateSupermarketDto, Supermarket } from '@/types/supermarket.types';
import Swal from 'sweetalert2';

// Props para el modal de supermercado
interface SupermarketModalProps {
  isEdit: boolean;
  supermarket?: Supermarket | null;
  onClose: () => void;
  onSubmit: (data: CreateSupermarketDto) => Promise<void>;
  isSubmitting: boolean;
}


// Componente Modal de Supermercado (definido fuera para evitar re-creación)
function SupermarketModal({ isEdit, supermarket, onClose, onSubmit, isSubmitting }: SupermarketModalProps) {
  const [formData, setFormData] = useState<CreateSupermarketDto>({
    name: supermarket?.name || '',
    address: (supermarket as any)?.address || '',
  });

  // Sincronizar cuando cambia el supermercado (para edición)
  useEffect(() => {
    setFormData({
      name: supermarket?.name || '',
      address: (supermarket as any)?.address || '',
    });
  }, [supermarket]);

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
              {isEdit ? 'Editar Supermercado' : 'Añadir Supermercado'}
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
                placeholder="Ej: Walmart, Auto Mercado, Más x Menos"
              />
            </div>

            <div className="og-field">
              <label className="og-form-label">Ubicación</label>
              <input
                type="text"
                className="og-form-control"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                maxLength={500}
                placeholder="Ej: Avenida Central, San José"
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
                  {isEdit ? 'Guardando...' : 'Creando...'}
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg"></i>
                  {isEdit ? 'Guardar Cambios' : 'Crear Supermercado'}
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
 * Página de Supermercados - FinanzHome
 * Gestión de supermercados del hogar
 */
export default function SupermarketsPage() {
  const { currentHousehold } = useHouseholdStore();
  const {
    supermarkets,
    isLoading,
    error,
    fetchSupermarkets,
    createSupermarket,
    updateSupermarket,
    deleteSupermarket,
    clearError,
  } = useSupermarketStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSupermarket, setEditingSupermarket] = useState<Supermarket | null>(null);

  // Cargar datos al montar
  useEffect(() => {
    if (currentHousehold) {
      fetchSupermarkets(currentHousehold.id);
    }
  }, [currentHousehold, fetchSupermarkets]);

  // Handler para crear supermercado
  const handleCreateSubmit = useCallback(async (data: CreateSupermarketDto) => {
    if (!currentHousehold) return;

    setIsSubmitting(true);
    try {
      await createSupermarket(currentHousehold.id, data);
      setShowCreateModal(false);
      Swal.fire({
        icon: 'success',
        title: '¡Supermercado creado!',
        text: 'El supermercado se ha registrado exitosamente.',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo crear el supermercado',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentHousehold, createSupermarket]);

  // Handler para editar supermercado
  const handleEditSupermarket = useCallback((supermarket: Supermarket) => {
    setEditingSupermarket(supermarket);
    setShowEditModal(true);
  }, []);

  // Handler para actualizar supermercado
  const handleUpdateSubmit = useCallback(async (data: CreateSupermarketDto) => {
    if (!currentHousehold || !editingSupermarket) return;

    setIsSubmitting(true);
    try {
      await updateSupermarket(currentHousehold.id, editingSupermarket.supermarket_id, data);
      setShowEditModal(false);
      setEditingSupermarket(null);
      Swal.fire({
        icon: 'success',
        title: '¡Supermercado actualizado!',
        text: 'Los cambios se han guardado exitosamente.',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo actualizar el supermercado',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentHousehold, editingSupermarket, updateSupermarket]);

  // Handler para eliminar supermercado
  const handleDelete = useCallback(async (supermarketId: number, supermarketName: string) => {
    if (!currentHousehold) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar supermercado?',
      text: `¿Estás seguro de que deseas eliminar "${supermarketName}"?`,
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: 'var(--og-gold)',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: 'var(--og-surface-2)',
      color: 'var(--og-ivory)',
    });

    if (!result.isConfirmed) return;

    try {
      await deleteSupermarket(currentHousehold.id, supermarketId);
      Swal.fire({
        icon: 'success',
        title: '¡Eliminado!',
        text: 'El supermercado ha sido eliminado.',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo eliminar el supermercado',
        confirmButtonColor: 'var(--og-gold)',
        background: 'var(--og-surface-2)',
        color: 'var(--og-ivory)',
      });
    }
  }, [currentHousehold, deleteSupermarket]);

  // Cerrar modal de edición
  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingSupermarket(null);
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
              <i className="bi bi-shop" style={{ marginRight: '8px', color: 'var(--og-gold)' }}></i>
              Supermercados
            </h1>
            <p className="og-page-sub">Gestiona los supermercados donde compras</p>
          </div>
          <div className="og-page-actions">
            <button
              className="og-btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={!currentHousehold}
            >
              <i className="bi bi-plus-circle"></i>
              Añadir Supermercado
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
            <span>Selecciona un hogar para ver los supermercados</span>
          </div>
        )}

        {/* Supermarkets Grid */}
        {currentHousehold && (
          <>
            {supermarkets.length === 0 ? (
              <div className="og-card">
                <div className="og-empty-state">
                  <i className="bi bi-shop og-empty-icon"></i>
                  <h4 className="og-empty-title">No hay supermercados</h4>
                  <p className="og-empty-text">Comienza añadiendo los supermercados donde sueles comprar</p>
                  <button className="og-btn-primary" onClick={() => setShowCreateModal(true)}>
                    <i className="bi bi-plus-circle"></i>
                    Añadir Primer Supermercado
                  </button>
                </div>
              </div>
            ) : (
              <div className="og-grid og-grid-3">
                {supermarkets.map((supermarket) => (
                  <div key={supermarket.supermarket_id} className="og-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 className="og-card-title" style={{ margin: 0 }}>{supermarket.name}</h3>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="og-btn-ghost og-btn-sm"
                          onClick={() => handleEditSupermarket(supermarket)}
                          title="Editar"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="og-btn-danger og-btn-sm"
                          onClick={() => handleDelete(supermarket.supermarket_id, supermarket.name)}
                          title="Eliminar"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                    {supermarket.address && (
                      <div style={{ fontSize: '11px', color: 'var(--og-ivory-muted)' }}>
                        <i className="bi bi-geo-alt"></i> {supermarket.address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create Supermarket Modal */}
        {showCreateModal && (
          <SupermarketModal
            isEdit={false}
            onClose={handleCloseCreateModal}
            onSubmit={handleCreateSubmit}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Edit Supermarket Modal */}
        {showEditModal && (
          <SupermarketModal
            isEdit={true}
            supermarket={editingSupermarket}
            onClose={handleCloseEditModal}
            onSubmit={handleUpdateSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </AuthenticatedLayout>
  );
}
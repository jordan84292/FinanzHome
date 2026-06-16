'use client';

import { useEffect, useState, useCallback } from 'react';
import { useHouseholdStore } from '@/lib/store/household.store';
import { usePendingListsStore } from '@/lib/store/pending-lists.store';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Swal from 'sweetalert2';
import apiClient from '@/lib/api/config';
import type { PendingShoppingList, HouseholdMemberForSplit } from '@/types/pending-list.types';

export default function PendingListsPage() {
  const { currentHousehold } = useHouseholdStore();
  const {
    pendingLists,
    isLoading,
    error,
    fetchPendingLists,
    fetchPendingListDetail,
    currentListParticipants,
    markParticipantPaid,
    clearError,
  } = usePendingListsStore();

  const [selectedList, setSelectedList] = useState<PendingShoppingList | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showDefaultConfigModal, setShowDefaultConfigModal] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMemberForSplit[]>([]);
  const [splitConfig, setSplitConfig] = useState<{ user_id: number; percentage: number }[]>([]);
  const [defaultSplitConfig, setDefaultSplitConfig] = useState<{ user_id: number; percentage: number }[]>([]);

  const fetchLists = useCallback(async () => {
    if (currentHousehold) {
      await fetchPendingLists(currentHousehold.id);
    }
  }, [currentHousehold, fetchPendingLists]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const openListDetail = async (list: PendingShoppingList) => {
    if (!currentHousehold) return;
    setSelectedList(list);
    try {
      await fetchPendingListDetail(currentHousehold.id, list.list_id);
      const membersResponse = await apiClient.get(`/households/${currentHousehold.id}/pending-lists/members`);
      if (membersResponse.data.success) {
        setHouseholdMembers(membersResponse.data.data.members || []);
        const equalPercentage = 100 / membersResponse.data.data.members.length;
        setSplitConfig(
          membersResponse.data.data.members.map((m: HouseholdMemberForSplit) => ({
            user_id: m.user_id,
            percentage: equalPercentage,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching list detail:', error);
    }
    setShowDetailModal(true);
  };

  const handleMarkPaid = async (participantId: number) => {
    if (!currentHousehold || !selectedList) return;
    try {
      await markParticipantPaid(currentHousehold.id, selectedList.list_id, participantId);
      Swal.fire({
        icon: 'success',
        title: '¡Marcado!',
        text: 'El pago ha sido registrado',
        confirmButtonColor: 'var(--og-primary)',
      });
      if (selectedList) {
        openListDetail(selectedList);
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo marcar como pagado',
        confirmButtonColor: 'var(--og-primary)',
      });
    }
  };

  const handleUpdateSplit = async () => {
    if (!selectedList || !currentHousehold) return;

    const totalPercentage = splitConfig.reduce((sum, s) => sum + s.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Los porcentajes deben sumar 100%',
        confirmButtonColor: 'var(--og-primary)',
      });
      return;
    }

    try {
      const response = await apiClient.put(
        `/households/${currentHousehold.id}/pending-lists/${selectedList.list_id}/split-config`,
        {
          split_type: 'custom',
          split_data: { members: splitConfig },
          members: splitConfig,
        }
      );
      if (response.data.success) {
        Swal.fire({
          icon: 'success',
          title: '¡Actualizado!',
          text: 'La distribución ha sido actualizada',
          confirmButtonColor: 'var(--og-primary)',
        });
        setShowSplitModal(false);
        if (selectedList) {
          openListDetail(selectedList);
        }
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo actualizar la distribución',
        confirmButtonColor: 'var(--og-primary)',
      });
    }
  };

  const getStatusBadge = (daysPending?: number) => {
    if (!daysPending) return <span className="og-badge og-badge-neutral">Pendiente</span>;
    if (daysPending <= 1) return <span className="og-badge og-badge-success">Hoy</span>;
    if (daysPending <= 3) return <span className="og-badge og-badge-warn">{daysPending} días</span>;
    return <span className="og-badge og-badge-danger">{daysPending} días</span>;
  };

  const openDefaultConfig = async () => {
    if (!currentHousehold) return;
    try {
      const membersResponse = await apiClient.get(`/households/${currentHousehold.id}/pending-lists/members`);
      const configResponse = await apiClient.get(`/households/${currentHousehold.id}/pending-lists/default-split-config`);

      if (membersResponse.data.success) {
        setHouseholdMembers(membersResponse.data.data.members || []);
        const equalPercentage = 100 / membersResponse.data.data.members.length;

        if (configResponse.data.success && configResponse.data.data?.split_data?.members) {
          setDefaultSplitConfig(configResponse.data.data.split_data.members);
        } else {
          setDefaultSplitConfig(
            membersResponse.data.data.members.map((m: HouseholdMemberForSplit) => ({
              user_id: m.user_id,
              percentage: equalPercentage,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error fetching default config:', error);
    }
    setShowDefaultConfigModal(true);
  };

  const handleSaveDefaultConfig = async () => {
    if (!currentHousehold) return;

    const totalPercentage = defaultSplitConfig.reduce((sum, s) => sum + s.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Los porcentajes deben sumar 100%',
        confirmButtonColor: 'var(--og-primary)',
      });
      return;
    }

    try {
      const response = await apiClient.put(
        `/households/${currentHousehold.id}/pending-lists/default-split-config`,
        {
          split_type: 'equal',
          split_data: { members: defaultSplitConfig },
          members: defaultSplitConfig,
        }
      );
      if (response.data.success) {
        Swal.fire({
          icon: 'success',
          title: '¡Configuración guardada!',
          text: 'La distribución por defecto ha sido actualizada',
          confirmButtonColor: 'var(--og-primary)',
        });
        setShowDefaultConfigModal(false);
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo guardar la configuración',
        confirmButtonColor: 'var(--og-primary)',
      });
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="og-page-wrapper">
        <div className="og-page-header">
          <div className="og-page-header-left">
            <h1 className="og-page-title">
              <i className="bi bi-hourglass-split" style={{ marginRight: '8px', color: 'var(--og-gold)' }}></i>
              Listas Pendientes
            </h1>
            <p className="og-page-sub">Listas de compras aguardando confirmación de pago</p>
          </div>
          <div className="og-page-actions">
            <button
              onClick={openDefaultConfig}
              disabled={isLoading || !currentHousehold}
              style={{
                marginRight: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                fontSize: '0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'linear-gradient(135deg, rgba(255,193,7,0.15) 0%, rgba(255,193,7,0.08) 100%)',
                color: '#ffc107',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,193,7,0.25) 0%, rgba(255,193,7,0.15) 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,193,7,0.15) 0%, rgba(255,193,7,0.08) 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <i className="bi bi-sliders" style={{ fontSize: '1rem' }}></i>
              Configurar Distribución
            </button>
            <button
              className="og-btn-primary"
              onClick={fetchLists}
              disabled={isLoading || !currentHousehold}
            >
              <i className="bi bi-arrow-clockwise"></i>
              Actualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="og-alert og-alert-danger og-alert-dismissible">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span>{error}</span>
            <button className="og-alert-close" onClick={clearError}>✕</button>
          </div>
        )}

        {!currentHousehold && (
          <div className="og-alert og-alert-warn">
            <i className="bi bi-exclamation-triangle"></i>
            <span>Selecciona un hogar para ver las listas pendientes</span>
          </div>
        )}

        {currentHousehold && (
          <>
            <div className="og-grid-3" style={{ marginBottom: '24px' }}>
              <div className="og-stat">
                <div className="og-stat-icon">
                  <i className="bi bi-clock-history" style={{ color: 'var(--og-gold)' }}></i>
                </div>
                <div className="og-stat-label">Listas Pendientes</div>
                <div className="og-stat-value">{pendingLists.length}</div>
              </div>
              <div className="og-stat">
                <div className="og-stat-icon">
                  <i className="bi bi-currency-dollar" style={{ color: 'var(--og-success)' }}></i>
                </div>
                <div className="og-stat-label">Total Pendiente</div>
                <div className="og-stat-value" style={{ color: 'var(--og-gold)' }}>
                  ${pendingLists.reduce((sum, l) => sum + l.total_amount, 0).toFixed(2)}
                </div>
              </div>
              <div className="og-stat">
                <div className="og-stat-icon">
                  <i className="bi bi-exclamation-triangle" style={{ color: 'var(--og-danger)' }}></i>
                </div>
                <div className="og-stat-label">Más Antigua</div>
                <div className="og-stat-value" style={{ fontSize: '0.9rem' }}>
                  {pendingLists.length > 0
                    ? `${Math.max(...pendingLists.map(l => l.days_pending || 0))} días`
                    : '0 días'}
                </div>
              </div>
            </div>

            <div className="og-card">
              <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bi bi-list-check"></i>
                Listas en Espera de Pago
              </h3>
              {pendingLists.length === 0 ? (
                <div className="og-empty-state">
                  <i className="bi bi-check-circle" style={{ fontSize: '3rem', opacity: 0.3, color: 'var(--og-success)' }}></i>
                  <p style={{ margin: '10px 0 0', opacity: 0.6 }}>No hay listas pendientes de pago</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendingLists.map((list) => (
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
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => openListDetail(list)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.borderColor = 'rgba(255,193,7,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="bi bi-cart3"></i>
                          Lista #{list.list_id}
                          {getStatusBadge(list.days_pending)}
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '4px' }}>
                          {list.supermarket_name} • Creada por {list.created_by_name} {list.created_by_lastname}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '2px' }}>
                          {new Date(list.completed_at || list.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--og-gold)' }}>
                            ${Number(list.total_amount).toFixed(2)}
                          </div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                            {list.total_items || 0} productos
                          </div>
                        </div>
                        <i className="bi bi-chevron-right" style={{ opacity: 0.4 }}></i>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {showDetailModal && selectedList && (
          <div className="og-modal-backdrop">
            <div className="og-modal" style={{ maxWidth: '800px' }}>
              <div className="og-modal-header">
                <h3 className="og-modal-title">
                  <i className="bi bi-clock-history" style={{ marginRight: '8px' }}></i>
                  Detalle de Lista #{selectedList.list_id}
                </h3>
                <button type="button" className="og-modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
              </div>
              <div className="og-modal-body">
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '24px',
                }}>
                  <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Total</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--og-gold)' }}>
                      ${Number(selectedList.total_amount).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>Supermercado</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                      {selectedList.supermarket_name}
                    </div>
                  </div>
                </div>

                <h4 style={{ marginBottom: '12px' }}>
                  <i className="bi bi-people" style={{ marginRight: '8px' }}></i>
                  Reparto entre Miembros
                </h4>

                {currentListParticipants.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', opacity: 0.6 }}>
                    Cargando participantes...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {currentListParticipants.map((p) => (
                      <div
                        key={p.participant_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          background: p.is_paid
                            ? 'rgba(74, 222, 128, 0.1)'
                            : 'rgba(255,255,255,0.03)',
                          borderRadius: '10px',
                          border: `1px solid ${p.is_paid ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'var(--og-gold-dim)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            color: 'var(--og-gold)',
                          }}>
                            {p.first_name?.[0]}{p.last_name?.[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600' }}>
                              {p.first_name} {p.last_name}
                            </div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                              {p.percentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 'bold', color: p.is_paid ? 'var(--og-success)' : 'var(--og-gold)' }}>
                              ${Number(p.amount_owed).toFixed(2)}
                            </div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                              {p.is_paid ? 'Pagado' : 'Pendiente'}
                            </div>
                          </div>
                          {!p.is_paid && (
                            <button
                              className="og-btn-primary og-btn-sm"
                              onClick={() => handleMarkPaid(p.participant_id)}
                            >
                              <i className="bi bi-check-lg"></i>
                            </button>
                          )}
                          {p.is_paid && (
                            <i className="bi bi-check-circle-fill" style={{ color: 'var(--og-success)', fontSize: '1.3rem' }}></i>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    className="og-btn-secondary"
                    style={{
                marginRight: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                fontSize: '0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'linear-gradient(135deg, rgba(255,193,7,0.15) 0%, rgba(255,193,7,0.08) 100%)',
                color: '#ffc107',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
                    onClick={() => {
                      setShowDetailModal(false);
                      setShowSplitModal(true);
                    }}
                  >
                    <i className="bi bi-sliders"></i>
                    Configurar Distribución
                  </button>
                </div>
              </div>
              <div className="og-modal-footer">
                <button className="og-btn-ghost" onClick={() => setShowDetailModal(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {showSplitModal && selectedList && (
          <div className="og-modal-backdrop">
            <div className="og-modal" style={{ maxWidth: '600px' }}>
              <div className="og-modal-header">
                <h3 className="og-modal-title">
                  <i className="bi bi-sliders" style={{ marginRight: '8px' }}></i>
                  Configurar Distribución
                </h3>
                <button type="button" className="og-modal-close" onClick={() => setShowSplitModal(false)}>✕</button>
              </div>
              <div className="og-modal-body">
                <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255,193,7,0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
                  <i className="bi bi-info-circle" style={{ marginRight: '8px' }}></i>
                  Los porcentajes deben sumar 100%. La distribución se aplica a los miembros activos del hogar.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {householdMembers.map((member, index) => (
                    <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600' }}>
                          {member.first_name} {member.last_name}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{member.email}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          className="og-form-control"
                          style={{ width: '100px', textAlign: 'right' }}
                          value={splitConfig[index]?.percentage || 0}
                          onChange={(e) => {
                            const newConfig = [...splitConfig];
                            newConfig[index] = {
                              ...newConfig[index],
                              percentage: parseFloat(e.target.value) || 0,
                            };
                            setSplitConfig(newConfig);
                          }}
                          min="0"
                          max="100"
                          step="0.1"
                        />
                        <span style={{ opacity: 0.6 }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: splitConfig.reduce((s, c) => s + c.percentage, 0) === 100
                    ? 'rgba(74, 222, 128, 0.1)'
                    : 'rgba(220, 53, 69, 0.1)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontWeight: '600',
                }}>
                  Total: {splitConfig.reduce((s, c) => s + c.percentage, 0).toFixed(1)}%
                  {splitConfig.reduce((s, c) => s + c.percentage, 0) !== 100 && (
                    <span style={{ color: 'var(--og-danger)', marginLeft: '8px' }}>
                      (debe ser 100%)
                    </span>
                  )}
                </div>
              </div>
              <div className="og-modal-footer">
                <button className="og-btn-ghost" onClick={() => setShowSplitModal(false)}>
                  Cancelar
                </button>
                <button
                  className="og-btn-primary"
                  onClick={handleUpdateSplit}
                  disabled={splitConfig.reduce((s, c) => s + c.percentage, 0) !== 100}
                >
                  <i className="bi bi-check-lg"></i>
                  Guardar Distribución
                </button>
              </div>
            </div>
          </div>
        )}

        {showDefaultConfigModal && (
          <div className="og-modal-backdrop">
            <div className="og-modal" style={{ maxWidth: '600px' }}>
              <div className="og-modal-header">
                <h3 className="og-modal-title">
                  <i className="bi bi-sliders" style={{ marginRight: '8px' }}></i>
                  Configurar Distribución por Defecto
                </h3>
                <button type="button" className="og-modal-close" onClick={() => setShowDefaultConfigModal(false)}>✕</button>
              </div>
              <div className="og-modal-body">
                <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255,193,7,0.1)', borderRadius: '8px', fontSize: '0.9rem' }}>
                  <i className="bi bi-info-circle" style={{ marginRight: '8px' }}></i>
                  Esta configuración se aplicará por defecto a las nuevas listas de compra. Los porcentajes deben sumar 100%.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {householdMembers.map((member, index) => (
                    <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600' }}>
                          {member.first_name} {member.last_name}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{member.email}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          className="og-form-control"
                          style={{ width: '100px', textAlign: 'right' }}
                          value={defaultSplitConfig[index]?.percentage || 0}
                          onChange={(e) => {
                            const newConfig = [...defaultSplitConfig];
                            newConfig[index] = {
                              ...newConfig[index],
                              percentage: parseFloat(e.target.value) || 0,
                            };
                            setDefaultSplitConfig(newConfig);
                          }}
                          min="0"
                          max="100"
                          step="0.1"
                        />
                        <span style={{ opacity: 0.6 }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: defaultSplitConfig.reduce((s, c) => s + c.percentage, 0) === 100
                    ? 'rgba(74, 222, 128, 0.1)'
                    : 'rgba(220, 53, 69, 0.1)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontWeight: '600',
                }}>
                  Total: {defaultSplitConfig.reduce((s, c) => s + c.percentage, 0).toFixed(1)}%
                  {defaultSplitConfig.reduce((s, c) => s + c.percentage, 0) !== 100 && (
                    <span style={{ color: 'var(--og-danger)', marginLeft: '8px' }}>
                      (debe ser 100%)
                    </span>
                  )}
                </div>
              </div>
              <div className="og-modal-footer">
                <button className="og-btn-ghost" onClick={() => setShowDefaultConfigModal(false)}>
                  Cancelar
                </button>
                <button
                  className="og-btn-primary"
                  onClick={handleSaveDefaultConfig}
                  disabled={defaultSplitConfig.reduce((s, c) => s + c.percentage, 0) !== 100}
                >
                  <i className="bi bi-check-lg"></i>
                  Guardar Configuración
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
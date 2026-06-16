'use client';

import { useEffect, useState } from 'react';
import { useHouseholdStore } from '@/lib/store/household.store';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import type { CreateHouseholdDto, UpdateHouseholdDto, InviteMemberDto, HouseholdMember, AvailableUser } from '@/types/household.types';
import { swal } from '@/lib/utils/swal';

export default function HouseholdsPage() {
  const {
    households,
    currentHousehold,
    members,
    availableUsers,
    isLoading,
    error,
    fetchHouseholds,
    createHousehold,
    updateHousehold,
    deleteHousehold,
    setCurrentHousehold,
    clearError,
    fetchMembers,
    fetchAvailableUsers,
    inviteMember,
    removeMember,
    updateMemberRole,
  } = useHouseholdStore();

  // Estados para modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Estados para formularios
  const [createForm, setCreateForm] = useState<CreateHouseholdDto>({
    name: '',
    description: '',
    currency: 'CRC',
  });

  const [editForm, setEditForm] = useState<UpdateHouseholdDto>({
    name: '',
    description: '',
    currency: 'CRC',
  });

  const [inviteForm, setInviteForm] = useState<InviteMemberDto>({
    email: '',
    role: 'member',
  });

  // Usuario actual (del auth store)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    fetchHouseholds();
    // Obtener userId del localStorage (del auth store)
    const userData = localStorage.getItem('finanzhome-auth');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        setCurrentUserId(parsed.state?.user?.id || parsed.user?.id || null);
      } catch {
        // Ignorar errores de parsing
      }
    }
  }, [fetchHouseholds]);

  // Cargar miembros cuando se selecciona un hogar
  useEffect(() => {
    if (currentHousehold) {
      fetchMembers(currentHousehold.id);
      fetchAvailableUsers(currentHousehold.id);
    }
  }, [currentHousehold, fetchMembers, fetchAvailableUsers]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createHousehold(createForm);
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', currency: 'CRC' });
      swal.success('Hogar creado exitosamente');
    } catch (err: any) {
      swal.error(err.message || 'Error al crear hogar');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentHousehold) return;
    try {
      await updateHousehold(currentHousehold.id, editForm);
      setShowEditModal(false);
      swal.success('Hogar actualizado exitosamente');
    } catch (err: any) {
      swal.error(err.message || 'Error al actualizar hogar');
    }
  };

  const handleDeleteHousehold = async (householdId: number, householdName: string) => {
    const confirmed = await swal.confirmDanger(
      `¿Estás seguro de eliminar el hogar "${householdName}"? Esta acción no se puede deshacer.`
    );
    if (confirmed) {
      try {
        await deleteHousehold(householdId);
        setShowMembersPanel(false);
        swal.success('Hogar eliminado exitosamente');
      } catch (err: any) {
        swal.error(err.message || 'Error al eliminar hogar');
      }
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentHousehold) return;
    try {
      await inviteMember(currentHousehold.id, inviteForm);
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'member' });
      swal.success('Invitación enviada exitosamente');
    } catch (err: any) {
      const errorMsg = err.message || '';
      if (errorMsg.includes('ya existe una invitación pendiente') || errorMsg.includes('pending')) {
        swal.warning('Este usuario ya tiene una invitación pendiente');
      } else if (errorMsg.includes('ya es miembro') || errorMsg.includes('member')) {
        swal.warning('Este usuario ya es miembro del hogar');
      } else {
        swal.error(err.message || 'Error al enviar invitación');
      }
    }
  };

  const handleRemoveMember = async (member: HouseholdMember) => {
    if (!currentHousehold) return;
    const confirmed = await swal.confirmDanger(
      `¿Estás seguro de eliminar a ${member.user?.firstName} ${member.user?.lastName} del hogar?`
    );
    if (confirmed) {
      try {
        await removeMember(currentHousehold.id, member.userId);
        swal.success('Miembro eliminado exitosamente');
      } catch (err: any) {
        swal.error(err.message || 'Error al eliminar miembro');
      }
    }
  };

  const handleChangeRole = async (member: HouseholdMember, newRole: 'admin' | 'member') => {
    if (!currentHousehold) return;
    try {
      await updateMemberRole(currentHousehold.id, member.userId, { role: newRole });
      swal.success(`Rol actualizado a ${newRole === 'admin' ? 'Administrador' : 'Miembro'}`);
    } catch (err: any) {
      swal.error(err.message || 'Error al actualizar rol');
    }
  };

  const openEditModal = (household: typeof currentHousehold) => {
    if (!household) return;
    setEditForm({
      name: household.name,
      description: household.description || '',
      currency: household.currency,
    });
    setShowEditModal(true);
  };

  const openMembersPanel = (household: typeof currentHousehold) => {
    if (!household) return;
    setCurrentHousehold(household);
    setShowMembersPanel(true);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <span className="og-badge og-badge-gold">Propietario</span>;
      case 'admin':
        return <span className="og-badge og-badge-blue">Administrador</span>;
      case 'member':
        return <span className="og-badge og-badge-green">Miembro</span>;
      default:
        return <span className="og-badge">{role}</span>;
    }
  };

  const canManageHousehold = currentHousehold?.myRole === 'owner' || currentHousehold?.myRole === 'admin';
  const isOwner = currentHousehold?.myRole === 'owner';

  return (
    <AuthenticatedLayout>
      <div className="og-page-wrapper">
        {/* Header */}
        <div className="og-page-header">
          <div className="og-page-header-left">
            <h1 className="og-page-title">
              <i className="bi bi-house-heart" style={{ marginRight: '8px', color: 'var(--og-gold)' }}></i>
              Hogares
            </h1>
            <p className="og-page-sub">Gestiona tus hogares y miembros</p>
          </div>
          <div className="og-page-actions">
            <button
              className="og-btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={isLoading}
            >
              <i className="bi bi-plus-circle"></i>
              Crear Hogar
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

        {/* Households List */}
        <div className="og-grid-2">
          {households.length === 0 ? (
            <div className="og-card" style={{ gridColumn: '1 / -1' }}>
              <div className="og-empty-state">
                <i className="bi bi-house-x og-empty-icon"></i>
                <h4 className="og-empty-title">No hay hogares</h4>
                <p className="og-empty-text">Crea tu primer hogar para comenzar</p>
                <button className="og-btn-primary" onClick={() => setShowCreateModal(true)}>
                  <i className="bi bi-plus-circle"></i>
                  Crear Primer Hogar
                </button>
              </div>
            </div>
          ) : (
            households.filter(h => h && h.id).map((household) => (
              <div
                key={household.id}
                className={`og-card ${currentHousehold?.id === household.id ? 'og-card--active' : ''}`}
              >
                <div className="og-card-body">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        background: 'var(--og-gold-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        color: 'var(--og-gold)',
                        flexShrink: 0,
                      }}
                    >
                      <i className="bi bi-house-heart-fill"></i>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                          {household.name}
                        </h3>
                        {currentHousehold?.id === household.id && (
                          <span className="og-badge og-badge-green">
                            <i className="bi bi-check-circle" style={{ marginRight: '4px' }}></i>
                            Activo
                          </span>
                        )}
                      </div>
                      {household.description && (
                        <p style={{ fontSize: '13px', color: 'var(--og-ivory-dim)', margin: '4px 0' }}>
                          <i className="bi bi-info-circle" style={{ marginRight: '4px' }}></i>
                          {household.description}
                        </p>
                      )}
                      <p style={{ fontSize: '12px', color: 'var(--og-ivory-dim)', margin: '4px 0 0' }}>
                        <i className="bi bi-people" style={{ marginRight: '4px' }}></i>
                        {household.memberCount || 1} miembro(s) · {household.currency}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => openMembersPanel(household)}
                      title="Ver miembros"
                      style={{ 
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
                      <i className="bi bi-people-fill" style={{ fontSize: '1rem' }}></i>
                      Miembros
                    </button>
                    {(household.myRole === 'owner' || household.myRole === 'admin') && (
                      <button
                        className="og-btn-ghost"
                        onClick={() => openEditModal(household)}
                        title="Editar hogar"
                      >
                        <i className="bi bi-pencil"></i>
                        Editar
                      </button>
                    )}
                    {household.myRole === 'owner' && (
                      <button
                        className="og-btn-ghost"
                        onClick={() => handleDeleteHousehold(household.id, household.name)}
                        title="Eliminar hogar"
                        style={{ color: '#dc3545' }}
                      >
                        <i className="bi bi-trash"></i>
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CREATE HOUSEHOLD MODAL */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {showCreateModal && (
          <div className="og-modal-backdrop" onClick={() => setShowCreateModal(false)}>
            <div className="og-modal" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleCreateSubmit}>
                <div className="og-modal-header">
                  <h3 className="og-modal-title">
                    <i className="bi bi-house-plus" style={{ marginRight: '8px' }}></i>
                    Crear Hogar
                  </h3>
                  <button type="button" className="og-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
                </div>
                <div className="og-modal-body">
                  <div className="og-field" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Nombre <span className="og-label-required">*</span></label>
                    <input
                      type="text"
                      className="og-form-control"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      required
                      maxLength={100}
                      placeholder="Ej: Casa Principal"
                    />
                  </div>

                  <div className="og-field" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Descripción</label>
                    <textarea
                      className="og-form-control og-form-textarea"
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      maxLength={200}
                      placeholder="Descripción del hogar"
                      rows={2}
                    />
                  </div>

                  <div className="og-field">
                    <label className="og-form-label">Moneda</label>
                    <select
                      className="og-form-control"
                      value={createForm.currency}
                      onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                    >
                      <option value="CRC">CRC - Colón Costarricense</option>
                      <option value="USD">USD - Dólar Estadounidense</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>
                </div>
                <div className="og-modal-footer">
                  <button type="button" className="og-btn-ghost" onClick={() => setShowCreateModal(false)} disabled={isLoading}>
                    Cancelar
                  </button>
                  <button type="submit" className="og-btn-primary" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <span className="og-spinner-sm"></span>
                        Creando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg"></i>
                        Crear Hogar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* EDIT HOUSEHOLD MODAL */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {showEditModal && currentHousehold && (
          <div className="og-modal-backdrop" onClick={() => setShowEditModal(false)}>
            <div className="og-modal" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleEditSubmit}>
                <div className="og-modal-header">
                  <h3 className="og-modal-title">
                    <i className="bi bi-pencil-square" style={{ marginRight: '8px' }}></i>
                    Editar Hogar
                  </h3>
                  <button type="button" className="og-modal-close" onClick={() => setShowEditModal(false)}>✕</button>
                </div>
                <div className="og-modal-body">
                  <div className="og-field" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Nombre <span className="og-label-required">*</span></label>
                    <input
                      type="text"
                      className="og-form-control"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      required
                      maxLength={100}
                      placeholder="Nombre del hogar"
                    />
                  </div>

                  <div className="og-field" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Descripción</label>
                    <textarea
                      className="og-form-control og-form-textarea"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      maxLength={200}
                      placeholder="Descripción del hogar"
                      rows={2}
                    />
                  </div>

                  <div className="og-field">
                    <label className="og-form-label">Moneda</label>
                    <select
                      className="og-form-control"
                      value={editForm.currency}
                      onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                    >
                      <option value="CRC">CRC - Colón Costarricense</option>
                      <option value="USD">USD - Dólar Estadounidense</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>
                </div>
                <div className="og-modal-footer">
                  <button type="button" className="og-btn-ghost" onClick={() => setShowEditModal(false)} disabled={isLoading}>
                    Cancelar
                  </button>
                  <button type="submit" className="og-btn-primary" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <span className="og-spinner-sm"></span>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg"></i>
                        Guardar Cambios
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MEMBERS PANEL */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {showMembersPanel && currentHousehold && (
          <div className="og-modal-backdrop" onClick={() => setShowMembersPanel(false)}>
            <div className="og-modal og-modal--lg" onClick={(e) => e.stopPropagation()}>
              <div className="og-modal-header">
                <h3 className="og-modal-title">
                  <i className="bi bi-people-fill" style={{ marginRight: '8px' }}></i>
                  Miembros de {currentHousehold.name}
                </h3>
                <button type="button" className="og-modal-close" onClick={() => setShowMembersPanel(false)}>✕</button>
              </div>
              <div className="og-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <span className="og-spinner"></span>
                    <p style={{ marginTop: '16px', color: 'var(--og-ivory-dim)' }}>Cargando miembros...</p>
                  </div>
                ) : members.length === 0 ? (
                  <div className="og-empty-state">
                    <i className="bi bi-person-x og-empty-icon"></i>
                    <h4 className="og-empty-title">Sin miembros</h4>
                    <p className="og-empty-text">Invita miembros para comenzar</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {members.map((member) => {
                      const isCurrentUser = member.userId === currentUserId;
                      const canRemove = canManageHousehold && !isCurrentUser && member.role !== 'owner';
                      const canChangeRole = isOwner && member.role !== 'owner';

                      return (
                        <div
                          key={member.id || member.userId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            background: 'var(--og-obsidian)',
                            borderRadius: '8px',
                            border: isCurrentUser ? '1px solid var(--og-gold)' : '1px solid transparent',
                          }}
                        >
                          {/* Avatar */}
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              background: 'var(--og-gold-dim)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px',
                              color: 'var(--og-gold)',
                              flexShrink: 0,
                            }}
                          >
                            <i className="bi bi-person-fill"></i>
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, color: 'var(--og-ivory)' }}>
                                {member.user?.firstName} {member.user?.lastName}
                              </span>
                              {isCurrentUser && (
                                <span className="og-badge og-badge-gold">Tú</span>
                              )}
                              {getRoleBadge(member.role)}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--og-ivory-dim)', marginTop: '2px' }}>
                              {member.user?.email}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--og-ivory-dim)', marginTop: '2px' }}>
                              <i className="bi bi-calendar3" style={{ marginRight: '4px' }}></i>
                              Joined {new Date(member.joinedAt).toLocaleDateString()}
                            </div>
                          </div>

                          {/* Actions */}
                          {canManageHousehold && (
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                              {/* Change Role */}
                              {canChangeRole && (
                                <select
                                  className="og-form-control"
                                  style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
                                  value={member.role}
                                  onChange={(e) => handleChangeRole(member, e.target.value as 'admin' | 'member')}
                                >
                                  <option value="admin">Admin</option>
                                  <option value="member">Miembro</option>
                                </select>
                              )}

                              {/* Remove */}
                              {canRemove && (
                                <button
                                  className="og-btn-ghost"
                                  onClick={() => handleRemoveMember(member)}
                                  title="Eliminar miembro"
                                  style={{ color: '#dc3545', padding: '6px 12px' }}
                                >
                                  <i className="bi bi-person-dash"></i>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="og-modal-footer">
                <button type="button" className="og-btn-ghost" onClick={() => setShowMembersPanel(false)}>
                  Cerrar
                </button>
                {canManageHousehold && (
                  <button
                    className="og-btn-primary"
                    onClick={() => {
                      setShowMembersPanel(false);
                      setShowInviteModal(true);
                    }}
                  >
                    <i className="bi bi-person-plus"></i>
                    Invitar Miembro
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* INVITE MEMBER MODAL */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {showInviteModal && currentHousehold && (
          <div className="og-modal-backdrop" onClick={() => setShowInviteModal(false)}>
            <div className="og-modal" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleInviteMember}>
                <div className="og-modal-header">
                  <h3 className="og-modal-title">
                    <i className="bi bi-person-plus" style={{ marginRight: '8px' }}></i>
                    Invitar Miembro
                  </h3>
                  <button type="button" className="og-modal-close" onClick={() => setShowInviteModal(false)}>✕</button>
                </div>
                <div className="og-modal-body">
                  <p style={{ fontSize: '14px', color: 'var(--og-ivory-dim)', marginBottom: '16px' }}>
                    Selecciona un usuario para invitar a <strong>{currentHousehold.name}</strong>
                  </p>

                  <div className="og-field" style={{ marginBottom: '14px' }}>
                    <label className="og-form-label">Usuario <span className="og-label-required">*</span></label>
                    <select
                      className="og-form-control"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      required
                    >
                      <option value="">-- Seleccionar usuario --</option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.email}>
                          {user.email} - {user.firstName} {user.lastName}
                        </option>
                      ))}
                    </select>
                    {availableUsers.length === 0 && (
                      <small style={{ color: 'var(--og-ivory-dim)', fontSize: '12px' }}>
                        <i className="bi bi-info-circle" style={{ marginRight: '4px' }}></i>
                        No hay usuarios disponibles para invitar
                      </small>
                    )}
                  </div>

                  <div className="og-field">
                    <label className="og-form-label">Rol <span className="og-label-required">*</span></label>
                    <select
                      className="og-form-control"
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'admin' | 'member' })}
                      required
                    >
                      <option value="member">Miembro</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <small style={{ color: 'var(--og-ivory-dim)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      <i className="bi bi-info-circle" style={{ marginRight: '4px' }}></i>
                      Los administradores pueden gestionar miembros y gastos compartidos
                    </small>
                  </div>
                </div>
                <div className="og-modal-footer">
                  <button type="button" className="og-btn-ghost" onClick={() => setShowInviteModal(false)} disabled={isLoading}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="og-btn-primary"
                    disabled={isLoading || !inviteForm.email}
                  >
                    {isLoading ? (
                      <>
                        <span className="og-spinner-sm"></span>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send"></i>
                        Enviar Invitación
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
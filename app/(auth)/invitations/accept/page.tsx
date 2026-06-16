'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { householdService } from '@/lib/api/household.service';
import type { PendingInvitation } from '@/types/PendingInvitation.type';

// ─── Inner component ─────────────────────────────────────────────────────────

function AcceptInvitationContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

  const invitationId = Number(searchParams.get('id'));

  const [invitation, setInvitation]   = useState<PendingInvitation | null>(null);
  const [pageError, setPageError]     = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting]   = useState<'accept' | 'reject' | null>(null);
  const [done, setDone]               = useState<{ success: boolean; message: string } | null>(null);

  // ── 1. Redirigir a login si no está autenticado ──────────────────────────
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      // Guardamos la URL completa como redirect para volver después del login
      const currentPath = `/invitations/accept?id=${invitationId}`;
      router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [isAuthenticated, user, authLoading, router, invitationId]);

  // ── 2. Cargar los datos de la invitación ─────────────────────────────────
  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;

    if (!invitationId || isNaN(invitationId)) {
      setPageError('El enlace de invitación no es válido.');
      setLoadingData(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        setLoadingData(true);
        const response = await householdService.getInvitation(invitationId);
        if (response.success && response.data) {
          setInvitation(response.data.invitation);
        } else {
          setPageError('La invitación no fue encontrada o ya fue respondida.');
        }
      } catch (err: any) {
        setPageError(err.message || 'Error al cargar la invitación.');
      } finally {
        setLoadingData(false);
      }
    };

    fetchInvitation();
  }, [invitationId, isAuthenticated, user, authLoading]);

  // ── 3. Aceptar invitación ────────────────────────────────────────────────
  const handleAccept = async () => {
    if (!invitationId) return;
    try {
      setSubmitting('accept');
      const response = await householdService.acceptInvitation(invitationId);
      setDone({ success: true, message: response.message || '¡Te has unido al hogar exitosamente!' });
    } catch (err: any) {
      setDone({ success: false, message: err.message || 'Error al aceptar la invitación.' });
    } finally {
      setSubmitting(null);
    }
  };

  // ── 4. Rechazar invitación ───────────────────────────────────────────────
  const handleReject = async () => {
    if (!invitationId) return;
    try {
      setSubmitting('reject');
      const response = await householdService.rejectInvitation(invitationId);
      setDone({ success: true, message: response.message || 'Invitación rechazada.' });
    } catch (err: any) {
      setDone({ success: false, message: err.message || 'Error al rechazar la invitación.' });
    } finally {
      setSubmitting(null);
    }
  };

  const goToDashboard = () => router.push('/dashboard');

  // ── Pantallas de estado ──────────────────────────────────────────────────

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="og-spinner-wrap" role="status">
        <div className="og-spinner" aria-hidden="true" />
        <span className="og-spinner-text">Verificando sesión…</span>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="og-spinner-wrap" role="status">
        <div className="og-spinner" aria-hidden="true" />
        <span className="og-spinner-text">Cargando invitación…</span>
      </div>
    );
  }

  // ── Resultado final (aceptó o rechazó) ───────────────────────────────────
  if (done) {
    return (
      <>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: done.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <i
              className={`bi ${done.success ? 'bi-check-lg' : 'bi-x-lg'}`}
              style={{
                fontSize: '24px',
                color: done.success ? 'var(--og-success, #22c55e)' : 'var(--og-danger, #ef4444)',
              }}
            />
          </div>
          <div style={{
            fontFamily: 'var(--og-font-display)',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--og-ivory)',
            marginBottom: '8px',
          }}>
            {done.success ? 'Listo' : 'Algo salió mal'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--og-ivory-muted)' }}>
            {done.message}
          </div>
        </div>

        <button
          onClick={goToDashboard}
          className="og-btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
        >
          <i className="bi bi-house"></i>
          Ir al Dashboard
        </button>
      </>
    );
  }

  // ── Error de carga ───────────────────────────────────────────────────────
  if (pageError || !invitation) {
    return (
      <>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <i className="bi bi-envelope-x" style={{ fontSize: '24px', color: 'var(--og-danger, #ef4444)' }} />
          </div>
          <div style={{
            fontFamily: 'var(--og-font-display)',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--og-ivory)',
            marginBottom: '8px',
          }}>
            Invitación no disponible
          </div>
          <div style={{ fontSize: '13px', color: 'var(--og-ivory-muted)' }}>
            {pageError || 'Esta invitación no existe, ya fue respondida o expiró.'}
          </div>
        </div>

        <button
          onClick={goToDashboard}
          className="og-btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
        >
          <i className="bi bi-house"></i>
          Ir al Dashboard
        </button>
      </>
    );
  }

  // ── Vista principal: detalles + acciones ─────────────────────────────────
  const expiresDate = new Date(invitation.expires_at).toLocaleDateString('es-CR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const roleLabel = invitation.proposed_role === 'admin' ? 'Administrador' : 'Miembro';

  return (
    <>
      {/* Encabezado */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          fontFamily: 'var(--og-font-display)',
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--og-ivory)',
          letterSpacing: '-.2px',
          marginBottom: '4px',
        }}>
          Invitación a un Hogar
        </div>
        <div style={{ fontSize: '11px', color: 'var(--og-ivory-muted)' }}>
          Revisa los detalles antes de responder
        </div>
      </div>

      {/* Card de detalles */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(212,175,82,0.15)',
        borderRadius: '10px',
        padding: '18px',
        marginBottom: '20px',
      }}>
        {/* Nombre del hogar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px',
            background: 'rgba(212,175,82,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i className="bi bi-house-heart" style={{ fontSize: '18px', color: 'var(--og-gold)' }} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--og-ivory)' }}>
              {invitation.household_name}
            </div>
            {invitation.household_description && (
              <div style={{ fontSize: '11px', color: 'var(--og-ivory-muted)', marginTop: '2px' }}>
                {invitation.household_description}
              </div>
            )}
          </div>
        </div>

        <div className="og-divider" style={{ margin: '0 0 14px' }} />

        {/* Detalles de la invitación */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--og-ivory-muted)' }}>
              <i className="bi bi-person" style={{ marginRight: '6px' }} />
              Invitado por
            </span>
            <span style={{ fontSize: '12px', color: 'var(--og-ivory)', fontWeight: 500 }}>
              {invitation.inviter_name}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--og-ivory-muted)' }}>
              <i className="bi bi-shield" style={{ marginRight: '6px' }} />
              Rol asignado
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600,
              color: invitation.proposed_role === 'admin' ? 'var(--og-gold)' : 'var(--og-ivory)',
              background: invitation.proposed_role === 'admin'
                ? 'rgba(212,175,82,0.12)'
                : 'rgba(255,255,255,0.07)',
              padding: '2px 8px', borderRadius: '4px',
            }}>
              {roleLabel}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--og-ivory-muted)' }}>
              <i className="bi bi-calendar-x" style={{ marginRight: '6px' }} />
              Expira
            </span>
            <span style={{ fontSize: '12px', color: 'var(--og-ivory)' }}>
              {expiresDate}
            </span>
          </div>
        </div>
      </div>

      {/* Saludo al usuario */}
      <div style={{
        fontSize: '12px',
        color: 'var(--og-ivory-muted)',
        marginBottom: '20px',
        textAlign: 'center',
      }}>
        Hola <strong style={{ color: 'var(--og-ivory)' }}>{user?.firstName}</strong>,
        ¿deseas unirte a este hogar?
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleReject}
          disabled={!!submitting}
          className="og-btn-secondary"
          style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
        >
          {submitting === 'reject' ? (
            <><div className="og-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Rechazando...</>
          ) : (
            <><i className="bi bi-x-circle" /> Rechazar</>
          )}
        </button>

        <button
          onClick={handleAccept}
          disabled={!!submitting}
          className="og-btn-primary"
          style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
        >
          {submitting === 'accept' ? (
            <><div className="og-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Aceptando...</>
          ) : (
            <><i className="bi bi-check-circle" /> Aceptar</>
          )}
        </button>
      </div>
    </>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="og-spinner-wrap">
        <div className="og-spinner" />
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  );
}

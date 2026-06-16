'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { householdService } from '@/lib/api/household.service';
import type { PendingInvitation } from '@/types/household.types';

// ── Estilos ──────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-background-primary, #0f0f1a)',
    padding: '1.5rem',
  } as React.CSSProperties,
  card: {
    background: '#1e1e2e',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    width: '100%',
    maxWidth: '460px',
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    background: 'rgba(212,175,82,0.07)',
    borderBottom: '1px solid rgba(212,175,82,0.15)',
    padding: '1.5rem',
    textAlign: 'center' as const,
  },
  logo: {
    fontSize: '1.3rem',
    fontWeight: 800,
    color: '#D4AF52',
    letterSpacing: '-0.3px',
  },
  body: { padding: '2rem 1.75rem' },
  householdName: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#e8e8f0',
    margin: '0 0 0.25rem',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center' as const,
    margin: '0 0 1.5rem',
  },
  infoBox: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '1rem',
    marginBottom: '1.5rem',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.3rem 0',
    fontSize: '0.85rem',
  } as React.CSSProperties,
  infoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' },
  infoValue: { color: '#e8e8f0', fontWeight: 500, textAlign: 'right' as const },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.65rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: 'rgba(13,110,253,0.15)',
    border: '1px solid rgba(13,110,253,0.35)',
    color: '#6ea8fe',
  },
  btnAccept: {
    width: '100%',
    padding: '0.75rem',
    background: '#198754',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
    marginBottom: '0.65rem',
    transition: 'background 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  } as React.CSSProperties,
  btnReject: {
    width: '100%',
    padding: '0.7rem',
    background: 'transparent',
    color: 'rgba(255,255,255,0.45)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    fontWeight: 500,
    fontSize: '0.88rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  } as React.CSSProperties,
};

// ── Página ────────────────────────────────────────────────────────────────────

export default function InvitationPage() {
  const router  = useRouter();
  const params  = useParams();
  const { user } = useAuthStore();

  const rawId = params?.id;
const invitationId = rawId && rawId !== 'pending' ? Number(rawId) : NaN;

  const [invitation, setInvitation]   = useState<PendingInvitation | null>(null);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [done, setDone]               = useState<'accepted' | 'rejected' | null>(null);

  // Si no está autenticado → redirigir al login con redirect param
  useEffect(() => {
    if (!user) {
      const redirectPath = `/invitations/${invitationId}`;
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [user, invitationId, router]);

  // Cargar datos de la invitación
  useEffect(() => {
    if (!user || !invitationId || isNaN(invitationId)) {
      setLoading(false); // evita spinner eterno
      return;
    }
    const fetchInvitation = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await householdService.getInvitation(invitationId);
        if (res.success && res.data) {
          setInvitation(res.data.invitation);
        }
      } catch (e: any) {
        setError(e.message || 'Invitación no encontrada o ya respondida.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [user, invitationId]);

  const handleAccept = async () => {
    if (!invitation) return;
    setActionLoading(true);
    try {
      await householdService.acceptInvitation(invitationId);
      setDone('accepted');
      // Redirigir al dashboard después de 2 segundos
      setTimeout(() => router.push('/households'), 2000);
    } catch (e: any) {
      setError(e.message || 'Error al aceptar la invitación.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!invitation) return;
    setActionLoading(true);
    try {
      await householdService.rejectInvitation(invitationId);
      setDone('rejected');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (e: any) {
      setError(e.message || 'Error al rechazar la invitación.');
    } finally {
      setActionLoading(false);
    }
  };

  // No renderizar nada si no está autenticado (ya redirigiendo)
  if (!user) return null;

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
      <div style={S.page}>
        <div style={S.card}>
          {/* Header */}
          <div style={S.header}>
            <div style={S.logo}>
              <i className="bi bi-house-heart-fill" style={{ marginRight: '0.4rem' }} />
              FinanzHome
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.3rem' }}>
              Invitación a un hogar
            </div>
          </div>

          {/* Body */}
          <div style={S.body}>

            {/* Loading */}
            {loading && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div className="spinner-border text-primary" style={{ width: '2rem', height: '2rem' }} />
                <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>
                  Cargando invitación...
                </p>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <i className="bi bi-exclamation-triangle" style={{ fontSize: '2.5rem', color: '#dc3545' }} />
                <p style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {error}
                </p>
                <button
                  onClick={() => router.push('/dashboard')}
                  style={{ ...S.btnReject, marginTop: '1rem' }}
                >
                  <i className="bi bi-arrow-left" /> Ir al dashboard
                </button>
              </div>
            )}

            {/* Resultado final */}
            {!loading && done && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                {done === 'accepted' ? (
                  <>
                    <i className="bi bi-check-circle-fill" style={{ fontSize: '3rem', color: '#198754' }} />
                    <p style={{ marginTop: '1rem', fontWeight: 700, fontSize: '1.1rem', color: '#e8e8f0' }}>
                      ¡Te uniste al hogar!
                    </p>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                      Redirigiendo a Hogares...
                    </p>
                  </>
                ) : (
                  <>
                    <i className="bi bi-x-circle" style={{ fontSize: '3rem', color: '#dc3545' }} />
                    <p style={{ marginTop: '1rem', fontWeight: 700, fontSize: '1.1rem', color: '#e8e8f0' }}>
                      Invitación rechazada
                    </p>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                      Redirigiendo al dashboard...
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Contenido principal */}
            {!loading && !error && !done && invitation && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(212,175,82,0.12)',
                    border: '2px solid rgba(212,175,82,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                    fontSize: '1.4rem',
                  }}>
                    <i className="bi bi-house-heart" style={{ color: '#D4AF52' }} />
                  </div>
                  <p style={S.householdName}>{invitation.household_name}</p>
                  {invitation.household_description && (
                    <p style={{ ...S.subtitle, marginBottom: '0.5rem' }}>
                      {invitation.household_description}
                    </p>
                  )}
                  <p style={S.subtitle}>
                    <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{invitation.inviter_name}</strong>
                    {' '}te invitó a unirte
                  </p>
                </div>

                {/* Info */}
                <div style={S.infoBox}>
                  <div style={S.infoRow}>
                    <span style={S.infoLabel}>Invitado por</span>
                    <span style={S.infoValue}>{invitation.inviter_name}</span>
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0.3rem 0' }} />
                  <div style={S.infoRow}>
                    <span style={S.infoLabel}>Tu rol propuesto</span>
                    <span style={S.roleBadge}>
                      <i className="bi bi-person-badge" style={{ fontSize: '0.7rem' }} />
                      {invitation.proposed_role}
                    </span>
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0.3rem 0' }} />
                  <div style={S.infoRow}>
                    <span style={S.infoLabel}>Expira</span>
                    <span style={{ ...S.infoValue, fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                      {new Date(invitation.expires_at).toLocaleDateString('es-CR', {
                        day: '2-digit', month: 'long', year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Botones */}
                <button
                  style={S.btnAccept}
                  onClick={handleAccept}
                  disabled={actionLoading}
                  onMouseEnter={e => { if (!actionLoading) (e.currentTarget as HTMLElement).style.background = '#157347'; }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#198754'}
                >
                  {actionLoading
                    ? <span className="spinner-border spinner-border-sm" />
                    : <i className="bi bi-check-lg" />
                  }
                  Aceptar invitación
                </button>

                <button
                  style={S.btnReject}
                  onClick={handleReject}
                  disabled={actionLoading}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.color = '#ff6b6b';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,53,69,0.4)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                  }}
                >
                  <i className="bi bi-x" />
                  Rechazar invitación
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { householdService } from '@/lib/api/household.service';

export default function PendingInvitationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace('/login?redirect=/invitations/pending');
      return;
    }

    const fetchInvitations = async () => {
      try {
        setLoading(true);
        // Reutilizamos el endpoint de count para saber si hay invitaciones,
        // pero necesitamos el listado — ver nota abajo
        const res = await householdService.getPendingInvitationsList();
        if (res.success && res.data) {
          setInvitations(res.data.invitations ?? []);
        }
      } catch (e: any) {
        setError(e.message || 'Error al cargar invitaciones.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitations();
  }, [user, router]);

  if (!user) return null;

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
      <div style={{ minHeight: '100vh', background: 'var(--color-background-primary, #0f0f1a)', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>
          <h2 style={{ color: '#e8e8f0', fontWeight: 700, marginBottom: '1.5rem' }}>
            <i className="bi bi-envelope-open" style={{ marginRight: '0.5rem', color: '#D4AF52' }} />
            Invitaciones pendientes
          </h2>

          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'rgba(255,255,255,0.4)' }}>
              <div className="spinner-border" style={{ width: '2rem', height: '2rem' }} />
              <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>Cargando invitaciones...</p>
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#ff6b6b' }}>
              <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem' }} />
              <p style={{ marginTop: '0.75rem' }}>{error}</p>
            </div>
          )}

          {!loading && !error && invitations.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
              <i className="bi bi-inbox" style={{ fontSize: '2.5rem' }} />
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>No tienes invitaciones pendientes.</p>
              <button onClick={() => router.push('/dashboard')} style={{ marginTop: '1rem', padding: '0.5rem 1.25rem', background: 'rgba(212,175,82,0.12)', border: '1px solid rgba(212,175,82,0.3)', borderRadius: '8px', color: '#D4AF52', cursor: 'pointer', fontSize: '0.85rem' }}>
                Ir al dashboard
              </button>
            </div>
          )}

          {!loading && !error && invitations.map((inv: any) => (
            <div key={inv.invitation_id} style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#e8e8f0', fontSize: '1rem' }}>{inv.household_name}</div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>
                  Invitado por <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{inv.inviter_name}</strong> · Rol: <span style={{ color: '#6ea8fe' }}>{inv.proposed_role}</span>
                </div>
              </div>
              <button
                onClick={() => router.push(`/invitations/${inv.invitation_id}`)}
                style={{ padding: '0.5rem 1.1rem', background: '#198754', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Ver
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
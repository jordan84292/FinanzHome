'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHouseholdStore } from '@/lib/store/household.store';
import { useAuthStore } from '@/lib/store/auth.store';

/* ─── Estructura de navegación ────────────────────────────────────────────── */
interface SidebarItem {
  href:   string;
  label:  string;
  icon:   string;
  badge?: string | number;
  badgeColor?: string;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

/* ─── Componente ─────────────────────────────────────────────────────────── */
export default function Sidebar() {
  const pathname             = usePathname();
  const { currentHousehold, pendingInvitationsCount } = useHouseholdStore();
  const { user }             = useAuthStore();

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  // Secciones con badge dinámico en Hogares si hay invitaciones pendientes
  const SIDEBAR_SECTIONS: SidebarSection[] = [
    {
      title: 'Principal',
      items: [
        { href: '/dashboard',       label: 'Dashboard',       icon: 'bi-grid-1x2'      },
        { href: '/pre-purchase',    label: 'Registro previo a comprar', icon: 'bi-clipboard-check' },
        { href: '/shopping-lists',  label: 'Lista Compras',   icon: 'bi-cart3'         },
      ],
    },
    {
      title: 'Inventario',
      items: [
        { href: '/products',    label: 'Productos',     icon: 'bi-box-seam' },
        { href: '/categories',  label: 'Categorías',    icon: 'bi-tags'      },
        { href: '/supermarkets', label: 'Supermercados', icon: 'bi-shop'     },
      ],
    },
    {
      title: 'Finanzas',
      items: [
        { href: '/pending-lists', label: 'Pendientes',      icon: 'bi-hourglass-split', badgeColor: '#ffc107' },
        { href: '/savings',       label: 'Metas de Ahorro', icon: 'bi-piggy-bank'       },
      ],
    },
    {
      title: 'Organización',
      items: [
        {
          href: '/households',
          label: 'Hogares',
          icon: 'bi-house',
          // Si hay invitaciones pendientes, mostramos el conteo en Hogares
          badge: pendingInvitationsCount > 0 ? pendingInvitationsCount : undefined,
          badgeColor: '#dc3545',
        },
      ],
    },
  ];

  return (
    <aside className="og-sidebar" role="complementary" aria-label="Menú lateral">

      {/* Información del hogar activo */}
      {currentHousehold && (
        <div className="og-sb-household-card">
          <div className="og-sb-household-icon" aria-hidden="true">
            <i className="bi bi-house-heart" />
          </div>
          <div className="og-sb-household-info">
            <div className="og-sb-household-label">Hogar activo</div>
            <div className="og-sb-household-name">{currentHousehold.name}</div>
          </div>
        </div>
      )}

      {/* Invitaciones pendientes — banner destacado */}
      {pendingInvitationsCount > 0 && (
        <Link
          href="/invitations/pending"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            margin: '0 0.75rem 0.5rem',
            padding: '0.6rem 0.85rem',
            borderRadius: '10px',
            background: 'rgba(255,193,7,0.08)',
            border: '1px solid rgba(255,193,7,0.2)',
            color: '#ffc107',
            textDecoration: 'none',
            fontSize: '0.82rem',
            fontWeight: 600,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,193,7,0.14)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,193,7,0.08)'}
          aria-label={`${pendingInvitationsCount} invitación${pendingInvitationsCount > 1 ? 'es' : ''} pendiente${pendingInvitationsCount > 1 ? 's' : ''}`}
        >
          <i className="bi bi-envelope-exclamation" style={{ fontSize: '1rem', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            {pendingInvitationsCount === 1
              ? '1 invitación pendiente'
              : `${pendingInvitationsCount} invitaciones pendientes`}
          </span>
          <i className="bi bi-chevron-right" style={{ fontSize: '0.7rem', opacity: 0.6 }} />
        </Link>
      )}

      {/* Secciones de navegación */}
      <nav aria-label="Navegación lateral">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.title} className="og-sb-group">
            <div className="og-sb-section" role="heading" aria-level={3}>
              {section.title}
            </div>

            {section.items.map(({ href, label, icon, badge, badgeColor }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`og-sb-item${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {/* Indicador activo */}
                  {active && <span className="og-sb-active-indicator" aria-hidden="true" />}

                  <i className={`bi ${icon} og-sb-item-icon`} aria-hidden="true" />
                  <span className="og-sb-item-label">{label}</span>

                  {badge !== undefined && (
                    <span
                      className="og-sb-badge"
                      aria-label={`${badge} pendientes`}
                      style={badgeColor ? { background: badgeColor, color: '#fff' } : undefined}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer del sidebar: usuario */}
      <div className="og-sb-footer">
        <div className="og-sb-footer-divider" />
        <div className="og-sb-user-row">
          <div className="og-sb-user-avatar" aria-hidden="true" style={{ position: 'relative' }}>
            {initials}
            {/* Punto rojo en avatar si hay invitaciones */}
            {pendingInvitationsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#dc3545',
                border: '1.5px solid var(--color-background-secondary, #1e1e2e)',
              }} />
            )}
          </div>
          <div className="og-sb-user-info">
            <div className="og-sb-user-name">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="og-sb-user-role">
              {currentHousehold?.myRole ?? 'Miembro'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useHouseholdStore } from '@/lib/store/household.store';

/* ─── Tipos ──────────────────────────────────────────────────────────────── */
interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard',     icon: 'bi-grid-1x2'      },
  { href: '/purchases',    label: 'Compras',       icon: 'bi-cart3'          },
  { href: '/products',     label: 'Productos',     icon: 'bi-box-seam'       },
  { href: '/categories',    label: 'Categorías',    icon: 'bi-tags'           },
  { href: '/supermarkets', label: 'Supermercados', icon: 'bi-shop'          },
  { href: '/finances',     label: 'Finanzas',      icon: 'bi-wallet2'        },
  { href: '/reports',      label: 'Reportes',      icon: 'bi-bar-chart-line' },
  { href: '/households',   label: 'Hogares',       icon: 'bi-house'          },
];

/* ─── Componente ─────────────────────────────────────────────────────────── */
export default function Navbar() {
  const pathname        = usePathname();
  const router          = useRouter();
  const { user, logout }= useAuthStore();
  const { currentHousehold, pendingInvitationsCount, fetchPendingInvitationsCount } = useHouseholdStore();

  const [userMenuOpen,   setUserMenuOpen]   = useState(false);
  const [scrolled,       setScrolled]       = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userMenuRef  = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  /* Sombra al hacer scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Cerrar menús al clickear afuera */
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (mobileNavRef.current && !mobileNavRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  /* Cerrar menú móvil al navegar */
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  /* Cargar invitaciones pendientes cuando el usuario está autenticado */
  useEffect(() => {
    if (!user) return;
    fetchPendingInvitationsCount();
    // Refrescar cada 60 segundos
    const interval = setInterval(fetchPendingInvitationsCount, 60_000);
    return () => clearInterval(interval);
  }, [user, fetchPendingInvitationsCount]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    router.push('/login');
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <nav className={`og-navbar${scrolled ? ' og-navbar--scrolled' : ''}`} role="navigation" aria-label="Navegación principal">

        {/* Logo */}
        <Link href="/dashboard" className="og-logo" aria-label="FinanzHome – ir al dashboard">
          <span className="og-logo-mark" aria-hidden="true">
            <i className="bi bi-house-heart-fill" />
          </span>
          <span className="og-logo-text">Finanz<span className="og-logo-accent">Home</span></span>
        </Link>

        {/* Links desktop */}
        <div className="og-nav-links" role="menubar">
          {NAV_ITEMS.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              className={`og-nav-link${isActive(href) ? ' active' : ''}`}
              aria-current={isActive(href) ? 'page' : undefined}
            >
              <i className={`bi ${icon}`} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Badge de invitaciones pendientes */}
        {pendingInvitationsCount > 0 && (
          <Link
            href="/invitations/pending"
            title={`Tienes ${pendingInvitationsCount} invitación${pendingInvitationsCount > 1 ? 'es' : ''} pendiente${pendingInvitationsCount > 1 ? 's' : ''}`}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'rgba(255,193,7,0.1)',
              border: '1px solid rgba(255,193,7,0.25)',
              color: '#ffc107',
              fontSize: '1rem',
              marginRight: '0.25rem',
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
          >
            <i className="bi bi-envelope-exclamation" aria-hidden="true" />
            <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: '#dc3545',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--color-background-primary, #0f0f1a)',
            }}>
              {pendingInvitationsCount > 9 ? '9+' : pendingInvitationsCount}
            </span>
          </Link>
        )}

        {/* Household pill */}
        {currentHousehold && (
          <Link href="/households" className="og-household-pill" title="Cambiar hogar">
            <span className="og-household-dot" aria-hidden="true" />
            <span className="og-household-name">{currentHousehold.name}</span>
            <i className="bi bi-chevron-down" style={{ fontSize: 10, opacity: 0.5 }} aria-hidden="true" />
          </Link>
        )}

        {/* Avatar + dropdown */}
        <div className="og-user-menu-wrap" ref={userMenuRef}>
          <button
            className={`og-avatar${userMenuOpen ? ' og-avatar--open' : ''}`}
            onClick={() => setUserMenuOpen(v => !v)}
            aria-haspopup="true"
            aria-expanded={userMenuOpen}
            aria-label="Menú de usuario"
            style={{ position: 'relative' }}
          >
            {initials}
            {/* Punto indicador en avatar si hay invitaciones */}
            {pendingInvitationsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 1,
                right: 1,
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: '#dc3545',
                border: '2px solid var(--color-background-primary, #0f0f1a)',
              }} />
            )}
          </button>

          {userMenuOpen && (
            <div className="og-dropdown-menu" role="menu" aria-label="Opciones de usuario">
              {/* Header de usuario */}
              <div className="og-dropdown-header">
                <div className="og-dropdown-avatar-lg">{initials}</div>
                <div>
                  <div className="og-dropdown-user-name">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="og-dropdown-user-email">{user?.email}</div>
                </div>
              </div>
              <div className="og-dropdown-divider" role="separator" />

              {/* Enlace a invitaciones si hay pendientes */}
              {pendingInvitationsCount > 0 && (
                <>
                  <div className="og-dropdown-divider" role="separator" />
                  <Link
                    href="/invitations/pending"
                    className="og-dropdown-item"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <i className="bi bi-envelope-exclamation" aria-hidden="true" style={{ color: '#ffc107' }} />
                    <span style={{ flex: 1 }}>Invitaciones</span>
                    <span style={{
                      background: '#dc3545',
                      color: '#fff',
                      borderRadius: '10px',
                      padding: '1px 7px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}>
                      {pendingInvitationsCount}
                    </span>
                  </Link>
                </>
              )}

              <div className="og-dropdown-divider" role="separator" />

              <button
                className="og-dropdown-item danger"
                role="menuitem"
                onClick={handleLogout}
              >
                <i className="bi bi-box-arrow-right" aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>

        {/* Botón hamburguesa – móvil */}
        <button
          className="og-mobile-toggle"
          onClick={() => setMobileMenuOpen(v => !v)}
          aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileMenuOpen}
          aria-controls="og-mobile-nav"
          style={{ position: 'relative' }}
        >
          <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
          {pendingInvitationsCount > 0 && !mobileMenuOpen && (
            <span style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#dc3545',
              border: '2px solid var(--color-background-primary, #0f0f1a)',
            }} />
          )}
        </button>
      </nav>

      {/* Menú móvil desplegable */}
      {mobileMenuOpen && (
        <div
          id="og-mobile-nav"
          className="og-mobile-nav"
          ref={mobileNavRef}
          role="navigation"
          aria-label="Menú móvil"
        >
          {NAV_ITEMS.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`og-mobile-nav-item${isActive(href) ? ' active' : ''}`}
              aria-current={isActive(href) ? 'page' : undefined}
            >
              <i className={`bi ${icon}`} aria-hidden="true" />
              <span>{label}</span>
              {isActive(href) && <i className="bi bi-chevron-right ms-auto" style={{ fontSize: 11, opacity: 0.4 }} aria-hidden="true" />}
            </Link>
          ))}

          {/* Invitaciones pendientes en móvil */}
          {pendingInvitationsCount > 0 && (
            <>
              <div className="og-mobile-divider" />
              <Link
                href="/invitations/pending"
                className="og-mobile-nav-item"
                style={{ color: '#ffc107' }}
              >
                <i className="bi bi-envelope-exclamation" aria-hidden="true" />
                <span>Invitaciones pendientes</span>
                <span className="og-mobile-badge" style={{ background: '#dc3545' }}>
                  {pendingInvitationsCount}
                </span>
              </Link>
            </>
          )}

          {currentHousehold && (
            <>
              <div className="og-mobile-divider" />
              <Link href="/households" className="og-mobile-nav-item">
                <i className="bi bi-house-check" aria-hidden="true" />
                <span>{currentHousehold.name}</span>
                <span className="og-mobile-badge">Hogar activo</span>
              </Link>
            </>
          )}
        </div>
      )}
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: 'bi-house' },
  { href: '/inventario', label: 'Inventario', icon: 'bi-basket' },
  { href: '/compras', label: 'Compras', icon: 'bi-cart' },
  { href: '/gastos', label: 'Gastos', icon: 'bi-wallet2' },
  { href: '/perfil', label: 'Perfil', icon: 'bi-person-circle' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="navbar fixed-bottom bg-body-tertiary border-top">
      <div className="container-fluid d-flex justify-content-around py-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="d-flex flex-column align-items-center text-decoration-none small"
            >
              <span
                className="d-flex align-items-center justify-content-center rounded-pill px-3 py-1 mb-1"
                style={
                  isActive
                    ? { background: 'var(--gradient-accent)', boxShadow: 'var(--glow-accent)' }
                    : undefined
                }
              >
                <i className={`bi ${item.icon} fs-5 ${isActive ? 'text-white' : 'text-body'}`} />
              </span>
              <span className={isActive ? 'text-white fw-semibold' : 'text-body'}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

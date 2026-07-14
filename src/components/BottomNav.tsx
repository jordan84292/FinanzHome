import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: 'bi-house' },
  { href: '/inventario', label: 'Inventario', icon: 'bi-basket' },
  { href: '/compras', label: 'Compras', icon: 'bi-cart' },
  { href: '/gastos', label: 'Gastos', icon: 'bi-wallet2' },
];

export function BottomNav() {
  return (
    <nav className="navbar fixed-bottom bg-body-tertiary border-top">
      <div className="container-fluid d-flex justify-content-around py-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="d-flex flex-column align-items-center text-decoration-none text-body small"
          >
            <i className={`bi ${item.icon} fs-5`} />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

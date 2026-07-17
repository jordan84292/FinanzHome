import type { ReactNode } from 'react';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main
      className="d-flex align-items-center justify-content-center px-3 py-5"
      style={{ minHeight: '100dvh' }}
    >
      <div className="w-100" style={{ maxWidth: 400 }}>
        <div className="d-flex flex-column align-items-center text-center mb-4">
          <div
            className="d-flex align-items-center justify-content-center rounded-circle mb-3"
            style={{ width: 64, height: 64, background: 'var(--gradient-accent)', boxShadow: 'var(--glow-accent)' }}
          >
            <i className="bi bi-house-heart-fill text-white" style={{ fontSize: '1.75rem' }} />
          </div>
          <span className="h4 mb-0 page-title">FinanzHome</span>
          <span className="text-body-secondary small">Tu hogar, tus finanzas</span>
        </div>

        <div className="card">
          <div className="card-body p-4">
            <h1 className="h5 mb-1">{title}</h1>
            <p className="text-body-secondary small mb-4">{subtitle}</p>
            {children}
          </div>
        </div>

        {footer ? <div className="text-center mt-3">{footer}</div> : null}
      </div>
    </main>
  );
}

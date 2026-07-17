import type { ReactNode } from 'react';
import Image from 'next/image';

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
          <Image
            src="/logo-icon.png"
            alt="FinanzHome"
            width={72}
            height={72}
            className="rounded-4 mb-3"
            style={{ boxShadow: 'var(--glow-accent)' }}
            priority
          />
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

/**
 * Layout de autenticación — Obsidian Gold
 * Fondo oscuro con grid y resplandor dorado
 */
import '@/app/globals.css';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-layout">
      <div className="auth-container">
        {/* Logo */}
        <div className="auth-logo-wrap">
          <div className="auth-logo-box">
            <i className="bi bi-house-heart-fill"></i>
          </div>
          <span className="auth-logo-name">FinanzHome</span>
        </div>
        <p className="auth-logo-sub">Gestión Integral de Hogares</p>

        {/* Card glass */}
        <div className="auth-glass">
          {children}
        </div>
      </div>
    </div>
  );
}

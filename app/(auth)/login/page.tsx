'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth.store';

function LoginForm() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [email,     setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass,  setShowPass] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const redirectTo = searchParams.get('redirect') ?? '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, redirectTo, router]);

  useEffect(() => {
    clearError();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login({ email, password });
    } catch {
      // El error ya está en el store
    }
  };

  return (
    <div className="auth-page">
      {/* Fondo animado */}
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <div className="auth-grid" />
        <div className="auth-particles">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`auth-particle auth-particle-${i + 1}`} />
          ))}
        </div>
      </div>

      <div className="auth-container">
        {/* Card principal */}
        <div className="auth-card">
          {/* Header premium */}
          <div className="auth-header">
            <div className="auth-logo-wrapper">
              <div className="auth-logo">
                <i className="bi bi-house-heart-fill" />
              </div>
              <div className="auth-brand">
                <span className="auth-brand-name">FinanzHome</span>
                <span className="auth-brand-tagline">Gestión inteligente del hogar</span>
              </div>
            </div>
            <div className="auth-header-decoration">
              <div className="auth-header-line" />
            </div>
          </div>

          {/* Contenido */}
          <div className="auth-content">
            {/* Título con animación */}
            <div className="auth-title-section">
              <h1 className="auth-title">
                <span className="auth-title-icon">
                  <i className="bi bi-person-check-fill" />
                </span>
                ¡Bienvenido de nuevo!
              </h1>
              <p className="auth-subtitle">Ingresa tus credenciales para acceder a tu cuenta</p>
            </div>

            {/* Banner de invitación */}
            {redirectTo.startsWith('/invitations/') && (
              <div className="auth-invitation-banner">
                <i className="bi bi-envelope-exclamation-fill" />
                <span>Inicia sesión para ver y responder tu invitación</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="auth-error">
                <i className="bi bi-shield-exclamation" />
                <span>{error}</span>
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="auth-form">
              {/* Email */}
              <div className="auth-field">
                <label className="auth-label">
                  <i className="bi bi-envelope-at-fill" />
                  Correo electrónico
                </label>
                <div className="auth-input-wrapper">
                  <input
                    className="auth-input"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                  <div className="auth-input-focus-ring" />
                </div>
              </div>

              {/* Contraseña */}
              <div className="auth-field">
                <label className="auth-label">
                  <i className="bi bi-lock-fill" />
                  Contraseña
                </label>
                <div className="auth-input-wrapper">
                  <input
                    className="auth-input auth-input-password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <i className={`bi ${showPass ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} />
                  </button>
                  <div className="auth-input-focus-ring" />
                </div>
                <div className="auth-forgot">
                  <Link href="/forgot-password" className="auth-forgot-link">
                    <i className="bi bi-question-circle-fill" />
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </div>

              {/* Botón submit */}
              <button
                type="submit"
                className={`auth-submit ${isLoading ? 'auth-submit-loading' : ''}`}
                disabled={isLoading}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <span className="auth-submit-content">
                  {isLoading ? (
                    <>
                      <span className="auth-spinner" />
                      <span>Ingresando...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-box-arrow-in-right" />
                      <span>Iniciar sesión</span>
                    </>
                  )}
                </span>
                <span className="auth-submit-shine" />
              </button>
            </form>

            {/* Footer */}
            <div className="auth-footer">
              <div className="auth-footer-divider">
                <span>¿No tienes cuenta?</span>
              </div>
              <Link href="/register" className="auth-register-link">
                <i className="bi bi-person-plus-fill" />
                <span>Regístrate aquí</span>
                <i className="bi bi-arrow-right" />
              </Link>
            </div>
          </div>

          {/* Footer decorativo */}
          <div className="auth-card-footer">
            <div className="auth-security-badge">
              <i className="bi bi-shield-check" />
              <span>Conexión segura</span>
            </div>
          </div>
        </div>

        {/* Info lateral */}
        <div className="auth-info-panel">
          <div className="auth-info-content">
            <h2 className="auth-info-title">Gestiona tu hogar de manera inteligente</h2>
            <ul className="auth-features">
              <li>
                <i className="bi bi-check-circle-fill" />
                <span>Controla tus gastos y presupuestos</span>
              </li>
              <li>
                <i className="bi bi-check-circle-fill" />
                <span>Gestiona el inventario de tu hogar</span>
              </li>
              <li>
                <i className="bi bi-check-circle-fill" />
                <span>Organiza tus compras y compras</span>
              </li>
              <li>
                <i className="bi bi-check-circle-fill" />
                <span>Comparte gastos con tu familia</span>
              </li>
            </ul>
            <div className="auth-info-stats">
              <div className="auth-stat">
                <span className="auth-stat-number">10K+</span>
                <span className="auth-stat-label">Usuarios activos</span>
              </div>
              <div className="auth-stat">
                <span className="auth-stat-number">50K+</span>
                <span className="auth-stat-label">Hogares gestionados</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Versión móvil */}
      <div className="auth-mobile-brand">
        <i className="bi bi-house-heart-fill" />
        <span>FinanzHome</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-loading">
          <div className="auth-loading-spinner" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
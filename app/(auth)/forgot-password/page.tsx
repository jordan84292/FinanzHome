'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth.store';

/**
 * Página de Olvidé mi Contraseña - FinanzHome
 * Permite a los usuarios solicitar un restablecimiento de contraseña
 */
export default function ForgotPasswordPage() {
  const { forgotPassword, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();
    setSuccess(false);

    try {
      await forgotPassword({ email });
      setSuccess(true);
      setEmail('');
    } catch (err) {
      // El error ya está en el store
      console.error('Forgot password error:', err);
    }
  };

  if (success) {
    return (
      <div className="forgot-password-page">
        <div className="text-center">
          <div className="mb-4">
            <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '4rem' }}></i>
          </div>
          <h2 className="mb-3">Correo Enviado</h2>
          <p className="text-muted mb-4">
            Hemos enviado un enlace de restablecimiento de contraseña a tu correo electrónico.
            Por favor revisa tu bandeja de entrada y sigue las instrucciones.
          </p>
          <div className="d-grid gap-2">
            <Link href="/login" className="btn btn-primary">
              <i className="bi bi-arrow-left me-2"></i>
              Volver al Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-page">
      <h2 className="text-center mb-2">¿Olvidaste tu Contraseña?</h2>
      <p className="text-center text-muted mb-4">
        Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
      </p>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={clearError}
            aria-label="Close"
          ></button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Email */}
        <div className="mb-3">
          <label htmlFor="email" className="form-label">
            Correo Electrónico
          </label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-envelope"></i>
            </span>
            <input
              type="email"
              className="form-control"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary w-100 mb-3"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Enviando...
            </>
          ) : (
            <>
              <i className="bi bi-send me-2"></i>
              Enviar Enlace de Recuperación
            </>
          )}
        </button>

        {/* Back to Login Link */}
        <div className="text-center">
          <Link href="/login" className="text-decoration-none">
            <i className="bi bi-arrow-left me-1"></i>
            Volver al Login
          </Link>
        </div>
      </form>
    </div>
  );
}

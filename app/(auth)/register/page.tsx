'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth.store';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      errors.email = 'Correo electrónico inválido';
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      errors.password = 'La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }

    if (formData.firstName.trim().length < 2) {
      errors.firstName = 'El nombre debe tener al menos 2 caracteres';
    }

    if (formData.lastName.trim().length < 2) {
      errors.lastName = 'El apellido debe tener al menos 2 caracteres';
    }

    if (formData.phone && !/^\+?[\d\s-()]{8,}$/.test(formData.phone)) {
      errors.phone = 'Número de teléfono inválido';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();
    setValidationErrors({});

    if (!acceptedTerms) {
      setValidationErrors({ terms: 'Debes aceptar los términos y condiciones' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      router.push('/dashboard');
    } catch (err) {
      console.error('Register error:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
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
        <div className="auth-card auth-card-register">
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
                  <i className="bi bi-person-plus-fill" />
                </span>
                ¡Crea tu cuenta!
              </h1>
              <p className="auth-subtitle">Completa tus datos para comenzar</p>
            </div>

            {/* Error del servidor */}
            {error && (
              <div className="auth-error">
                <i className="bi bi-shield-exclamation" />
                <span>{error}</span>
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="auth-form">
              {/* Nombre y Apellido */}
              <div className="auth-row">
                <div className="auth-field">
                  <label className="auth-label">
                    <i className="bi bi-person-fill" />
                    Nombre
                  </label>
                  <div className="auth-input-wrapper">
                    <input
                      className={`auth-input ${validationErrors.firstName ? 'auth-input-error' : ''}`}
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="Juan"
                      required
                      autoComplete="given-name"
                      disabled={isLoading}
                    />
                    <div className="auth-input-focus-ring" />
                  </div>
                  {validationErrors.firstName && (
                    <div className="auth-field-error">
                      <i className="bi bi-exclamation-circle-fill" />
                      {validationErrors.firstName}
                    </div>
                  )}
                </div>

                <div className="auth-field">
                  <label className="auth-label">
                    <i className="bi bi-person-fill" />
                    Apellido
                  </label>
                  <div className="auth-input-wrapper">
                    <input
                      className={`auth-input ${validationErrors.lastName ? 'auth-input-error' : ''}`}
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Pérez"
                      required
                      autoComplete="family-name"
                      disabled={isLoading}
                    />
                    <div className="auth-input-focus-ring" />
                  </div>
                  {validationErrors.lastName && (
                    <div className="auth-field-error">
                      <i className="bi bi-exclamation-circle-fill" />
                      {validationErrors.lastName}
                    </div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="auth-field">
                <label className="auth-label">
                  <i className="bi bi-envelope-at-fill" />
                  Correo electrónico
                </label>
                <div className="auth-input-wrapper">
                  <input
                    className={`auth-input ${validationErrors.email ? 'auth-input-error' : ''}`}
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="tu@email.com"
                    required
                    autoComplete="email"
                    disabled={isLoading}
                  />
                  <div className="auth-input-focus-ring" />
                </div>
                {validationErrors.email && (
                  <div className="auth-field-error">
                    <i className="bi bi-exclamation-circle-fill" />
                    {validationErrors.email}
                  </div>
                )}
              </div>

              {/* Teléfono */}
              <div className="auth-field">
                <label className="auth-label">
                  <i className="bi bi-phone-fill" />
                  Teléfono <span className="auth-optional">(Opcional)</span>
                </label>
                <div className="auth-input-wrapper">
                  <input
                    className={`auth-input ${validationErrors.phone ? 'auth-input-error' : ''}`}
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+506 1234-5678"
                    autoComplete="tel"
                    disabled={isLoading}
                  />
                  <div className="auth-input-focus-ring" />
                </div>
                {validationErrors.phone && (
                  <div className="auth-field-error">
                    <i className="bi bi-exclamation-circle-fill" />
                    {validationErrors.phone}
                  </div>
                )}
              </div>

              {/* Contraseña */}
              <div className="auth-field">
                <label className="auth-label">
                  <i className="bi bi-lock-fill" />
                  Contraseña
                </label>
                <div className="auth-input-wrapper">
                  <input
                    className={`auth-input auth-input-password ${validationErrors.password ? 'auth-input-error' : ''}`}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} />
                  </button>
                  <div className="auth-input-focus-ring" />
                </div>
                <div className="auth-password-hint">
                  <i className="bi bi-info-circle-fill" />
                  Mínimo 8 caracteres, una mayúscula, una minúscula y un número
                </div>
                {validationErrors.password && (
                  <div className="auth-field-error">
                    <i className="bi bi-exclamation-circle-fill" />
                    {validationErrors.password}
                  </div>
                )}
              </div>

              {/* Confirmar Contraseña */}
              <div className="auth-field">
                <label className="auth-label">
                  <i className="bi bi-lock-fill" />
                  Confirmar Contraseña
                </label>
                <div className="auth-input-wrapper">
                  <input
                    className={`auth-input auth-input-password ${validationErrors.confirmPassword ? 'auth-input-error' : ''}`}
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    <i className={`bi ${showConfirmPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} />
                  </button>
                  <div className="auth-input-focus-ring" />
                </div>
                {validationErrors.confirmPassword && (
                  <div className="auth-field-error">
                    <i className="bi bi-exclamation-circle-fill" />
                    {validationErrors.confirmPassword}
                  </div>
                )}
              </div>

              {/* Términos y condiciones */}
              <div className="auth-terms">
                <label className="auth-checkbox-label">
                  <input
                    type="checkbox"
                    className="auth-checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span className="auth-checkbox-custom">
                    <i className="bi bi-check" />
                  </span>
                  <span className="auth-checkbox-text">
                    Acepto los{' '}
                    <a href="#" className="auth-terms-link">Términos de Servicio</a>
                    {' '}y la{' '}
                    <a href="#" className="auth-terms-link">Política de Privacidad</a>
                  </span>
                </label>
                {validationErrors.terms && (
                  <div className="auth-field-error">
                    <i className="bi bi-exclamation-circle-fill" />
                    {validationErrors.terms}
                  </div>
                )}
              </div>

              {/* Botón submit */}
              <button
                type="submit"
                className={`auth-submit ${isLoading ? 'auth-submit-loading' : ''}`}
                disabled={isLoading}
              >
                <span className="auth-submit-content">
                  {isLoading ? (
                    <>
                      <span className="auth-spinner" />
                      <span>Creando cuenta...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-person-plus-fill" />
                      <span>Crear Cuenta</span>
                    </>
                  )}
                </span>
                <span className="auth-submit-shine" />
              </button>
            </form>

            {/* Footer */}
            <div className="auth-footer">
              <div className="auth-footer-divider">
                <span>¿Ya tienes cuenta?</span>
              </div>
              <Link href="/login" className="auth-register-link">
                <i className="bi bi-box-arrow-in-right" />
                <span>Inicia sesión aquí</span>
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
            <h2 className="auth-info-title">Únete a miles de familias que ya gestionan su hogar</h2>
            <ul className="auth-features">
              <li>
                <i className="bi bi-check-circle-fill" />
                <span>Registro rápido y seguro</span>
              </li>
              <li>
                <i className="bi bi-check-circle-fill" />
                <span>Tu primera cuenta gratuita</span>
              </li>
              <li>
                <i className="bi bi-check-circle-fill" />
                <span>Accede desde cualquier dispositivo</span>
              </li>
              <li>
                <i className="bi bi-check-circle-fill" />
                <span>Soporte 24/7 disponible</span>
              </li>
            </ul>
            <div className="auth-info-stats">
              <div className="auth-stat">
                <span className="auth-stat-number">4.9</span>
                <span className="auth-stat-label">Calificación promedio</span>
              </div>
              <div className="auth-stat">
                <span className="auth-stat-number">99.9%</span>
                <span className="auth-stat-label">Tiempo activo</span>
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
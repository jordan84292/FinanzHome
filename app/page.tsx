'use client';

import Link from 'next/link';

/**
 * Landing Page - FinanzHome
 * Página de inicio pública con diseño Obsidian Gold
 */
export default function Home() {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg-pattern"></div>
        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <i className="bi bi-stars"></i>
              Gestión Integral de Hogares
            </div>
            <h1 className="hero-title">
              <span className="hero-title-accent">FinanzHome</span>
              <br />
              Tu Hogar, Tu Control
            </h1>
            <p className="hero-description">
              La plataforma completa para administrar tu hogar: inventario inteligente, 
              compras organizadas, finanzas personales y compartidas. Todo en un solo lugar, 
              diseñado para ti.
            </p>
            <div className="hero-actions">
              <Link href="/register" className="btn-hero-primary">
                <i className="bi bi-rocket-takeoff"></i>
                Comenzar Gratis
              </Link>
              <Link href="/login" className="btn-hero-secondary">
                <i className="bi bi-box-arrow-in-right"></i>
                Iniciar Sesión
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-number">100%</span>
                <span className="stat-label">Gratuito</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">24/7</span>
                <span className="stat-label">Acceso</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-number">∞</span>
                <span className="stat-label">Hogares</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-icon-container">
              <i className="bi bi-house-heart-fill"></i>
            </div>
            <div className="hero-glow"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-header">
          <h2 className="section-title">Características Principales</h2>
          <p className="section-subtitle">Todo lo que necesitas para organizar tu hogar</p>
        </div>
        <div className="features-grid">
          {/* Feature 1 - Inventario */}
          <div className="feature-card">
            <div className="feature-icon feature-icon-inventory">
              <i className="bi bi-box-seam"></i>
            </div>
            <h3 className="feature-title">Inventario Inteligente</h3>
            <p className="feature-description">
              Control total de productos del hogar. Gestiona stock, recibe alertas de productos 
              próximos a agotarse y obtén sugerencias de compra automáticas.
            </p>
            <ul className="feature-list">
              <li><i className="bi bi-check2"></i> Control de stock en tiempo real</li>
              <li><i className="bi bi-check2"></i> Alertas de productos bajos</li>
              <li><i className="bi bi-check2"></i> Sugerencias de compra</li>
            </ul>
          </div>

          {/* Feature 2 - Compras */}
          <div className="feature-card">
            <div className="feature-icon feature-icon-purchases">
              <i className="bi bi-cart-check"></i>
            </div>
            <h3 className="feature-title">Gestión de Compras</h3>
            <p className="feature-description">
              Registra tus compras y compara precios entre diferentes supermercados. 
              Encuentra las mejores ofertas y ahorra en cada compra.
            </p>
            <ul className="feature-list">
              <li><i className="bi bi-check2"></i> Comparación de precios</li>
              <li><i className="bi bi-check2"></i> Historial de compras</li>
              <li><i className="bi bi-check2"></i> Múltiples supermercados</li>
            </ul>
          </div>

          {/* Feature 3 - Finanzas */}
          <div className="feature-card">
            <div className="feature-icon feature-icon-finances">
              <i className="bi bi-cash-coin"></i>
            </div>
            <h3 className="feature-title">Finanzas Personales</h3>
            <p className="feature-description">
              Controla tus ingresos y gastos. Establece presupuestos, rastrea tus finanzas 
              y toma mejores decisiones económicas para tu hogar.
            </p>
            <ul className="feature-list">
              <li><i className="bi bi-check2"></i> Control de presupuestos</li>
              <li><i className="bi bi-check2"></i> Seguimiento de gastos</li>
              <li><i className="bi bi-check2"></i> Análisis financiero</li>
            </ul>
          </div>

          {/* Feature 4 - Finanzas Compartidas */}
          <div className="feature-card">
            <div className="feature-icon feature-icon-shared">
              <i className="bi bi-people-fill"></i>
            </div>
            <h3 className="feature-title">Finanzas Compartidas</h3>
            <p className="feature-description">
              Comparte gastos con tu familia o compañeros de hogar. Registra deudas, 
              split de gastos y metas de ahorro compartidas.
            </p>
            <ul className="feature-list">
              <li><i className="bi bi-check2"></i> Split de gastos</li>
              <li><i className="bi bi-check2"></i> Gestión de deudas</li>
              <li><i className="bi bi-check2"></i> Metas de ahorro</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="benefits-content">
          <div className="benefits-text">
            <h2 className="section-title">¿Por qué elegir FinanzHome?</h2>
            <p className="section-subtitle">Diseñado para simplificar tu vida doméstica</p>
            
            <div className="benefit-item">
              <div className="benefit-icon">
                <i className="bi bi-house"></i>
              </div>
              <div className="benefit-content">
                <h4>Multi-Hogar</h4>
                <p>Administra múltiples hogares con diferentes miembros, roles y permisos personalizados.</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <i className="bi bi-people"></i>
              </div>
              <div className="benefit-content">
                <h4>Colaborativo</h4>
                <p>Invita miembros, comparte gastos y trabaja en equipo con tu familia para alcanzar metas.</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <i className="bi bi-shield-check"></i>
              </div>
              <div className="benefit-content">
                <h4>Seguro</h4>
                <p>Protección de datos con autenticación JWT, encriptación y mejores prácticas de seguridad.</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <i className="bi bi-phone"></i>
              </div>
              <div className="benefit-content">
                <h4>Responsive</h4>
                <p>Accede desde cualquier dispositivo. Diseñado para funcionar perfectamente en móvil y escritorio.</p>
              </div>
            </div>
          </div>
          <div className="benefits-visual">
            <div className="visual-card">
              <div className="visual-icon">
                <i className="bi bi-graph-up-arrow"></i>
              </div>
              <div className="visual-text">
                <span className="visual-label">Ahorro Promedio</span>
                <span className="visual-value">30%</span>
              </div>
            </div>
            <div className="visual-card visual-card-secondary">
              <div className="visual-icon">
                <i className="bi bi-clock-history"></i>
              </div>
              <div className="visual-text">
                <span className="visual-label">Tiempo Ahorrado</span>
                <span className="visual-value">2hrs/sem</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-glow"></div>
        <div className="cta-content">
          <h2 className="cta-title">¿Listo para organizar tu hogar?</h2>
          <p className="cta-description">
            Únete a miles de familias que ya están tomando el control de sus finanzas domésticas 
            con FinanzHome. Es gratis, fácil y seguro.
          </p>
          <Link href="/register" className="btn-cta">
            <i className="bi bi-rocket-takeoff"></i>
            Comenzar Ahora - Es Gratis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">
              <i className="bi bi-house-heart-fill"></i>
              <span>FinanzHome</span>
            </div>
            <p className="footer-tagline">
              La plataforma de gestión integral de hogares
            </p>
          </div>
          <div className="footer-links">
            <div className="footer-section">
              <h5>Producto</h5>
              <Link href="/register">Registrarse</Link>
              <Link href="/login">Iniciar Sesión</Link>
              <Link href="/features">Características</Link>
            </div>
            <div className="footer-section">
              <h5>Recursos</h5>
              <a href="#">Ayuda</a>
              <a href="#">Documentación</a>
              <a href="#">API</a>
            </div>
            <div className="footer-section">
              <h5>Legal</h5>
              <a href="#">Términos</a>
              <a href="#">Privacidad</a>
              <a href="#">Cookies</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 FinanzHome. Todos los derechos reservados.</p>
        </div>
      </footer>

      <style jsx>{`
        /* Landing Page Styles */
        .landing-page {
          min-height: 100vh;
          background: var(--og-black);
          color: var(--og-ivory);
        }

        /* Hero Section */
        .hero-section {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 28px;
          position: relative;
          overflow: hidden;
        }

        .hero-bg-pattern {
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(circle at 20% 20%, rgba(212,175,82,0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(212,175,82,0.05) 0%, transparent 50%);
          pointer-events: none;
        }

        .hero-content {
          max-width: 1200px;
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--og-gold-ghost);
          border: 1px solid var(--og-border);
          border-radius: 20px;
          font-size: 12px;
          color: var(--og-gold);
          margin-bottom: 24px;
        }

        .hero-title {
          font-family: var(--og-font-display);
          font-size: 3.5rem;
          font-weight: 600;
          line-height: 1.1;
          margin-bottom: 24px;
          color: var(--og-ivory);
        }

        .hero-title-accent {
          color: var(--og-gold);
          display: block;
        }

        .hero-description {
          font-size: 1.1rem;
          line-height: 1.7;
          color: var(--og-ivory-dim);
          margin-bottom: 32px;
          max-width: 500px;
        }

        .hero-actions {
          display: flex;
          gap: 16px;
          margin-bottom: 48px;
        }

        .btn-hero-primary {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 28px;
          background: var(--og-gold);
          color: var(--og-dark);
          font-weight: 600;
          font-size: 14px;
          border-radius: 10px;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          border: 1px solid transparent;
        }

        .btn-hero-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .btn-hero-primary::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          background: rgba(255,255,255,0.3);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transition: width 0.6s ease, height 0.6s ease;
        }

        .btn-hero-primary:hover {
          background: var(--og-ivory);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(212, 175, 82, 0.4);
          color: var(--og-dark);
          text-decoration: none;
        }

        .btn-hero-primary:hover::before {
          opacity: 1;
        }

        .btn-hero-primary:hover::after {
          width: 300px;
          height: 300px;
        }

        .btn-hero-primary:active {
          transform: translateY(0);
          box-shadow: 0 4px 10px rgba(212, 175, 82, 0.3);
        }

        .btn-hero-secondary {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 28px;
          background: transparent;
          border: 1px solid var(--og-border);
          color: var(--og-ivory);
          font-weight: 500;
          font-size: 14px;
          border-radius: 10px;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .btn-hero-secondary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--og-gold);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
          z-index: -1;
        }

        .btn-hero-secondary:hover {
          border-color: var(--og-gold);
          color: var(--og-dark);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
          text-decoration: none;
        }

        .btn-hero-secondary:hover::before {
          transform: scaleX(1);
        }

        .btn-hero-secondary:active {
          transform: translateY(0);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        .hero-stats {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
        }

        .stat-number {
          font-family: var(--og-font-display);
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--og-gold);
        }

        .stat-label {
          font-size: 11px;
          color: var(--og-ivory-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .stat-divider {
          width: 1px;
          height: 40px;
          background: var(--og-border);
        }

        .hero-visual {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .hero-icon-container {
          width: 280px;
          height: 280px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--og-gold-ghost);
          border: 2px solid var(--og-border);
          border-radius: 50%;
          position: relative;
          z-index: 1;
        }

        .hero-icon-container i {
          font-size: 8rem;
          color: var(--og-gold);
        }

        .hero-glow {
          position: absolute;
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, rgba(212,175,82,0.2) 0%, transparent 70%);
          border-radius: 50%;
          animation: pulse 3s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        /* Features Section */
        .features-section {
          padding: 100px 28px;
          background: var(--og-dark);
        }

        .section-header {
          text-align: center;
          margin-bottom: 60px;
        }

        .section-title {
          font-family: var(--og-font-display);
          font-size: 2.5rem;
          font-weight: 600;
          color: var(--og-ivory);
          margin-bottom: 12px;
        }

        .section-subtitle {
          font-size: 1.1rem;
          color: var(--og-ivory-muted);
        }

        .features-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        .feature-card {
          background: var(--og-surface);
          border: 1px solid var(--og-border);
          border-radius: 16px;
          padding: 32px;
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          border-color: var(--og-gold);
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }

        .feature-icon {
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          margin-bottom: 20px;
        }

        .feature-icon i {
          font-size: 1.8rem;
        }

        .feature-icon-inventory {
          background: rgba(90,144,200,0.15);
          color: #5a90c8;
        }

        .feature-icon-purchases {
          background: rgba(122,184,122,0.15);
          color: #7ab87a;
        }

        .feature-icon-finances {
          background: rgba(212,175,82,0.15);
          color: var(--og-gold);
        }

        .feature-icon-shared {
          background: rgba(200,117,51,0.15);
          color: #c87533;
        }

        .feature-title {
          font-family: var(--og-font-display);
          font-size: 1.3rem;
          font-weight: 600;
          color: var(--og-ivory);
          margin-bottom: 12px;
        }

        .feature-description {
          font-size: 14px;
          line-height: 1.6;
          color: var(--og-ivory-dim);
          margin-bottom: 20px;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .feature-list li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--og-ivory-muted);
          padding: 6px 0;
        }

        .feature-list li i {
          color: var(--og-gold);
          font-size: 12px;
        }

        /* Benefits Section */
        .benefits-section {
          padding: 100px 28px;
          background: var(--og-black);
        }

        .benefits-content {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
        }

        .benefit-item {
          display: flex;
          gap: 20px;
          margin-bottom: 32px;
        }

        .benefit-icon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--og-gold-ghost);
          border: 1px solid var(--og-border);
          border-radius: 12px;
          flex-shrink: 0;
        }

        .benefit-icon i {
          font-size: 1.4rem;
          color: var(--og-gold);
        }

        .benefit-content h4 {
          font-family: var(--og-font-display);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--og-ivory);
          margin-bottom: 6px;
        }

        .benefit-content p {
          font-size: 13px;
          line-height: 1.6;
          color: var(--og-ivory-muted);
          margin: 0;
        }

        .benefits-visual {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .visual-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 28px;
          background: var(--og-surface);
          border: 1px solid var(--og-border);
          border-radius: 16px;
        }

        .visual-card-secondary {
          background: var(--og-gold-ghost);
          border-color: var(--og-gold);
        }

        .visual-icon {
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--og-gold);
          border-radius: 12px;
        }

        .visual-icon i {
          font-size: 1.6rem;
          color: var(--og-dark);
        }

        .visual-text {
          display: flex;
          flex-direction: column;
        }

        .visual-label {
          font-size: 12px;
          color: var(--og-ivory-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .visual-value {
          font-family: var(--og-font-display);
          font-size: 1.8rem;
          font-weight: 600;
          color: var(--og-gold);
        }

        /* CTA Section */
        .cta-section {
          padding: 100px 28px;
          background: var(--og-dark);
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .cta-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(212,175,82,0.15) 0%, transparent 70%);
          pointer-events: none;
        }

        .cta-content {
          position: relative;
          z-index: 1;
          max-width: 600px;
          margin: 0 auto;
        }

        .cta-title {
          font-family: var(--og-font-display);
          font-size: 2.5rem;
          font-weight: 600;
          color: var(--og-ivory);
          margin-bottom: 16px;
        }

        .cta-description {
          font-size: 1.1rem;
          line-height: 1.7;
          color: var(--og-ivory-dim);
          margin-bottom: 32px;
        }

        .btn-cta {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 16px 32px;
          background: var(--og-gold);
          color: var(--og-dark);
          font-weight: 600;
          font-size: 15px;
          border-radius: 12px;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .btn-cta:hover {
          background: var(--og-ivory);
          transform: translateY(-2px);
          color: var(--og-dark);
          text-decoration: none;
        }

        /* Footer */
        .footer {
          padding: 60px 28px 30px;
          background: var(--og-black);
          border-top: 1px solid var(--og-border);
        }

        .footer-content {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 60px;
          margin-bottom: 40px;
        }

        .footer-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--og-font-display);
          font-size: 1.3rem;
          font-weight: 600;
          color: var(--og-gold);
          margin-bottom: 12px;
        }

        .footer-logo i {
          font-size: 1.5rem;
        }

        .footer-tagline {
          font-size: 13px;
          color: var(--og-ivory-muted);
        }

        .footer-links {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
        }

        .footer-section h5 {
          font-family: var(--og-font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--og-ivory);
          margin-bottom: 16px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .footer-section a {
          display: block;
          font-size: 13px;
          color: var(--og-ivory-muted);
          text-decoration: none;
          padding: 6px 0;
          transition: color 0.2s;
        }

        .footer-section a:hover {
          color: var(--og-gold);
        }

        .footer-bottom {
          max-width: 1200px;
          margin: 0 auto;
          padding-top: 30px;
          border-top: 1px solid var(--og-border);
          text-align: center;
        }

        .footer-bottom p {
          font-size: 12px;
          color: var(--og-ivory-muted);
          margin: 0;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .hero-content {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .hero-description {
            max-width: 100%;
          }

          .hero-actions {
            justify-content: center;
          }

          .hero-stats {
            justify-content: center;
          }

          .hero-visual {
            display: none;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .benefits-content {
            grid-template-columns: 1fr;
          }

          .benefits-visual {
            order: -1;
          }
        }

        @media (max-width: 768px) {
          .hero-title {
            font-size: 2.5rem;
          }

          .section-title {
            font-size: 2rem;
          }

          .footer-content {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          .footer-links {
            grid-template-columns: 1fr;
            gap: 30px;
          }
        }
      `}</style>
    </div>
  );
}
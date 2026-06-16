'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useHouseholdStore } from '@/lib/store/household.store';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Link from 'next/link';

/**
 * Página de Dashboard - FinanzHome
 * Panel principal del usuario autenticado
 */
export default function DashboardPage() {
  const { user } = useAuthStore();
  const { currentHousehold, households } = useHouseholdStore();

  return (
    <AuthenticatedLayout>
      <div className="og-page-wrapper">
        {/* Welcome Section */}
        <div className="og-page-header">
          <div className="og-page-header-left">
            <h1 className="og-page-title">
              <i className="bi bi-speedometer2" style={{ marginRight: '8px', color: 'var(--og-gold)' }}></i>
              Dashboard
            </h1>
            <p className="og-page-sub">
              Bienvenido, <strong>{user?.firstName}</strong>! 
              {currentHousehold && (
                <span> | Hogar actual: <strong>{currentHousehold.name}</strong></span>
              )}
            </p>
          </div>
        </div>

        {/* No Household Warning */}
        {households.length === 0 && (
          <div className="og-alert og-alert-warn" style={{ marginBottom: '24px' }}>
            <i className="bi bi-exclamation-triangle"></i>
            <div>
              <h5 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600 }}>
                No tienes hogares
              </h5>
              <p style={{ margin: 0, fontSize: '12px' }}>
                Para comenzar a usar FinanzHome, primero debes crear un hogar. Los hogares
                te permiten organizar tu inventario, compras y finanzas.
              </p>
              <Link href="/households" className="og-btn-primary og-btn-sm" style={{ marginTop: '12px', display: 'inline-flex' }}>
                <i className="bi bi-house-add"></i>
                Crear mi Primer Hogar
              </Link>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="og-grid-4" style={{ marginBottom: '24px' }}>
          <div className="og-stat">
            <div className="og-stat-icon">
              <i className="bi bi-house-fill"></i>
            </div>
            <div className="og-stat-label">Hogares</div>
            <div className="og-stat-value">{households.length}</div>
            <Link href="/households" className="og-btn-ghost og-btn-sm" style={{ marginTop: '12px', display: 'inline-flex' }}>
              Ver Hogares
            </Link>
          </div>

          <div className="og-stat">
            <div className="og-stat-icon">
              <i className="bi bi-box-seam-fill"></i>
            </div>
            <div className="og-stat-label">Productos</div>
            <div className="og-stat-value">0</div>
            <p className="og-text-muted" style={{ fontSize: '10px', margin: '8px 0 0' }}>Próximamente</p>
          </div>

          <div className="og-stat">
            <div className="og-stat-icon">
              <i className="bi bi-cart-fill"></i>
            </div>
            <div className="og-stat-label">Compras</div>
            <div className="og-stat-value">0</div>
            <p className="og-text-muted" style={{ fontSize: '10px', margin: '8px 0 0' }}>Próximamente</p>
          </div>

          <div className="og-stat">
            <div className="og-stat-icon">
              <i className="bi bi-cash-coin"></i>
            </div>
            <div className="og-stat-label">Gastos</div>
            <div className="og-stat-value">$0</div>
            <p className="og-text-muted" style={{ fontSize: '10px', margin: '8px 0 0' }}>Próximamente</p>
          </div>
        </div>

        {/* Quick Actions */}
        {currentHousehold && (
          <div className="og-card">
            <div className="og-card-title">
              <i className="bi bi-lightning" style={{ marginRight: '6px' }}></i>
              Acciones Rápidas
            </div>
            <div className="og-grid-4">
              <button className="og-btn-outline" disabled>
                <i className="bi bi-plus-circle"></i>
                Añadir Producto
              </button>
              <button className="og-btn-outline" disabled>
                <i className="bi bi-cart-plus"></i>
                Registrar Compra
              </button>
              <button className="og-btn-outline" disabled>
                <i className="bi bi-cash-stack"></i>
                Registrar Gasto
              </button>
              <button className="og-btn-outline" disabled>
                <i className="bi bi-file-earmark-bar-graph"></i>
                Ver Reportes
              </button>
            </div>
            <div className="og-alert og-alert-info" style={{ marginTop: '20px', marginBottom: 0 }}>
              <i className="bi bi-info-circle"></i>
              <span><strong>En Desarrollo:</strong> Los módulos funcionales se están implementando.</span>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
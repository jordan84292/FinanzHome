'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { useAuthStore } from '@/lib/store/auth.store';
import { useHouseholdStore } from '@/lib/store/household.store';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const router              = useRouter();
  const { user, isLoading } = useAuthStore();
  const { fetchHouseholds } = useHouseholdStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router, mounted]);

  useEffect(() => {
    if (mounted && user) {
      fetchHouseholds().catch(console.error);
    }
  }, [user, fetchHouseholds, mounted]);

  // SSR: renderiza el spinner para que SSR y cliente coincidan
  if (!mounted || isLoading) {
    return (
      <div className="og-spinner-wrap" role="status" aria-label="Cargando sesión">
        <div className="og-spinner" aria-hidden="true" />
        <span className="og-spinner-text">Verificando sesión…</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="authenticated-layout">
      <Navbar />
      <div className="og-app-body">
        <Sidebar />
        <main
          className="og-main-content"
          id="main-content"
          tabIndex={-1}
          aria-label="Contenido principal"
        >
          <a href="#main-content" className="og-skip-link">
            Saltar al contenido principal
          </a>
          <div className="og-page-wrapper">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
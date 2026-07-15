import type { Metadata } from "next";
import { Fraunces } from 'next/font/google';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.css';
import { Providers } from './providers';
import { BottomNav } from '@/components/BottomNav';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FinanzHome',
  description: 'Inventario, compras y finanzas del hogar',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#0d6efd',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${fraunces.variable} pb-5`}>
        <Providers>
          {children}
          <BottomNav />
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}

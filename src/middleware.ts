import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// Instancia de NextAuth propia para el middleware, construida solo con la
// config edge-safe (sin el provider de Credentials, que arrastra mysql2/DB
// y rompe en el runtime de Edge). Solo se usa para leer/validar el JWT de
// sesión, no para autenticar, así que no necesita providers.
const { auth } = NextAuth(authConfig);

export { auth as middleware };

export const config = {
  matcher: ['/onboarding/:path*', '/hogar/:path*'],
};

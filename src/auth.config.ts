import type { NextAuthConfig } from 'next-auth';

// Config edge-safe: sin providers ni imports que toquen la base de datos
// (mysql2 usa el módulo 'stream' de Node, no soportado en el runtime de Edge
// donde corre el middleware). `auth.ts` extiende esta config agregando el
// provider de Credentials para uso en Server Actions/route handlers (Node runtime).
export const authConfig = {
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

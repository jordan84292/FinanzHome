export { auth as middleware } from '@/auth';

export const config = {
  matcher: ['/onboarding/:path*', '/hogar/:path*'],
};

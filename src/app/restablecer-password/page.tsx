import { checkPasswordResetToken } from '@/lib/db/procedures/password-reset';
import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
        <div className="alert alert-danger" role="alert">Enlace inválido.</div>
      </main>
    );
  }

  let isValid = true;
  try {
    await checkPasswordResetToken(token);
  } catch {
    isValid = false;
  }

  if (!isValid) {
    return (
      <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
        <div className="alert alert-danger" role="alert">
          Este enlace no es válido o ya expiró. Pedí uno nuevo.
        </div>
      </main>
    );
  }

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-4">Elegí tu nueva contraseña</h1>
      <ResetPasswordForm token={token} />
    </main>
  );
}

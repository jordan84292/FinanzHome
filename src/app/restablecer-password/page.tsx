import { checkPasswordResetToken } from '@/lib/db/procedures/password-reset';
import { ResetPasswordForm } from './reset-password-form';
import { AuthShell } from '@/components/auth/AuthShell';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthShell title="Enlace inválido" subtitle="Falta el token de restablecimiento">
        <div className="alert alert-danger mb-0" role="alert">Enlace inválido.</div>
      </AuthShell>
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
      <AuthShell title="Enlace vencido" subtitle="Este enlace ya no es válido">
        <div className="alert alert-danger mb-0" role="alert">
          Este enlace no es válido o ya expiró. Pedí uno nuevo.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Elegí tu nueva contraseña" subtitle="Ingresá una contraseña nueva para tu cuenta">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}

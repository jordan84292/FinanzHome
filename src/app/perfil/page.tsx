import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserProfile } from '@/lib/db/procedures/profile';
import { PaymentScheduleForm } from './payment-schedule-form';
import { logoutAction } from './actions';
import { InstallPromptButton } from '@/components/InstallPromptButton';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const profile = await getUserProfile(Number(session.user.id));

  return (
    <main className="container-fluid px-3 py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-1">Tu perfil</h1>
      <p className="text-body-secondary mb-4">{profile?.email}</p>

      <h2 className="h6 text-body-secondary text-uppercase mb-3">Periodicidad de pago</h2>
      <PaymentScheduleForm profile={profile} />

      <h2 className="h6 text-body-secondary text-uppercase mt-4 mb-3">Tu hogar</h2>
      <Link href="/hogar/miembros" className="btn btn-outline-primary w-100">
        Gestionar miembros del hogar
      </Link>

      <h2 className="h6 text-body-secondary text-uppercase mt-4 mb-3">Instalación</h2>
      <InstallPromptButton />

      <form action={logoutAction} className="mt-5">
        <button type="submit" className="btn btn-outline-danger w-100">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}

'use client';

import { useOnlineStatus } from '@/lib/pwa/use-online-status';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="alert alert-warning text-center rounded-0 mb-0 py-2 small" role="status">
      Estás sin conexión. Podés ver tu última lista de compras, pero no se pueden guardar cambios hasta reconectarte.
    </div>
  );
}

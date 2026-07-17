'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Extiende Navigator con la propiedad no estándar que Safari en iOS expone
// para saber si la PWA ya corre en modo standalone (instalada).
interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

type Platform = 'checking' | 'ios' | 'installable' | 'unsupported' | 'installed';

function detectPlatform(): Platform {
  const nav = window.navigator as NavigatorWithStandalone;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  if (isStandalone) {
    return 'installed';
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIos) {
    return 'ios';
  }

  // Chrome/Edge (desktop y Android) van a disparar 'beforeinstallprompt' si
  // la app cumple los criterios de instalabilidad — se resuelve más abajo.
  // Safari de escritorio y Firefox nunca lo disparan; después de esperar un
  // poco sin verlo, asumimos que no lo soportan.
  return 'checking';
}

export function InstallPromptButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>('checking');

  useEffect(() => {
    setPlatform(detectPlatform());

    function handleBeforeInstallPrompt(event: Event): void {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setPlatform('installable');
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const timeout = setTimeout(() => {
      setPlatform((current) => (current === 'checking' ? 'unsupported' : current));
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(timeout);
    };
  }, []);

  function handleInstall(): void {
    installEvent?.prompt();
    setInstallEvent(null);
  }

  if (platform === 'installed') {
    return <p className="text-success small mb-0">✅ Ya instalaste la app en este dispositivo.</p>;
  }

  if (platform === 'ios') {
    return (
      <div className="border rounded p-3 small">
        <div className="fw-semibold mb-1">Instalar en iPhone/iPad</div>
        <ol className="ps-3 mb-0 text-body-secondary">
          <li>
            Tocá el ícono de compartir <i className="bi bi-box-arrow-up" /> en la barra de Safari.
          </li>
          <li>Elegí &quot;Agregar a pantalla de inicio&quot;.</li>
        </ol>
      </div>
    );
  }

  if (platform === 'installable') {
    return (
      <button type="button" className="btn btn-outline-primary w-100" onClick={handleInstall}>
        <i className="bi bi-download me-1" />
        Instalar app
      </button>
    );
  }

  if (platform === 'unsupported') {
    return (
      <p className="text-body-secondary small mb-0">
        Tu navegador no permite instalar la app directamente. Probá abriendo este sitio con Chrome o Edge.
      </p>
    );
  }

  return null;
}

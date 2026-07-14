'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is a progressive enhancement here, not a hard requirement —
        // a failed registration shouldn't break the app.
      });
    }
  }, []);

  return null;
}

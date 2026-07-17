# Fase 4 — PWA offline para la lista de compras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** poder ver la última lista de compras confirmada/abierta sin señal, dentro del supermercado — el caso de uso ancla de todo el diseño PWA de este proyecto.

**Architecture:** el service worker (ya registrado desde Fase 0a, actualmente un esqueleto vacío) gana un `fetch` handler con estrategia *stale-while-revalidate* sobre un único endpoint de solo lectura, `GET /api/shopping-list/current`. La UI de `/compras` detecta `navigator.onLine`, deshabilita toda mutación (agregar/editar/eliminar ítem, confirmar compra) mientras está offline, y — si detecta que está offline — vuelve a pedir los datos a ese mismo endpoint (que el service worker sirve desde cache) para refrescar lo que muestra. Un componente aparte (`InstallPromptButton`) captura `beforeinstallprompt` para ofrecer instalar la PWA.

**Tech Stack:** el mismo de siempre — Next.js 16 (App Router, Route Handlers), React 19, Service Worker API nativo (sin `next-pwa` ni Workbox — el service worker ya existente en este proyecto es manual, se extiende a mano). No hay stored procedures nuevos ni tablas nuevas en esta fase.

## Global Constraints

- **No hay SPs ni tablas nuevas** — esta fase es 100% capa de cliente/infraestructura de plataforma, reutiliza `getShoppingList`/`getShoppingListItems`/`generateOrGetShoppingList` de Fase 2 sin modificarlos.
- **Mobile-first / PWA como entrega principal** (Global Constraint del plan maestro): esta fase es, literalmente, la entrega de esa promesa — cualquier decisión de diseño debe favorecer que funcione bien en un celular real dentro de un supermercado sin señal.
- **`tsc --noEmit` obligatorio** además de `npm test` y `npm run build` en cada tarea.
- **Sin tests automatizados de browser/service-worker** — este proyecto no tiene infraestructura de testing de Service Workers (no hay Playwright ni similar). La verificación de esta fase es manual (DevTools → Application → Service Workers / Network → Offline), documentada explícitamente en cada tarea que lo requiera. Esto es una desviación deliberada de la convención de tests reales del proyecto, justificada porque no hay una herramienta de test para esta capa — no inventar una para esta fase.
- **El service worker ya existe y ya está registrado** (`public/sw.js`, `src/components/ServiceWorkerRegister.tsx`, enlazado desde `src/app/layout.tsx` vía `manifest: '/manifest.json'`) — esta fase lo EXTIENDE, no lo crea desde cero. No tocar `ServiceWorkerRegister.tsx` (el registro en sí ya funciona).

---

## Contexto que el implementador necesita conocer

**Estado actual de la infraestructura PWA (ya existe, de una fase anterior):**
- `public/manifest.json` — existe, pero tiene colores **desactualizados** del tema claro original (`background_color: "#ffffff"`, `theme_color: "#0d6efd"`), de antes del pivot a tema oscuro de Fase 1b. Esta fase lo corrige.
- `public/sw.js` — existe, pero es un esqueleto vacío (solo `install`/`activate`, sin `fetch` handler):
  ```js
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });
  ```
- `src/components/ServiceWorkerRegister.tsx` — ya registra `/sw.js` desde el cliente, con manejo de error silencioso (offline es progressive enhancement). No se modifica.
- `src/app/layout.tsx` — ya tiene `data-bs-theme="dark"`, `viewport.themeColor: '#1E1B3A'` (correcto, ya alineado al tema oscuro — es `manifest.json` el que quedó desactualizado, no el layout).

**`src/lib/household/require-membership.ts` (ya existe, no se modifica):**
```ts
import { auth } from '@/auth';
import { getHouseholdsForUser, type HouseholdForUserRecord } from '@/lib/db/procedures/household';

export async function requireMembership(): Promise<HouseholdForUserRecord> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('No autenticado');
  }
  const [membership] = await getHouseholdsForUser(Number(session.user.id));
  if (!membership) {
    throw new Error('No pertenecés a ningún hogar todavía');
  }
  return membership;
}
```
Es una función común (no `'use server'`), así que se puede importar y llamar tanto desde Server Actions como desde un Route Handler — no está atada a ninguno de los dos.

**`src/lib/db/procedures/shopping-list.ts` (ya existe, Fase 2, no se modifica):**
```ts
export async function generateOrGetShoppingList(householdId: number, createdByMemberId: number): Promise<ShoppingListRecord>
export async function getShoppingList(shoppingListId: number, householdId: number, displayCurrencyId: number): Promise<ShoppingListRecord>
export async function getShoppingListItems(shoppingListId: number, householdId: number, displayCurrencyId: number): Promise<ShoppingListItemRecord[]>
```

**`src/app/compras/page.tsx` (ya existe, no se modifica en esta fase):** ya usa exactamente esta misma secuencia (`generateOrGetShoppingList` → `getShoppingList` + `getShoppingListItems` en paralelo) con `DISPLAY_CURRENCY_ID = 1`. El Route Handler de esta fase reutiliza la misma secuencia detrás de una URL fija, para que el service worker tenga un único endpoint estable que cachear.

**`src/app/compras/shopping-list-client.tsx` (ya existe, Fase 2 + Fase 3, se modifica en Task 3):** componente cliente que recibe `list`/`items` como props desde el servidor y maneja el panel de agregar/editar, la lista, el total, `ConfirmPurchaseButton` y (desde Fase 3) `SplitPanel`. Estado actual completo:
```tsx
'use client';

import { useState } from 'react';
import { ShoppingListItemRow } from '@/components/shopping-list/ShoppingListItemRow';
import { ShoppingListItemForm } from '@/components/shopping-list/ShoppingListItemForm';
import { ConfirmPurchaseButton } from './confirm-purchase-button';
import { SplitPanel } from '@/components/shopping-list/SplitPanel';
import type { ProductRecord } from '@/lib/db/procedures/products';
import type { ShoppingListItemRecord, ShoppingListRecord } from '@/lib/db/procedures/shopping-list';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

export function ShoppingListClient({
  list,
  items,
  products,
  currencies,
  displayCurrencySymbol,
}: {
  list: ShoppingListRecord;
  items: ShoppingListItemRecord[];
  products: ProductRecord[];
  currencies: CurrencyRecord[];
  displayCurrencySymbol: string;
}) {
  const [panel, setPanel] = useState<{ mode: 'add' } | { mode: 'edit'; item: ShoppingListItemRecord } | null>(
    null,
  );
  const [confirmedListId, setConfirmedListId] = useState<number | null>(null);

  return (
    <main className="container-fluid px-3 py-4 pb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Lista de compras</h1>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPanel({ mode: 'add' })}>
          <i className="bi bi-plus-lg me-1" />
          Producto
        </button>
      </div>

      <ul className="list-group mb-4">
        {items.map((item) => (
          <ShoppingListItemRow key={item.id} item={item} onEdit={() => setPanel({ mode: 'edit', item })} />
        ))}
      </ul>

      {items.length === 0 ? (
        <p className="text-body-secondary">No falta nada por ahora — tu inventario está al día.</p>
      ) : null}

      {panel ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1050 }}
        >
          <div className="bg-body w-100 p-3 rounded-top-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">{panel.mode === 'add' ? 'Agregar producto' : 'Editar producto'}</h2>
              <button type="button" className="btn-close" onClick={() => setPanel(null)} aria-label="Cerrar" />
            </div>
            <ShoppingListItemForm
              mode={panel.mode}
              shoppingListId={list.id}
              item={panel.mode === 'edit' ? panel.item : undefined}
              products={products}
              currencies={currencies}
            />
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div
          className="position-fixed bottom-0 start-0 w-100 bg-body border-top p-3 d-flex justify-content-between align-items-center"
          style={{ zIndex: 1040 }}
        >
          <div>
            <div className="text-body-secondary small">Total estimado</div>
            <div className="h5 mb-0">
              {displayCurrencySymbol}
              {list.total_estimated_live ?? 0}
            </div>
          </div>
          <ConfirmPurchaseButton shoppingListId={list.id} onConfirmed={setConfirmedListId} />
        </div>
      ) : null}

      {confirmedListId ? (
        <SplitPanel shoppingListId={confirmedListId} onClose={() => setConfirmedListId(null)} />
      ) : null}
    </main>
  );
}
```

**`src/app/compras/confirm-purchase-button.tsx` (ya existe, se modifica en Task 3):**
```tsx
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPurchaseAction } from './actions';
import { showError, showSuccess } from '@/lib/ui/alerts';

export function ConfirmPurchaseButton({
  shoppingListId,
  onConfirmed,
}: {
  shoppingListId: number;
  onConfirmed: (shoppingListId: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm(): void {
    startTransition(() => {
      confirmPurchaseAction(shoppingListId)
        .then((result) => {
          if (result.error) {
            showError(result.error);
            return;
          }
          showSuccess('Compra confirmada. Tu inventario se actualizó.');
          onConfirmed(shoppingListId);
          router.refresh();
        })
        .catch(() => {
          showError('No se pudo confirmar la compra. Intentá de nuevo.');
        });
    });
  }

  return (
    <button type="button" className="btn btn-primary" disabled={isPending} onClick={handleConfirm}>
      {isPending ? 'Confirmando…' : 'Confirmar compra'}
    </button>
  );
}
```

**`src/components/shopping-list/ShoppingListItemRow.tsx` (ya existe, se modifica en Task 3):**
```tsx
'use client';

import { useTransition } from 'react';
import { deleteItemAction } from '@/app/compras/actions';
import { showError } from '@/lib/ui/alerts';
import type { ShoppingListItemRecord } from '@/lib/db/procedures/shopping-list';

export function ShoppingListItemRow({
  item,
  onEdit,
}: {
  item: ShoppingListItemRecord;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(): void {
    startTransition(() => {
      deleteItemAction(item.id).catch(() => {
        showError('No se pudo eliminar el producto. Intentá de nuevo.');
      });
    });
  }

  return (
    <li className="list-group-item d-flex justify-content-between align-items-center">
      <button
        type="button"
        className="btn btn-link text-start text-decoration-none p-0 flex-grow-1 text-body"
        onClick={onEdit}
      >
        <div className="fw-semibold">
          {item.product_name}
          {item.is_extra ? <span className="badge text-bg-secondary ms-2">Extra</span> : null}
        </div>
        <div className="text-body-secondary small">
          {item.quantity_needed} {item.unit_code}
          {item.unit_price !== null
            ? ` · ${item.unit_price_currency_symbol ?? ''}${item.unit_price} c/u`
            : ' · sin precio'}
        </div>
      </button>
      <button
        type="button"
        className="btn btn-outline-danger btn-sm"
        disabled={isPending}
        onClick={handleDelete}
        aria-label="Eliminar"
      >
        <i className="bi bi-trash" />
      </button>
    </li>
  );
}
```

**`src/app/layout.tsx` (ya existe, se modifica en Task 2):**
```tsx
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
  themeColor: '#1E1B3A',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-bs-theme="dark">
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
```

**`src/app/perfil/page.tsx` (ya existe, se modifica en Task 3):**
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getUserProfile } from '@/lib/db/procedures/profile';
import { PaymentScheduleForm } from './payment-schedule-form';
import { logoutAction } from './actions';

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

      <form action={logoutAction} className="mt-5">
        <button type="submit" className="btn btn-outline-danger w-100">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
```

---

## Task 1: Route Handler de solo lectura + service worker con stale-while-revalidate + fix de `manifest.json`

**Files:**
- Create: `src/app/api/shopping-list/current/route.ts`
- Modify: `public/sw.js`
- Modify: `public/manifest.json`

**Interfaces:**
- Consumes: `requireMembership` (`@/lib/household/require-membership`), `generateOrGetShoppingList`/`getShoppingList`/`getShoppingListItems` (`@/lib/db/procedures/shopping-list`).
- Produces: `GET /api/shopping-list/current` → `{ list: ShoppingListRecord, items: ShoppingListItemRecord[] }` on success (200) o `{ error: string }` (401) — consumido por Task 3's fetch offline y por el service worker de esta misma tarea.

- [ ] **Step 1: Route Handler**

`src/app/api/shopping-list/current/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { requireMembership } from '@/lib/household/require-membership';
import {
  generateOrGetShoppingList,
  getShoppingList,
  getShoppingListItems,
} from '@/lib/db/procedures/shopping-list';

const DISPLAY_CURRENCY_ID = 1; // CRC — coincide con /compras/page.tsx

export async function GET() {
  try {
    const membership = await requireMembership();
    const generated = await generateOrGetShoppingList(membership.id, membership.member_id);

    const [list, items] = await Promise.all([
      getShoppingList(generated.id, membership.id, DISPLAY_CURRENCY_ID),
      getShoppingListItems(generated.id, membership.id, DISPLAY_CURRENCY_ID),
    ]);

    return NextResponse.json({ list, items });
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la lista de compras' }, { status: 401 });
  }
}
```
Nota: usa la misma secuencia de llamadas que `src/app/compras/page.tsx` ya usa hoy, detrás de una URL fija y estable — necesario para que el service worker tenga un único recurso que cachear (no puede cachear inteligentemente algo con parámetros variables sin más lógica). El 401 en el catch cubre tanto "no autenticado" como "sin hogar todavía" — el service worker nunca debe cachear una respuesta de error (ver Step 2).

- [ ] **Step 2: Service worker con `fetch` handler (stale-while-revalidate)**

Reemplazar el contenido completo de `public/sw.js`:
```js
const SHOPPING_LIST_CACHE = 'finanzhome-shopping-list-v1';
const SHOPPING_LIST_PATH = '/api/shopping-list/current';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname !== SHOPPING_LIST_PATH) {
    return;
  }

  event.respondWith(
    caches.open(SHOPPING_LIST_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);

      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});
```
Notas:
- Solo intercepta `GET /api/shopping-list/current` — cualquier otra request (navegación de páginas, otros assets, otras API) pasa de largo sin que el `fetch` handler llame `respondWith`, así que el navegador la maneja normalmente. Esto es deliberado: esta fase no cachea el "app shell" completo, solo este endpoint puntual (ver Global Constraints del plan maestro sobre el alcance de esta fase).
- Solo cachea respuestas `response.ok` (200) — nunca una respuesta 401 del Step 1, así que un usuario sin sesión válida nunca "atrapa" un error en cache.
- *Stale-while-revalidate* real: si hay algo en cache, se devuelve inmediatamente (`cached`) mientras la promesa `network` sigue corriendo en segundo plano actualizando el cache para la próxima vez. Si no hay nada en cache todavía (primera visita), se espera la red (`network`); si la red falla y tampoco hay cache, `network` resuelve a `cached` (`undefined`), y el `fetch` del cliente recibirá una respuesta fallida — manejado del lado del cliente en Task 3.

- [ ] **Step 3: Corregir los colores de `manifest.json` al tema oscuro actual**

Reemplazar el contenido completo de `public/manifest.json`:
```json
{
  "name": "FinanzHome",
  "short_name": "FinanzHome",
  "description": "Inventario, compras y finanzas del hogar",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1E1B3A",
  "theme_color": "#1E1B3A",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
`background_color`/`theme_color` quedaban en el azul de Bootstrap por defecto (`#0d6efd`) y blanco (`#ffffff`) de antes del pivot a tema oscuro de Fase 1b — desalineados con `layout.tsx`'s `viewport.themeColor: '#1E1B3A'` (ya correcto). Ahora ambos coinciden, así que la pantalla de splash al abrir la PWA instalada usa el color correcto en vez de un blanco/azul que no coincide con el resto de la app.

- [ ] **Step 4: Build y tipos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores; `ƒ /api/shopping-list/current` aparece en la tabla de rutas (dinámica, ya que usa `auth()`/cookies).

- [ ] **Step 5: Suite completa**

Run: `npm test`
Expected: sin regresión (esta tarea no agrega tests automatizados — no hay infraestructura de test de Service Worker en este proyecto, ver Global Constraints).

- [ ] **Step 6: Verificación manual (obligatoria)**

Con `npm run dev` corriendo y MariaDB (XAMPP, puerto 3307) activo:
1. Con una sesión real (curl csrf+credentials o navegador), `GET /api/shopping-list/current` → debe devolver `200` con `{ list, items }` reales para el hogar del usuario autenticado.
2. Sin sesión (sin cookie), `GET /api/shopping-list/current` → debe devolver `401` con `{ error: "..." }`.
3. En un navegador real (no hace falta automatización, alcanza con DevTools): abrir `/compras` una vez con red activa (para que el `ServiceWorkerRegister` ya existente registre el SW y quede activo), confirmar en DevTools → Application → Service Workers que está "activated and running". Confirmar en DevTools → Application → Cache Storage que aparece `finanzhome-shopping-list-v1` con una entrada para `/api/shopping-list/current` después de que la página cargó los datos al menos una vez (nota: esto requiere que algo del lado del cliente haga un `fetch` real a esa URL — si nada lo hace todavía en esta tarea, está bien, ese fetch se agrega recién en Task 3; para probar el SW en esta tarea alcanza con pegarle a la URL manualmente desde la consola del navegador: `fetch('/api/shopping-list/current')`, y confirmar que aparece en Cache Storage después).
4. Con DevTools → Network → Offline activado, repetir `fetch('/api/shopping-list/current')` desde la consola → debe devolver el contenido cacheado (si ya se cacheó en el paso anterior) en vez de fallar.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/shopping-list/current/route.ts public/sw.js public/manifest.json
git commit -m "feat(pwa): add cached shopping-list endpoint with stale-while-revalidate service worker"
```

---

## Task 2: Detección de estado online/offline + banner global

**Files:**
- Create: `src/lib/pwa/use-online-status.ts`
- Create: `src/components/OfflineBanner.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `useOnlineStatus(): boolean` (`@/lib/pwa/use-online-status`) — usado por `OfflineBanner` en esta misma tarea y por `ShoppingListClient` en Task 3.

- [ ] **Step 1: Hook de estado online/offline**

`src/lib/pwa/use-online-status.ts`:
```ts
'use client';

import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline(): void {
      setIsOnline(true);
    }
    function handleOffline(): void {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```
Nota: el estado inicial es `true` (no se puede leer `navigator.onLine` durante el render del servidor) y se corrige apenas el componente se monta en el cliente vía `useEffect` — evita un mismatch de hidratación entre servidor y cliente.

- [ ] **Step 2: Componente `OfflineBanner`**

`src/components/OfflineBanner.tsx`:
```tsx
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
```

- [ ] **Step 3: Enganchar en el layout raíz**

Modificar `src/app/layout.tsx` — agregar el import y renderizar `<OfflineBanner />` como primer hijo dentro de `<Providers>`, antes de `{children}`:
```tsx
import type { Metadata } from "next";
import { Fraunces } from 'next/font/google';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './globals.css';
import { Providers } from './providers';
import { BottomNav } from '@/components/BottomNav';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { OfflineBanner } from '@/components/OfflineBanner';

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
  themeColor: '#1E1B3A',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-bs-theme="dark">
      <body className={`${fraunces.variable} pb-5`}>
        <Providers>
          <OfflineBanner />
          {children}
          <BottomNav />
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Build y tipos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 5: Suite completa**

Run: `npm test`
Expected: sin regresión.

- [ ] **Step 6: Verificación manual**

Con `npm run dev` corriendo, abrir cualquier página en un navegador real, activar DevTools → Network → Offline → el banner amarillo debe aparecer arriba de todo en menos de un segundo. Desactivar "Offline" → el banner debe desaparecer.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pwa/use-online-status.ts src/components/OfflineBanner.tsx src/app/layout.tsx
git commit -m "feat(pwa): add global offline banner"
```

---

## Task 3: `/compras` lee de cache offline + deshabilita mutaciones + prompt de instalación

**Files:**
- Modify: `src/app/compras/shopping-list-client.tsx`
- Modify: `src/app/compras/confirm-purchase-button.tsx`
- Modify: `src/components/shopping-list/ShoppingListItemRow.tsx`
- Create: `src/components/InstallPromptButton.tsx`
- Modify: `src/app/perfil/page.tsx`

**Interfaces:**
- Consumes: `useOnlineStatus` (Task 2), `GET /api/shopping-list/current` (Task 1).

No hay tests automatizados nuevos en esta tarea (UI/wiring, misma convención de fases anteriores). Verificación manual obligatoria dado que es el punto central de la fase.

- [ ] **Step 1: `ShoppingListClient` lee del endpoint cacheado cuando está offline y deshabilita mutaciones**

Reemplazar el contenido completo de `src/app/compras/shopping-list-client.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { ShoppingListItemRow } from '@/components/shopping-list/ShoppingListItemRow';
import { ShoppingListItemForm } from '@/components/shopping-list/ShoppingListItemForm';
import { ConfirmPurchaseButton } from './confirm-purchase-button';
import { SplitPanel } from '@/components/shopping-list/SplitPanel';
import { useOnlineStatus } from '@/lib/pwa/use-online-status';
import type { ProductRecord } from '@/lib/db/procedures/products';
import type { ShoppingListItemRecord, ShoppingListRecord } from '@/lib/db/procedures/shopping-list';
import type { CurrencyRecord } from '@/lib/db/procedures/currency';

export function ShoppingListClient({
  list,
  items,
  products,
  currencies,
  displayCurrencySymbol,
}: {
  list: ShoppingListRecord;
  items: ShoppingListItemRecord[];
  products: ProductRecord[];
  currencies: CurrencyRecord[];
  displayCurrencySymbol: string;
}) {
  const [panel, setPanel] = useState<{ mode: 'add' } | { mode: 'edit'; item: ShoppingListItemRecord } | null>(
    null,
  );
  const [confirmedListId, setConfirmedListId] = useState<number | null>(null);
  const [liveList, setLiveList] = useState(list);
  const [liveItems, setLiveItems] = useState(items);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (isOnline) {
      return;
    }
    fetch('/api/shopping-list/current')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          setLiveList(data.list);
          setLiveItems(data.items);
        }
      })
      .catch(() => {
        // Sin red y sin nada en cache todavía — nos quedamos con lo último
        // que ya se renderizó desde el servidor.
      });
  }, [isOnline]);

  return (
    <main className="container-fluid px-3 py-4 pb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">Lista de compras</h1>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!isOnline}
          onClick={() => setPanel({ mode: 'add' })}
        >
          <i className="bi bi-plus-lg me-1" />
          Producto
        </button>
      </div>

      <ul className="list-group mb-4">
        {liveItems.map((item) => (
          <ShoppingListItemRow
            key={item.id}
            item={item}
            disabled={!isOnline}
            onEdit={() => setPanel({ mode: 'edit', item })}
          />
        ))}
      </ul>

      {liveItems.length === 0 ? (
        <p className="text-body-secondary">No falta nada por ahora — tu inventario está al día.</p>
      ) : null}

      {panel ? (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-end"
          style={{ zIndex: 1050 }}
        >
          <div className="bg-body w-100 p-3 rounded-top-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">{panel.mode === 'add' ? 'Agregar producto' : 'Editar producto'}</h2>
              <button type="button" className="btn-close" onClick={() => setPanel(null)} aria-label="Cerrar" />
            </div>
            <ShoppingListItemForm
              mode={panel.mode}
              shoppingListId={liveList.id}
              item={panel.mode === 'edit' ? panel.item : undefined}
              products={products}
              currencies={currencies}
            />
          </div>
        </div>
      ) : null}

      {liveItems.length > 0 ? (
        <div
          className="position-fixed bottom-0 start-0 w-100 bg-body border-top p-3 d-flex justify-content-between align-items-center"
          style={{ zIndex: 1040 }}
        >
          <div>
            <div className="text-body-secondary small">Total estimado</div>
            <div className="h5 mb-0">
              {displayCurrencySymbol}
              {liveList.total_estimated_live ?? 0}
            </div>
          </div>
          <ConfirmPurchaseButton
            shoppingListId={liveList.id}
            disabled={!isOnline}
            onConfirmed={setConfirmedListId}
          />
        </div>
      ) : null}

      {confirmedListId ? (
        <SplitPanel shoppingListId={confirmedListId} onClose={() => setConfirmedListId(null)} />
      ) : null}
    </main>
  );
}
```
Notas de diseño:
- `liveList`/`liveItems` reemplazan las props `list`/`items` en todo el render — inicializados desde las props (lo que el servidor ya renderizó), y solo se sobreescriben si el `useEffect` detecta que está offline y logra traer algo del endpoint cacheado (útil si el usuario reabre `/compras` estando ya sin señal, por ejemplo al reabrir la PWA).
- Cada control mutante (`+ Producto`, editar/eliminar por ítem, `Confirmar compra`) recibe `disabled={!isOnline}` — no se intenta deshabilitar el `ShoppingListItemForm` en sí, porque directamente no se puede abrir el panel que lo contiene mientras el botón que lo abre está deshabilitado.

- [ ] **Step 2: `ConfirmPurchaseButton` acepta `disabled`**

Modificar `src/app/compras/confirm-purchase-button.tsx`:
```tsx
'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPurchaseAction } from './actions';
import { showError, showSuccess } from '@/lib/ui/alerts';

export function ConfirmPurchaseButton({
  shoppingListId,
  disabled = false,
  onConfirmed,
}: {
  shoppingListId: number;
  disabled?: boolean;
  onConfirmed: (shoppingListId: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm(): void {
    startTransition(() => {
      confirmPurchaseAction(shoppingListId)
        .then((result) => {
          if (result.error) {
            showError(result.error);
            return;
          }
          showSuccess('Compra confirmada. Tu inventario se actualizó.');
          onConfirmed(shoppingListId);
          router.refresh();
        })
        .catch(() => {
          showError('No se pudo confirmar la compra. Intentá de nuevo.');
        });
    });
  }

  return (
    <button type="button" className="btn btn-primary" disabled={disabled || isPending} onClick={handleConfirm}>
      {isPending ? 'Confirmando…' : 'Confirmar compra'}
    </button>
  );
}
```

- [ ] **Step 3: `ShoppingListItemRow` acepta `disabled`**

Modificar `src/components/shopping-list/ShoppingListItemRow.tsx`:
```tsx
'use client';

import { useTransition } from 'react';
import { deleteItemAction } from '@/app/compras/actions';
import { showError } from '@/lib/ui/alerts';
import type { ShoppingListItemRecord } from '@/lib/db/procedures/shopping-list';

export function ShoppingListItemRow({
  item,
  disabled = false,
  onEdit,
}: {
  item: ShoppingListItemRecord;
  disabled?: boolean;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(): void {
    startTransition(() => {
      deleteItemAction(item.id).catch(() => {
        showError('No se pudo eliminar el producto. Intentá de nuevo.');
      });
    });
  }

  return (
    <li className="list-group-item d-flex justify-content-between align-items-center">
      <button
        type="button"
        className="btn btn-link text-start text-decoration-none p-0 flex-grow-1 text-body"
        disabled={disabled}
        onClick={onEdit}
      >
        <div className="fw-semibold">
          {item.product_name}
          {item.is_extra ? <span className="badge text-bg-secondary ms-2">Extra</span> : null}
        </div>
        <div className="text-body-secondary small">
          {item.quantity_needed} {item.unit_code}
          {item.unit_price !== null
            ? ` · ${item.unit_price_currency_symbol ?? ''}${item.unit_price} c/u`
            : ' · sin precio'}
        </div>
      </button>
      <button
        type="button"
        className="btn btn-outline-danger btn-sm"
        disabled={disabled || isPending}
        onClick={handleDelete}
        aria-label="Eliminar"
      >
        <i className="bi bi-trash" />
      </button>
    </li>
  );
}
```

- [ ] **Step 4: Componente `InstallPromptButton`**

`src/components/InstallPromptButton.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPromptButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event): void {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  if (!installEvent) {
    return null;
  }

  function handleInstall(): void {
    installEvent?.prompt();
    setInstallEvent(null);
  }

  return (
    <button type="button" className="btn btn-outline-primary w-100" onClick={handleInstall}>
      <i className="bi bi-download me-1" />
      Instalar app
    </button>
  );
}
```
Nota: el navegador solo dispara `beforeinstallprompt` si la PWA cumple los criterios de instalabilidad (manifest válido, service worker activo, servido por HTTPS o localhost) y todavía no está instalada — por eso el componente devuelve `null` hasta que el evento realmente llega, y no hay forma de "forzar" que aparezca en un navegador que ya la tiene instalada o que decidió no ofrecerlo.

- [ ] **Step 5: Enganchar `InstallPromptButton` en `/perfil`**

Modificar `src/app/perfil/page.tsx` — agregar el import y renderizar el botón en una sección nueva, después de "Tu hogar" y antes del botón de cerrar sesión:
```tsx
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
```

- [ ] **Step 6: Build y tipos**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores; `/compras` y `/perfil` siguen compilando.

- [ ] **Step 7: Suite completa**

Run: `npm test`
Expected: sin regresión.

- [ ] **Step 8: Verificación manual end-to-end (obligatoria)**

Con `npm run dev` corriendo y MariaDB activo, en un navegador real:
1. Con red activa, abrir `/compras`, confirmar que carga normalmente y que el service worker ya cacheó `/api/shopping-list/current` (DevTools → Application → Cache Storage).
2. Activar DevTools → Network → Offline.
3. El banner de "Estás sin conexión" (Task 2) debe aparecer.
4. En `/compras`: el botón "+ Producto" debe verse deshabilitado; cada ítem debe tener su botón de editar/eliminar deshabilitado; "Confirmar compra" debe verse deshabilitado.
5. Recargar la página (F5) estando offline: la página debe seguir mostrando la última lista conocida (vía el `fetch` a `/api/shopping-list/current`, servido por el service worker desde cache) en vez de una pantalla en blanco o un error — nota: la propia navegación HTML de `/compras` puede fallar si el navegador no tiene el documento en su cache HTTP habitual; si eso ocurre, dejarlo documentado como una limitación conocida y esperada de esta fase (el plan solo cubre cachear el endpoint de datos, no el documento HTML completo — ver Global Constraints).
6. Desactivar "Offline" → el banner debe desaparecer y los controles deben volver a estar habilitados.
7. Confirmar que `InstallPromptButton` en `/perfil` no rompe la página cuando el navegador no dispara `beforeinstallprompt` (comportamiento esperado en la mayoría de sesiones de desarrollo/testing) — no debe aparecer nada ni tirar un error en consola.

- [ ] **Step 9: Commit**

```bash
git add src/app/compras/shopping-list-client.tsx src/app/compras/confirm-purchase-button.tsx src/components/shopping-list/ShoppingListItemRow.tsx src/components/InstallPromptButton.tsx src/app/perfil/page.tsx
git commit -m "feat(pwa): disable mutations offline, read from cache, add install prompt"
```

---

## Cierre de fase

Después de Task 3: correr `npm test` + `npm run build` + `npx tsc --noEmit` una vez más sobre el estado final del branch, luego usar `superpowers:subagent-driven-development`'s paso de revisión final de todo el branch (modelo más capaz) antes de ofrecer el merge a `main`, igual que en fases anteriores. Prestar especial atención en esa revisión final a que el service worker nunca intercepte ni cachee accidentalmente rutas que no sean `/api/shopping-list/current` (por ejemplo, Server Actions, `/api/auth/*`, u otras páginas) — un `fetch` handler de service worker mal acotado es un error fácil de cometer y caro de diagnosticar después.

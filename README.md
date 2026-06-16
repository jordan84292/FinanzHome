# FinanzHome - Frontend

Plataforma Web Progresiva (PWA) para la gestión integral de hogares.

## 🚀 Tecnologías

- **Next.js 15** - React Framework con App Router
- **React 19** - Biblioteca UI
- **TypeScript 5** - Type Safety
- **Bootstrap 5** - Framework CSS (próximo a instalar)
- **Zustand** - State Management (próximo a instalar)
- **Axios** - HTTP Client (próximo a instalar)

## 🎯 Características

### PWA (Progressive Web App)
- ✅ Instalable en dispositivos móviles y desktop
- ✅ Funciona offline con Service Workers
- ✅ Notificaciones push
- ✅ Actualizaciones automáticas

### Módulos Funcionales
- 🏠 **Gestión de Hogares** - Crear y administrar múltiples hogares
- 📦 **Inventario** - Control de productos y stock
- 🛒 **Compras** - Registro de compras con comparación de precios
- 💰 **Finanzas Personales** - Ingresos, gastos y presupuestos
- 🤝 **Finanzas Compartidas** - Gastos compartidos y deudas
- 💎 **Ahorros** - Metas de ahorro y contribuciones
- 📊 **Reportes** - Análisis y gráficos
- 📈 **Dashboard** - Panel de control personalizado

### Seguridad
- 🔐 Autenticación JWT + Refresh Token
- 👥 RBAC Multi-hogar (Owner/Admin/Member)
- 🍪 HttpOnly Cookies
- 🔒 HTTPS Only

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Compilar para producción
npm run build

# Ejecutar en producción
npm start
```

## 🌐 Puertos

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs

## 📁 Estructura

```
frontend/
├── app/                    # App Router (Next.js 15)
│   ├── layout.tsx         # Layout raíz
│   ├── page.tsx           # Página de inicio
│   ├── globals.css        # Estilos globales
│   ├── (auth)/            # Rutas de autenticación
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/       # Rutas protegidas
│   │   ├── dashboard/
│   │   ├── households/
│   │   ├── inventory/
│   │   ├── purchases/
│   │   ├── finances/
│   │   └── reports/
│   └── api/               # API Routes (si necesario)
├── components/            # Componentes reutilizables
│   ├── ui/               # Componentes UI base
│   ├── layout/           # Navbar, Sidebar, Footer
│   └── modules/          # Componentes por módulo
├── lib/                  # Utilidades y configuración
│   ├── api/             # Servicios API
│   ├── store/           # Zustand stores
│   └── utils/           # Funciones auxiliares
├── public/              # Archivos estáticos
│   ├── icons/
│   ├── manifest.json    # PWA manifest
│   └── sw.js           # Service Worker
└── types/              # TypeScript types

```

## 🔧 Variables de Entorno

Crear archivo `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_APP_NAME=FinanzHome
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## 📦 Próximos Pasos

- [ ] Instalar Bootstrap 5
- [ ] Instalar Zustand para state management
- [ ] Configurar Axios para llamadas API
- [ ] Implementar servicios de autenticación
- [ ] Crear componentes de layout
- [ ] Implementar páginas de login/registro
- [ ] Configurar PWA con Service Workers
- [ ] Implementar módulos funcionales

## 🎨 Diseño

- **Framework CSS**: Bootstrap 5
- **Tema**: Responsive y moderno
- **Colores**: Esquema profesional
- **Iconos**: Bootstrap Icons

## 📱 Compatibilidad

- ✅ Chrome/Edge (últimas 2 versiones)
- ✅ Firefox (últimas 2 versiones)
- ✅ Safari (últimas 2 versiones)
- ✅ iOS Safari 13+
- ✅ Android Chrome 90+

## 📄 Licencia

Privado - FinanzHome © 2026

# FinanzHome

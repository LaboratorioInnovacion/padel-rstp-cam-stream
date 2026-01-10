# 🎥 Stream Agent - Arquitectura Modular

## 📁 Estructura de Componentes

La aplicación ha sido refactorizada en una arquitectura modular para facilitar el mantenimiento y escalabilidad.

### Componentes Principales

```
src/renderer/
├── components/
│   ├── Header.jsx              # Cabecera con información de ubicación
│   ├── StatusCard.jsx          # Estado del sistema (activo/detenido)
│   ├── StatisticsPanel.jsx     # Panel de estadísticas del sistema
│   ├── PublicURLPanel.jsx      # Panel de URL pública del túnel
│   ├── ErrorBanner.jsx         # Banner de errores con acciones
│   ├── ControlButtons.jsx      # Botones de control principal
│   └── CameraList.jsx          # Lista y gestión de cámaras
├── styles/
│   └── globals.css             # Estilos globales con Tailwind
├── App.jsx                     # Componente principal orquestador
└── index.jsx                   # Punto de entrada

```

## 🎨 Tecnologías

- **React 19**: Componentes funcionales con Hooks
- **Tailwind CSS 3**: Utility-first CSS framework
- **PostCSS**: Procesamiento de CSS
- **Webpack 5**: Bundler configurado con Electron Forge

## 📦 Responsabilidades de Componentes

### `<Header />`
- Muestra el logo y título de la aplicación
- Información de ubicación actual
- Props: `locationName`

### `<StatusCard />`
- Estado visual del sistema (running/stopped)
- Modo actual (test/production)
- Toggle de estadísticas
- Props: `status`, `mode`, `showStats`, `setShowStats`

### `<StatisticsPanel />`
- CPU, RAM, Procesos, Cámaras activas
- Uptime del sistema
- Props: `systemStats`

### `<PublicURLPanel />`
- URL pública del túnel Cloudflare
- Información del túnel (nombre, ID)
- Acciones: Limpiar DNS, Configurar DNS
- Props: `tunnelUrl`, `tunnelName`, `tunnelId`, `loading`, `onFlushDNS`, `onConfigDNS`

### `<ErrorBanner />`
- Muestra errores con contexto
- Acción contextual para resolver (ej: cambiar DNS)
- Props: `error`, `onChangeDNS`, `loading`

### `<ControlButtons />`
- Botones de inicio/parada
- Acceso a configuraciones (ubicación, túnel, servidor)
- Props: `status`, `loading`, callbacks

### `<CameraList />`
- Grid de cámaras configuradas
- Acciones por cámara: activar/desactivar, editar, eliminar
- Botón agregar cámara
- Props: `cameras`, `loading`, callbacks

## 🔧 Configuración de Tailwind

El proyecto usa Tailwind CSS con una configuración personalizada:

```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: {
        500: '#667eea',
        600: '#764ba2',
      }
    }
  }
}
```

## 🚀 Ventajas de la Modularización

1. **Mantenibilidad**: Cada componente tiene una responsabilidad única
2. **Reutilización**: Los componentes son independientes y reutilizables
3. **Testing**: Más fácil hacer pruebas unitarias de componentes individuales
4. **Colaboración**: Múltiples desarrolladores pueden trabajar en paralelo
5. **Tailwind CSS**: Diseño consistente sin CSS custom disperso

## 📝 Próximos Pasos

- [ ] Crear componentes de modales (ConfigModal, TunnelModal, CameraModal)
- [ ] Agregar PropTypes o TypeScript para type safety
- [ ] Implementar context API para estado global
- [ ] Agregar tests unitarios con Jest y React Testing Library
- [ ] Documentar hooks personalizados (si se crean)

## 🔄 Migración del Código Antiguo

El código antiguo se guardó en `App-old.jsx` por referencia.
Las funcionalidades principales están todas migradas al nuevo sistema modular.

## 💡 Convenciones de Código

- Componentes: PascalCase (`Header.jsx`)
- Funciones: camelCase (`handleFlushDNS`)
- Clases Tailwind: Ordenadas por categoría (layout → spacing → colors → typography)
- Props: Destructuring en parámetros de función

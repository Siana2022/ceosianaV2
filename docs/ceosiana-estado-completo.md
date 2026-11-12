# Ceosiana — Documento de estado completo

> Última actualización: noviembre 2026  
> Branch activo: `feat/light-theme-clickup-sidebar` (sin push)

---

## 1. Qué es Ceosiana

**Ceosiana** es un SaaS interno de gestión empresarial para agencias de marketing digital. Es la herramienta de operaciones del día a día del equipo de Siana Digital.

No es multi-tenant (no hay `org_id`): toda la base de datos pertenece a una sola empresa. El acceso se controla por rol (admin vs empleado) a través de Supabase Auth + RLS.

**URL de producción:** https://ceosiana-v2.vercel.app  
**Repo:** https://github.com/Siana2022/EmpresaSaaS.git  
**Deploy:** Vercel (auto-deploy en `main`)

---

## 2. Stack técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.4 |
| UI | React | 19.2.4 |
| Estilos | Tailwind CSS v4 | ^4 |
| BDD / Auth | Supabase JS v2 | ^2.105.1 |
| Lenguaje | TypeScript | ^5 |
| Editor WYSIWYG | Tiptap | ^3.31.4 |
| Notificaciones | Slack SDK | vía API Webhooks |
| Deploy | Vercel | — |

**Supabase project:** `vbrkedtaesuoabxxyhan`  
**URL:** `https://vbrkedtaesuoabxxyhan.supabase.co`

### Particularidades de Next.js 16
- `middleware.ts` está deprecado → se usa `proxy.ts` en su lugar
- Los params de páginas son `Promise<{...}>` y requieren `await params`
- El `createClient()` de Supabase requiere `await` (SSR asíncrono)
- `SUPABASE_SERVICE_ROLE_KEY` está en Vercel pero **no** en `.env.local` local → pages que usan `createAdminClient()` fallan en desarrollo sin él

### Clients de Supabase
- `src/lib/server/supabase.ts` → cliente RLS normal (respeta políticas del usuario logueado)
- `src/lib/server/supabase-admin.ts` → cliente admin con `SERVICE_ROLE_KEY` (bypassea RLS, para leer sueldos, time_logs globales, etc.)
- `src/lib/supabase.ts` → cliente browser-side

---

## 3. Estructura de archivos

```
ceosiana-v2/
├── src/
│   ├── app/
│   │   ├── (app)/                    ← Rutas protegidas (require auth)
│   │   │   ├── layout.tsx            ← Sidebar + Header compartidos
│   │   │   ├── dashboard/            ← P&L anual, KPIs globales
│   │   │   ├── clientes/             ← Lista clientes + detalle por cliente
│   │   │   │   └── [id]/             ← Detalle: servicios, ingresos, rentabilidad, captación
│   │   │   ├── servicios/            ← Catálogo de tipos + instancias
│   │   │   │   └── [id]/             ← [NUEVO] Detalle por tipo de servicio
│   │   │   ├── departamentos/        ← Lista + detalle por departamento
│   │   │   │   └── [id]/             ← KPIs, empleados, evolución mensual
│   │   │   ├── equipo/               ← Lista empleados + perfil individual
│   │   │   │   └── [id]/             ← Sueldos, dedicación, rentabilidad
│   │   │   ├── costes/               ← Gastos fijos, sueldos, comisiones
│   │   │   ├── ingresos/             ← Ingresos por cliente/servicio/mes
│   │   │   ├── dedicacion/           ← Matriz dedicación % por empleado×mes
│   │   │   ├── rendimiento/          ← Rentabilidad cruzada equipo×cliente
│   │   │   ├── historico/            ← Histórico facturación multi-año
│   │   │   ├── comercial/            ← Pipeline de captaciones y ranking
│   │   │   ├── pipeline/             ← Oportunidades comerciales (Kanban)
│   │   │   ├── tareas/               ← Gestión de tareas con timer integrado
│   │   │   │   ├── components/       ← TareaCard, TareaDetailModal, GanttChart...
│   │   │   │   ├── en-vivo/          ← Vista "en curso" para reuniones
│   │   │   │   ├── vista-global/     ← Vista de todas las tareas del equipo
│   │   │   │   └── plantillas/       ← Plantillas reutilizables de proyectos
│   │   │   ├── fichar/               ← Cronómetro + fichaje manual
│   │   │   ├── editorial/            ← Tablero Kanban de contenido editorial
│   │   │   │   └── [clienteId]/      ← Board + CalendarView por cliente
│   │   │   ├── informes/             ← Generador de informes de rendimiento
│   │   │   ├── alertas/              ← Sistema de alertas configurables
│   │   │   ├── administracion/       ← Panel admin: empleados, servicios, configuración
│   │   │   ├── desactivados/         ← Clientes inactivos
│   │   │   └── perfil/               ← Perfil del usuario logueado
│   │   │
│   │   ├── api/                      ← API Routes (server actions)
│   │   │   ├── captacion/            ← CRUD captación de clientes
│   │   │   ├── clientes/             ← CRUD clientes
│   │   │   ├── empleados/            ← CRUD empleados
│   │   │   ├── gastos-fijos/         ← CRUD gastos
│   │   │   ├── ingresos/             ← CRUD ingresos
│   │   │   ├── servicios/            ← CRUD servicios
│   │   │   ├── sueldos/              ← CRUD sueldos
│   │   │   ├── time-logs/            ← Registros de tiempo fichado
│   │   │   │   └── propagar/         ← Propaga tiempo a todos los responsables
│   │   │   ├── tareas/               ← CRUD tareas + imágenes adjuntas
│   │   │   ├── procesos/             ← CRUD procesos/fases de proyectos
│   │   │   ├── plantillas/           ← CRUD plantillas de tareas
│   │   │   ├── pipeline/             ← CRUD oportunidades comerciales
│   │   │   ├── slack/                ← Webhooks Slack (eventos, DMs, timer, daily)
│   │   │   ├── notificaciones/       ← Sistema de notificaciones in-app
│   │   │   ├── alertas/              ← Alertas configurables por admin
│   │   │   ├── configuracion/        ← Parámetros globales de la app
│   │   │   ├── perfil/               ← Datos del perfil del usuario
│   │   │   ├── avatares/             ← Gestión de avatares
│   │   │   └── mcp/                  ← Endpoints MCP (integración agentes IA)
│   │   │
│   │   ├── login/                    ← Autenticación (login, reset, update-password)
│   │   └── globals.css               ← Estilos globales + variables CSS
│   │
│   ├── components/                   ← Componentes compartidos
│   │   ├── Sidebar.tsx               ← Navegación principal
│   │   ├── Header.tsx                ← Cabecera con avatar y notificaciones
│   │   ├── AlertasPanel.tsx          ← Panel lateral de alertas
│   │   ├── NotificacionesPanel.tsx   ← Panel lateral de notificaciones
│   │   ├── BeneficioChart.tsx        ← Gráfica de beneficio reutilizable
│   │   ├── EvolucionChart.tsx        ← Gráfica de evolución mensual
│   │   └── Modal.tsx                 ← Modal genérico
│   │
│   └── lib/
│       ├── server/
│       │   ├── supabase.ts           ← Cliente Supabase SSR (RLS)
│       │   ├── supabase-admin.ts     ← Cliente admin (SERVICE_ROLE)
│       │   ├── configuracion.ts      ← Lee configuración global de BD
│       │   ├── dedicacionCalculada.ts ← Fórmula dedicación desde time_logs
│       │   ├── isAdmin.ts            ← Check de rol admin
│       │   └── perfil.ts             ← Datos del perfil del usuario actual
│       ├── google/
│       │   ├── calendar.ts           ← Integración Google Calendar API
│       │   ├── getToken.ts           ← OAuth Google refresh token
│       │   └── syncTarea.ts          ← Sync tarea ↔ evento Google Calendar
│       ├── slack.ts                  ← Cliente Slack (mensajes, DMs, blocks)
│       ├── supabase.ts               ← Cliente browser-side
│       └── utils.ts                  ← Helpers generales
```

---

## 4. Tablas principales de Supabase

| Tabla | Descripción |
|-------|-------------|
| `clientes` | Empresas cliente, con campos de fecha_alta, activo, etc. |
| `servicios` | Instancias de servicio por cliente (tipo, precio, fechas) |
| `tipos_servicio` | Catálogo de tipos de servicio (Meta Ads, SEO, Hosting…) |
| `empleados` | Equipo interno, con id, nombre, activo, fecha_baja, slack_user_id |
| `departamentos` | Departamentos de la agencia |
| `departamento_empleados` | Tabla pivote empleado↔departamento |
| `ingresos` | Facturación mensual por cliente/servicio/departamento |
| `gastos_fijos` | Gastos mensuales (general, cliente, departamento) |
| `sueldos` | Coste mensual por empleado y año (coste_total) |
| `time_logs` | Registros de tiempo fichado (minutos, fecha, empleado, cliente, servicio, departamento) |
| `captacion_clientes` | Historia de captador/mantenedor por cliente |
| `tareas` | Gestión de tareas con estado, prioridad, timer, checklist |
| `procesos` | Proyectos/procesos con fases Gantt |
| `fases` | Fases de un proceso con fechas y estado |
| `plantillas` | Plantillas de proyectos reutilizables |
| `pipeline` | Oportunidades comerciales con estado y valor |
| `notificaciones` | Sistema de notificaciones in-app |
| `alertas_config` | Configuración de alertas por tipo (admin) |
| `configuracion` | Parámetros globales clave-valor (ej. `coste_hora_umbral`) |
| `editorial_boards` | Tableros kanban de contenido editorial por cliente |
| `editorial_columnas` | Columnas del tablero editorial |
| `editorial_fichas` | Fichas de contenido (post, copy, imagen, fecha publicación) |

---

## 5. Módulos de la app

### 5.1 Dashboard
Resumen ejecutivo anual: P&L (ingresos − gastos − sueldos), gráficas de evolución mensual, top clientes por facturación, margen neto.

### 5.2 Clientes
- Lista con filtros (Todos/Activos/Inactivos), búsqueda, ordenación por múltiples métricas.
- KPIs por cliente: facturación, coste personal, horas dedicadas, margen %.
- **Año de captación visible en la lista** (implementado noviembre 2026).
- Detalle por cliente:
  - Servicios activos e inactivos con rentabilidad por servicio y mes.
  - Ingresos editables por mes.
  - Gastos directos del cliente.
  - Time logs: quién ha trabajado, cuánto, en qué.
  - Histórico de facturación por año desde 2023 (gráfica).
  - Captación: captador, mantenedor, período.
  - **Histórico de captaciones** (tabla con todos los cambios desde 2023) — implementado noviembre 2026.
  - Rentabilidad por servicio: coste personal calculado por proporción de horas fichadas sobre el sueldo.
  - Aviso ⚠ cuando hay horas fichadas pero sin sueldo registrado.

### 5.3 Servicios
- Pestaña **Catálogo**: tipos de servicio con contador de clientes activos. Los nombres son enlace a su página de detalle.
- Pestaña **Servicios**: instancias individuales por cliente.
- **Página de detalle por tipo** (`/servicios/[id]`): KPIs del año, lista de clientes con ese tipo, desglose por instancia — implementado noviembre 2026.

### 5.4 Departamentos
- Lista de departamentos con empleados asignados y facturación del año.
- Detalle por departamento: evolución mensual de facturación, coste personal imputado, empleados activos.

### 5.5 Equipo
- Lista de empleados con resumen de horas y facturación gestionada.
- Perfil individual: sueldos por mes, dedicación por cliente, rentabilidad del empleado.

### 5.6 Costes
- 5 bloques: Gastos fijos generales, Sueldos, Comisiones, Por departamento, Por cliente.
- Edición inline por mes con auto-relleno del año.
- KPIs globales: total fijos, sueldos, comisiones.

### 5.7 Ingresos
- Vista y edición de ingresos por cliente/servicio/mes/año.
- Botón `📅` para rellenar el histórico de un servicio recurrente desde su fecha de inicio.
- Botón `⚡` para rellenar meses vacíos con el precio base del servicio.

### 5.8 Dedicación
- Matriz empleado × mes con % de tiempo dedicado a cada cliente/departamento.
- Calculado automáticamente desde `time_logs` (no entrada manual).
- Fórmula: `% = minutos_en_cliente_mes / total_minutos_empleado_mes`.

### 5.9 Rendimiento
- Rentabilidad cruzada equipo × cliente.
- Histórico multi-año.

### 5.10 Comercial
- Captaciones por año: ranking de captadores y mantenedores.
- Filtro por año desde 2023.
- Pipeline: oportunidades comerciales en Kanban con valor estimado y estado (Prospecto → Propuesta → Negociación → Ganado/Perdido).

### 5.11 Tareas
- Gestión completa de tareas con timer integrado.
- Estados: `pendiente`, `en_curso`, `en_revision`, `terminado`.
- **Timer**: cronómetro con Start/Stop que registra `time_log` al parar.
- **Tipos especiales**: `[Reunión]` y `[Visita]` propagan tiempo a todos los responsables al terminar.
- **Checklist** editable y reordenable dentro de cada tarea.
- **Editor WYSIWYG** con Tiptap (imágenes, enlaces, headings, listas).
- **Proceso/Gantt**: agrupar tareas en procesos con fases y fechas.
- **Plantillas**: guardar y reutilizar estructuras de proyecto.
- **Vista global**: todas las tareas del equipo con filtros.
- **En vivo**: tareas en curso en este momento.
- **Notificaciones Slack**: al asignar tareas, al cambiar estado, al mencionar (`@nombre`).
- **Google Calendar sync**: crear evento al crear tarea con fecha límite.

### 5.12 Fichar (`/fichar`)
- Cronómetro por tarea con cliente/servicio/departamento.
- Fichaje manual para correcciones.
- Historial de fichajes del día.

### 5.13 Editorial
- Tablero Kanban de contenido por cliente.
- Columnas: Ideas → Copy → Diseño → Revisión → Programado → Publicado.
- Fichas con título, copy, canal (Instagram, Facebook, LinkedIn, TikTok, Blog), fecha de publicación, imagen cover.
- **Vista Calendario** con mapa de calor por volumen de publicaciones.
- Crear ficha directamente desde el calendario clicando en un día.

### 5.14 Alertas
- Sistema de alertas configurables por el admin (clientes sin responsable, servicios sin precio, etc.).
- Notificación en la campanita del header.
- Página dedicada `/alertas`.

### 5.15 Administración
- Panel solo para admins: gestión de empleados, servicios, tipos de servicio, configuración global.

### 5.16 MCP (Model Context Protocol)
- Endpoints en `/api/mcp/` para integrar agentes de IA (Claude) con la app.
- Permite a Claude consultar datos de clientes, rentabilidad, empleados, tareas directamente.

---

## 6. Integraciones externas

### Slack
- Notificaciones automáticas de tareas (asignación, cambio de estado, menciones).
- **Daily tasks**: cron a las 09:00 (Madrid) que manda a cada empleado sus tareas del día.
- **DMs**: menciones en comentarios de tareas generan DM al empleado mencionado.
- **Timer warning**: aviso si un fichaje lleva más de X horas abierto.
- Endpoints: `/api/slack/notify`, `/api/slack/dm`, `/api/slack/daily-tasks`, `/api/slack/events`, `/api/slack/interactions`, `/api/slack/fichar`.

### Google Calendar
- Sync unidireccional (tarea → evento).
- Al crear/modificar una tarea con fecha límite, se crea/actualiza un evento en el calendario del responsable.
- OAuth con refresh token almacenado por empleado.
- Archivos: `src/lib/google/calendar.ts`, `syncTarea.ts`, `getToken.ts`.

---

## 7. Historial de bugs resueltos

### 7.1 Bugs estructurales

| Bug | Descripción | Resolución |
|-----|-------------|-----------|
| **Middleware ByteString** | `middleware.ts` lanzaba error `ByteString` en Edge Runtime al leer cookies de Supabase | Reemplazado por `proxy.ts` con encode/decode manual de cookies |
| **Params async** | Next.js 16 requiere `await params` — las páginas fallaban con `params.id` directo | Migradas todas las páginas a `const { id } = await params` |
| **createClient async** | `createClient()` de Supabase SSR es asíncrono en la nueva versión | Añadido `await` en todos los server components |
| **RLS en sueldos** | `sueldos` con RLS impedía a empleados ver sus propios datos y a admins los de otros | Rutas que necesitan datos de sueldos usan `createAdminClient()` |

### 7.2 Bugs de cálculo

| Bug | Descripción | Resolución |
|-----|-------------|-----------|
| **Coste personal % 100** | Cuando un empleado no tenía sueldo registrado, `coste_personal = 0` → margen = 100% | Detectar `sinDatosCoste` (horas > 0 pero sueldo = 0) y mostrar ⚠ en lugar del % |
| **Dedicación manual** | El módulo `/dedicacion` usaba tabla `empleado_dedicacion` con % manuales, desincronizados con la realidad | Rediseñado: cálculo automático desde `time_logs` vía `dedicacionCalculada.ts` |
| **Coste personal fórmula** | Se calculaba `coste × dedicacion% / num_proyectos` — incorrecto con proyectos de duración variable | Cambiado a `sueldo_mes × (minutos_cliente_mes / total_minutos_empleado_mes)` |
| **Rentabilidad por servicio** | Logs sin `id_servicio` (solo con `id_departamento`) no se imputaban a ningún servicio | Añadido fallback: si el departamento tiene exactamente 1 servicio con facturación ese mes, se imputa allí |
| **Histórico incluye coste** | La vista histórica no sumaba el coste personal, solo gastos directos | Corregido: `coste_personal` incluido en la fórmula de rentabilidad histórica |

### 7.3 Bugs de Supabase / RLS

| Bug | Descripción | Resolución |
|-----|-------------|-----------|
| **Proyecto equivocado en worktree** | El worktree de Claude Code tenía `env.local` (sin punto) apuntando al proyecto antiguo `vkyrhjuslkeuvzkmwicp` | El servidor de desarrollo debe lanzarse siempre desde `ceosiana-v2/` con `.env.local` correcto |
| **Captaciones con limit(1)** | La query de captación del cliente tenía `.limit(1)` — no se podía ver el histórico | Eliminado el `.limit(1)`, ahora trae todas las entradas ordenadas por `fecha_inicio DESC` |
| **Filter `.in()` incorrecto** | En `/servicios/[id]`, se intentó `.in('id_tipo_servicio', [id])` directamente sobre `ingresos` — esa columna no existe | Corregido: primero obtener IDs de servicios del tipo, luego `.in('id_servicio', servicioIds)` |
| **Clientes inactivos invisible** | `.eq('activo', false)` no capturaba clientes con `activo = NULL` | Cambiado a `.or('activo.eq.false,activo.is.null')` |
| **time_logs paginación** | PostgREST devuelve máximo 1000 filas — clientes con muchos time_logs perdían datos | Implementado loop de paginación con `.range(from, from + PAGE - 1)` en todas las queries de time_logs |

### 7.4 Bugs de UI / Comportamiento

| Bug | Descripción | Resolución |
|-----|-------------|-----------|
| **Timer no cierra tareas** | Al parar el cronómetro desde `/fichar`, la tarea quedaba en `en_curso` | Fix en la lógica de stop del timer — actualiza estado de tarea al parar |
| **Fichaje manual sin time_log** | El fichaje manual en tareas no generaba registro en `time_logs` | Corregido: `POST /api/time-logs` explícito desde el modal de fichaje manual |
| **Antiduplados bloquea incrementales** | La lógica anti-duplicados impedía fichajes incrementales (mismo cliente+servicio en el mismo día) | Revisada la condición: solo bloquea duplicados exactos de minutos, no incrementales |
| **id_servicio no se graba al iniciar** | Al pulsar Start en el timer, el `id_servicio` no se guardaba hasta el Stop | Corregido: `id_servicio` se incluye desde el inicio del registro |
| **Slack notifica estado repetido** | Cuando una tarea ya estaba en un estado y se guardaba sin cambio, Slack enviaba notificación igualmente | Añadida comparación del estado anterior antes de notificar |
| **Gantt title tooltip** | El tooltip del título en el Gantt chart se superponía incorrectamente | Corregida la posición absoluta del tooltip |
| **Pipeline toast "Ganado"** | Al mover una oportunidad a "Ganado", no aparecía feedback visual | Añadido toast de confirmación |
| **Tareas orden roto** | Se intentó ordenar por `fecha_limite ASC` pero creaba inconsistencias con tareas sin fecha | Revertido al orden por `created_at`; ordenación por deadline con `nullsFirst: false` como alternativa |
| **Calendar sync con await** | `syncTarea` se lanzaba como IIFE en background → Vercel mataba el proceso antes de completar | Cambiado a `await syncTarea(...)` con try/catch |
| **Festivos un día tarde** | En `HRHolidays`, `dayDate.toISOString()` pasaba a UTC y restaba un día al festivo | Construida la fecha con componentes locales (`new Date(year, month, day)`) |
| **Autor chat incorrecto** | Los mensajes del chat de procesos mostraban el autor incorrecto | Corregido `autorId` al crear mensajes desde la sesión activa |
| **Sort tareas en JS** | Se añadió sort JS sobre los resultados de Supabase — rompía el orden de tareas en vistas globales | Eliminado; el orden viene de Supabase directamente |

### 7.5 Bugs de Despliegue / CI

| Bug | Descripción | Resolución |
|-----|-------------|-----------|
| **Vercel trata warnings como errores** | ESLint warnings en el build local pasaban, pero Vercel con `CI=true` los convierte en errores y falla el deploy | Regla fija: siempre hacer `CI=true npx tsc --noEmit && CI=true npm run build` antes de hacer push |
| **Cron daily-tasks hora incorrecta** | El cron estaba en `08:00 UTC`, que en invierno es 09:00 Madrid pero en verano es 10:00 Madrid (CEST) | Ajustado a `08:00 UTC` para invierno; pendiente revisar cuando cambie el horario |
| **Links Slack apuntan a preview** | Las URLs en mensajes Slack del cron apuntaban al deploy de preview en lugar de producción | Forzado `APP_URL` en `vercel.json` a la URL de producción |

---

## 8. Mejoras implementadas (historial de features)

Ordenadas cronológicamente (más recientes primero):

| Feature | Descripción |
|---------|-------------|
| Página detalle tipo servicio | `/servicios/[id]` con KPIs, lista de clientes y desglose de instancias |
| Histórico captaciones en detalle | Tabla de cambios de captador/mantenedor desde 2023 en ficha de cliente |
| Año captación en lista clientes | Badge azul "Captado XXXX" en cada fila de la lista |
| ⚠ sin coste en rentabilidad | Aviso cuando hay horas fichadas pero sin sueldo registrado |
| Rediseño sidebar (ClickUp style) | Ítem activo con fondo azul, contraste mejorado, textos legibles |
| Mejoras login | Contraste de texto en formulario de autenticación |
| Módulo Editorial | Kanban + Calendario de contenido por cliente con upload de imagen |
| Creador tarea desde calendario | Clic en día del calendario editorial → modal con fecha pre-rellenada |
| Mapa de calor calendario | Intensidad visual por volumen de publicaciones por día |
| Respeta fecha_baja en costes | Los empleados inactivos no aparecen en costes si tienen fecha_baja antes del mes |
| Auto-perfil | El empleado ve su propio perfil automáticamente al entrar en `/equipo/[id]` |
| DM menciones Slack | `@nombre` en comentario de tarea → DM privado en Slack |
| Editor WYSIWYG Tiptap | Descripción de tareas con formato rico (headings, listas, imágenes, enlaces) |
| Propagar tiempo reunión | Tareas tipo `[Reunión]` y `[Visita]` propagan los minutos a todos los responsables |
| Notificaciones in-app | Panel flotante con tareas activas, menciones, alertas |
| Badge notificaciones | Número en la campanita del header |
| Sistema de alertas | Alertas configurables por admin (sin responsable, sin precio...) |
| Daily tasks Slack | Cron 09:00 Madrid con resumen de tareas por empleado |
| Checklist editable | Checklist reordenable en tareas con toggle de completado |
| Módulo Editorial completo | Tablero Kanban, fichas, canales, upload imagen |
| Rentabilidad por servicio | Tabla mensual con coste personal imputado por proporción de horas |
| Filtro Todos/Activos/Inactivos | En lista de clientes |
| Histórico facturación gráfico | Gráfica de evolución por año en el detalle del cliente |
| Desactivados | Página de clientes inactivos |
| Botón 📅 rellenar histórico | Rellena ingresos desde fecha_inicio del servicio hasta hoy |
| Botón ⚡ rellenar año | Rellena meses vacíos con precio base del servicio |
| Captación comercial por año | Filtro de captaciones y rankings por año en `/comercial` |
| Dedicación automática | Cálculo de % dedicación desde time_logs (sin entrada manual) |
| % rentabilidad sueldo | Columna de rentabilidad en tabla de sueldo por dedicación |
| Coste personal por horas | Fórmula correcta: sueldo × (mins_cliente / total_mins) |
| Multi-dept time_logs | Logs con departamento pero sin servicio → fallback a servicio único del dept |
| Paginación time_logs | Loop de paginación para superar límite de 1000 filas PostgREST |
| Google Calendar sync | Tarea con fecha_límite → evento en Google Calendar del responsable |
| MCP endpoints | API para integrar Claude como agente con datos de la app |
| Pipeline Kanban | Oportunidades comerciales con arrastrar y soltar entre estados |
| Proceso/Gantt | Proyectos con fases, fechas y diagrama Gantt |
| Plantillas | Guardar y reutilizar estructuras de proyecto completas |

---

## 9. Mejoras pendientes

### 9.1 Items del PDF de mejoras UI (noviembre 2026)

| Item | Estado | Descripción |
|------|--------|-------------|
| 8 | ✅ Hecho | ⚠ sin coste en % rentabilidad |
| 14 | ✅ Hecho | Página detalle por tipo de servicio |
| 17 | ✅ Verificado | Hosting usa la página del Item 14 |
| 5 | ✅ Hecho | Año captación en lista + histórico en detalle |
| 18 | ⏳ Pendiente | Meta Ads no coge fichajes de tiempo — requiere investigar con `SERVICE_ROLE_KEY` local |
| 19 | ⏳ Pendiente | Verde Esmeralda: agrupación automática de fichas Meta Ads — requiere investigar datos |
| 20 | ⏳ Pendiente | Tareas de ejemplo borradas aparecen en /fichar y /análisis-equipo (revisar primero qué son) |
| 22 | ⏳ Aplazado | Bloque "convertidor real" — usuario pidió esperar |

### 9.2 Funcionalidades pendientes generales

| Feature | Descripción | Prioridad |
|---------|-------------|-----------|
| Área de perfil | Foto, datos personales, cambio de contraseña | Media |
| Google Calendar bidireccional | Cambios en Google → actualizar tarea en Ceosiana | Media |
| Campo Servicio en tareas | Asociar una tarea a un servicio específico (hoy solo a cliente) | Alta |
| Rentabilidad por departamento | Misma fórmula que por servicio, agrupada por departamento | Media |
| Publicación directa editorial | OAuth Meta por cliente + botón publicar en Instagram/Facebook | Alta (bloqueado por permisos Meta) |
| Portal cliente editorial | Link privado por token; cliente puede ver tablero y aprobar fichas | Media |
| Generación copy con Claude | Botón "Generar copy" en modal de ficha editorial | Media |
| Comando /fichar en Slack | Flujo conversacional guiado en Slack para registrar tiempo | Media |
| Constructor plantillas visual | Drag & drop de bloques (no editor tipo Word) | Media (en espera) |
| Notificaciones Slack configurables | Elegir qué eventos generan notificación en Slack | Baja |

### 9.3 Bug conocido menor

- Tareas creadas al iniciar el timer con prefijo especial (`[Manual X]` o `[Tipo: X]`) no se actualizan a "terminado" al parar. Caso poco frecuente, sin impacto en datos.

---

## 10. Notas de desarrollo

### Variables de entorno necesarias

```env
# En .env.local (local)
NEXT_PUBLIC_SUPABASE_URL=https://vbrkedtaesuoabxxyhan.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...     ← No está en .env.local local; sí en Vercel
APP_URL=http://localhost:3001

# En Vercel (producción)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_URL=https://ceosiana-v2.vercel.app
SLACK_BOT_TOKEN=...
SLACK_SIGNING_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CRON_SECRET=...
```

**Para obtener `SUPABASE_SERVICE_ROLE_KEY` en local:**
```bash
vercel env pull .env.local
# o copiarlo desde Supabase Dashboard → Settings → API → service_role
```

### Regla de oro antes de hacer push

```bash
CI=true npx tsc --noEmit   # TypeScript sin errores
CI=true npm run build       # Build sin warnings ESLint
git push                    # Solo si ambos pasan
```

### Servidor de desarrollo

Siempre lanzar desde `ceosiana-v2/`:
```bash
cd /Users/cavesson/Desktop/claude_code/ceosiana-v2
npm run dev -- --port 3001
```

**No** lanzar desde el worktree de Claude Code (`.claude/worktrees/`) — tiene un `.env` sin punto que apunta al proyecto Supabase antiguo.

---

> **Branch actual:** `feat/light-theme-clickup-sidebar` — 270 commits totales, sin push.  
> **Próximo paso recomendado:** revisar items 18 y 19 (Meta Ads / Verde Esmeralda) una vez disponible `SERVICE_ROLE_KEY` en local.

---

## 11. Quién usa qué: roles y módulos reales

### Dos roles, dos apps dentro de la misma URL

El campo `perfil.rol` en Supabase puede ser `'admin'` o `'empleado'`. El sidebar muestra menús completamente distintos según el rol.

#### Vista empleado (`rol = 'empleado'`)
El sidebar se llama "Control de tiempos". Solo tiene 4 ítems:

| Módulo | URL | Uso real |
|--------|-----|----------|
| Fichar | `/fichar` | ✅ Uso diario — cronómetro y fichaje manual |
| Tareas | `/tareas` | ✅ Uso diario — sus tareas asignadas |
| Notificaciones | `/alertas` | ✅ Uso diario — badge de tareas activas y menciones |
| Mi perfil | `/perfil` | ⚡ Uso ocasional — conectar Google Calendar, cambiar Slack username |

Los empleados **no ven ningún dato económico**. No pueden acceder a clientes, ingresos, costes ni sueldos. No hay página que les muestre sus propios sueldos.

#### Vista admin (`rol = 'admin'`)
El sidebar se llama "Panel de dirección". Tiene todos los módulos, organizados en 3 secciones, más acceso directo a cada cliente activo.

| Sección | Módulo | URL | Uso real |
|---------|--------|-----|----------|
| PRINCIPAL | Dashboard | `/dashboard` | ✅ Revisión semanal del P&L |
| PRINCIPAL | Tareas | `/tareas` | ✅ Uso diario — gestión del equipo |
| PRINCIPAL | Fichar | `/fichar` | ✅ Uso diario |
| PRINCIPAL | Pipeline | `/pipeline` | ⚡ Uso ocasional — oportunidades abiertas |
| GESTIÓN | Comercial | `/comercial` | ⚡ Revisión mensual — captaciones y rankings |
| GESTIÓN | Editorial | `/editorial` | ✅ Uso activo para los clientes con contenido |
| GESTIÓN | Ingresos | `/ingresos` | ✅ Entrada mensual de facturación |
| GESTIÓN | Costes | `/costes` | ✅ Entrada mensual de gastos/sueldos |
| GESTIÓN | Dedicación | `/dedicacion` | ⚡ Revisión mensual — % tiempo por empleado |
| GESTIÓN | Administración | `/administracion` | ⚡ Gestión de empleados/servicios |
| GESTIÓN | Histórico | `/historico` | ⚡ Consulta puntual |
| EQUIPO | Equipo | `/equipo` | ⚡ Perfil individual de empleados |
| EQUIPO | Servicios | `/departamentos` | ⚡ Vista de departamentos y KPIs |
| EQUIPO | Rendimiento | `/rendimiento` | ⚡ Análisis cruzado — solo admins |
| EQUIPO | Informes | `/informes` | ⚠️ Poco usado (ver módulos en desuso) |
| — | Clientes | `/clientes/[id]` | ✅ Referencia diaria por cliente |

#### Módulos en desuso o infrautilizados

| Módulo | Estado | Motivo |
|--------|--------|--------|
| `/informes` | ⚠️ Poco usado | Genera informes de rendimiento PDF-style, pero la mayoría prefiere mirar directamente el detalle del cliente. 890 líneas de código, funcional pero sin adopción. |
| `/desactivados` | ⚠️ Solo consulta | Lista de clientes inactivos. Se visita cuando hay dudas sobre un ex-cliente. No hay flujo activo desde aquí. |
| `/historico` | ⚡ Consulta puntual | Multi-año, comparativa. Se usa para preparar reuniones de dirección, no en el día a día. |
| `/rendimiento` | ⚡ Solo admins | Solo accesible a admins (redirige a `/fichar` si eres empleado). Vista cruzada equipo×cliente. Funcional pero complejo para uso habitual. |
| `mockData.ts` en tareas | ⚠️ **Muerto** | Archivo con tareas de ejemplo hardcodeadas (`syncCalendar: false` × 8). Solo se usa en algún test interno. No se renderiza en producción, pero genera confusión cuando aparece en `/fichar` si se filtra mal. |

---

## 12. Datos sensibles: quién puede ver qué

### Qué considera la empresa confidencial

| Dato | Nivel | Visible para |
|------|-------|--------------|
| Sueldos individuales (`sueldos`) | 🔴 Máxima confidencialidad | Solo admins, vía `createAdminClient()` (bypasea RLS) |
| Márgenes por cliente | 🔴 Confidencial | Solo admins — no existe ninguna ruta para empleados |
| Costes de personal | 🔴 Confidencial | Solo admins |
| Facturación por cliente | 🔴 Confidencial | Solo admins |
| Pipeline / oportunidades | 🔴 Confidencial | Solo admins |
| Rentabilidad por servicio | 🔴 Confidencial | Solo admins |
| Dedicación (% tiempo del equipo) | 🔴 Confidencial | Solo admins |
| Datos de los clientes | 🟡 Interno | Solo admins — empleados no ven `/clientes` |
| Sus propias tareas | 🟢 Personal | El empleado solo ve sus tareas asignadas |
| Tiempo fichado propio | 🟢 Personal | El empleado ve su propio historial en `/fichar` |

### Cómo se implementa el control de acceso

**Capa 1 — Sidebar**: los empleados no ven los links a módulos restringidos.

**Capa 2 — Server components**: algunas páginas tienen redirect explícito:
- `/rendimiento` → si `rol !== 'admin'`, redirige a `/fichar`
- `/administracion` → funciona para todos pero muestra opciones reducidas si no es admin

**Capa 3 — RLS en Supabase**: la tabla `sueldos` tiene RLS habilitada. Cualquier query desde el cliente normal (`createClient()`) devuelve array vacío si el usuario no tiene permiso. Solo `createAdminClient()` con `SERVICE_ROLE_KEY` puede leer sueldos de otros.

**Capa 4 — Layout**: el layout de `(app)` solo pasa la lista de clientes al Sidebar si `rol === 'admin'`. Los empleados no reciben ese dato en absoluto.

> **Punto débil**: la mayoría de páginas de gestión (costes, ingresos, dedicación, comercial) no tienen redirect explícito para empleados — confían en que el sidebar no muestra el link. Si un empleado conoce la URL y la escribe directamente, podría acceder. Esto es una deuda técnica conocida, no una vulnerabilidad activa (en la práctica nadie en el equipo lo haría), pero debería cerrarse con redirects en las pages.

---

## 13. Integraciones vivas

### Slack — ✅ En uso activo

**Estado:** Funciona en producción. Las variables `SLACK_BOT_TOKEN` y `SLACK_SIGNING_SECRET` están configuradas en Vercel.

**Qué está funcionando:**
- **Cron diario** (lunes a viernes, 09:00 Madrid): `/api/slack/daily-tasks` → cada empleado recibe en Slack un mensaje con sus tareas del día.
- **Notificaciones de tareas**: al asignar o cambiar estado de tarea → mensaje en el canal de Slack del cliente.
- **DMs por menciones**: `@nombre` en un comentario de tarea → DM privado en Slack al empleado mencionado.
- **Timer warning**: si un fichaje lleva demasiado tiempo abierto, aviso en Slack.
- **Reuniones terminadas**: al parar el timer de una reunión, Slack DM a todos los responsables propagados.

**Qué no está funcionando / pendiente:**
- **Comando `/fichar` en Slack**: el endpoint `/api/slack/fichar` existe pero el flujo conversacional guiado (seleccionar cliente → servicio → tiempo) no está implementado. Es solo el handler del slash command, sin la lógica completa.
- **Interacciones (`/api/slack/interactions`)**: handler registrado pero sin implementación real de Block Kit interactions.

### Google Calendar — ⚡ Funcional pero adopción baja

**Estado:** La integración técnica existe y funciona. Las credenciales OAuth están en Vercel. Se conecta por empleado desde `/perfil`.

**Cómo funciona:**
1. El empleado va a su perfil y pulsa "Conectar Google Calendar".
2. OAuth flow → el `refresh_token` se guarda en `perfiles.google_refresh_token`.
3. Al crear o modificar una tarea con fecha límite (y `syncCalendar = true` en la tarea), se llama `syncTareaToAllResponsables` que crea/actualiza un evento en el calendar de cada responsable que tenga el token guardado.

**Estado real:** Solo funciona para los empleados que hayan completado el OAuth. Si nadie lo ha hecho, las llamadas a `syncTarea` fallan silenciosamente (con `console.error`). La sincronización es **unidireccional**: tarea → Google Calendar. Cambios en Google Calendar **no** vuelven a Ceosiana.

**Punto de fragilidad:** `getToken.ts` refresca el access_token desde el refresh_token guardado. Si el refresh_token caduca o se revoca (por ejemplo, el usuario desconecta la app desde Google), la sync falla silenciosamente hasta que el empleado vuelva a hacer el OAuth desde `/perfil`.

### MCP (Model Context Protocol) — ⚡ Experimental pero funcional

**Estado:** La API en `/api/mcp/` está implementada y en uso como herramienta de desarrollo/dirección, no como producto de usuario final.

**Qué puede hacer:**
- `get_mis_tareas(email)` — tareas pendientes de un empleado
- `get_clientes` — lista de clientes con métricas
- `get_rentabilidad` — rentabilidad por cliente y año
- `get_empleados` — lista del equipo
- `get_dedicacion`, `get_costes`, `get_comercial`, `get_fichajes`, `get_procesos` — datos de cada módulo

**Autenticación:** Variable de entorno `CEOSIANA_MCP_KEY`. Si no está configurada, el endpoint es abierto (modo dev). En Vercel debería estar configurada.

**Uso real:** Se usa principalmente desde Claude Code (en estas sesiones de desarrollo) para consultar datos de la app directamente, como herramienta de dirección conversacional. No está expuesto a usuarios finales de forma activa.

---

## 14. Despliegue: entornos y flujo

### Entornos

| Entorno | URL | Branch | Notas |
|---------|-----|--------|-------|
| **Producción** | https://ceosiana-v2.vercel.app | `main` | Auto-deploy al hacer merge/push a main |
| **Preview** | `ceosiana-v2-git-[branch]-siana.vercel.app` | Cualquier branch con push | Vercel crea preview automático por branch |
| **Local** | http://localhost:3001 | Cualquier | `npm run dev -- --port 3001` desde `ceosiana-v2/` |

### Flujo de despliegue

```
Desarrollo local → branch → push → PR → preview Vercel → merge a main → producción
```

**Quién despliega:** Solo quien tiene acceso al repo (`Siana2022` en GitHub). El deploy es automático — no hay botón manual en Vercel.

**Regla antes de hacer push:**
```bash
CI=true npx tsc --noEmit   # TypeScript limpio
CI=true npm run build       # Build sin errores ni warnings ESLint
```
Vercel trata todos los warnings de ESLint como errores con `CI=true`. Si el build local pasa en modo normal pero falla en Vercel, es casi siempre un warning de ESLint (variable no usada, `any` sin tipo, etc.) que el build local ignoró.

**Variables de entorno en Vercel vs local:**

| Variable | Vercel | .env.local | Notas |
|----------|--------|-----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ❌ | Falta en local — pages con `createAdminClient()` fallan |
| `SLACK_BOT_TOKEN` | ✅ | ❌ | Solo necesario para funciones Slack en producción |
| `GOOGLE_CLIENT_ID/SECRET` | ✅ | ❌ | Solo para OAuth Google en producción |
| `CRON_SECRET` | ✅ | ❌ | Protege el endpoint del cron de Vercel |
| `CEOSIANA_MCP_KEY` | ✅ (debería) | ❌ | Si no está, el MCP es abierto |
| `APP_URL` | ✅ (producción) | ✅ (localhost:3001) | |

**Para obtener `SERVICE_ROLE_KEY` en local:**
```bash
vercel env pull .env.local
# o copiarlo desde Supabase Dashboard → Settings → API → service_role
```

### Trampas del entorno

- **Worktree de Claude Code** (`.claude/worktrees/vigilant-hugle-77d412/`): tiene un archivo `env.local` **sin punto** que apunta al proyecto Supabase antiguo (`vkyrhjuslkeuvzkmwicp`). Si se lanza el servidor desde ahí, el login falla con "Failed to fetch" porque las credenciales no coinciden. Siempre lanzar desde `ceosiana-v2/`.
- **Puerto 3001**: el servidor usa el 3001 porque el 3000 suele estar ocupado por otros proyectos locales. El `APP_URL` local debe ser `http://localhost:3001` para que el OAuth de Google redirija correctamente.

---

## 15. Decisiones y trampas: qué no tocar

### Qué se probó y no funcionó

| Experimento | Resultado | Por qué se abandonó |
|-------------|-----------|---------------------|
| `middleware.ts` de Next.js | Roto en Edge Runtime | Next.js 16 cambia el comportamiento del middleware de Supabase SSR — lanzaba error `ByteString` al leer cookies. Reemplazado por `proxy.ts`. **No restaurar `middleware.ts`**. |
| Dedicación manual (tabla `empleado_dedicacion`) | Abandonado | Los % que entraba el equipo no coincidían con la realidad de las horas fichadas. Se rediseñó el módulo para calcularlo automáticamente desde `time_logs`. La tabla puede seguir existiendo en BD pero el código ya no la lee. |
| `.limit(1)` en captaciones | Bug silencioso | Parecía correcto (devuelve la última captación) pero bloqueaba el histórico. Eliminado. |
| Sort JavaScript sobre resultados Supabase en tareas | Roto | Causaba que tareas con fecha_limite aparecieran en orden incorrecto y algunas desaparecieran de vistas. Revertido: el orden viene de la query de Supabase directamente. |
| `Promise.allSettled` en background (Vercel) | Roto | Lanzar `syncCalendar` como IIFE en background (`(() => { ... })()`) hacía que Vercel matara el proceso antes de que terminara. Corregido a `await syncTarea(...)` con try/catch. |
| Propagar tiempo con `hours_adjustment` (Workontime) | Datos corruptos | La fórmula `real - fichado` estaba invertida durante meses. Generó saldos imposibles (Camila: +99h). Los datos históricos corruptos se limpiaron manualmente. El código vivo ya es correcto. |

### Qué no se debe tocar

| Elemento | Riesgo si se toca |
|----------|------------------|
| `proxy.ts` | Reemplaza el middleware de Next.js. Si se elimina o se restaura `middleware.ts`, el login rompe. |
| Paginación de `time_logs` (el loop con `.range()`) | Si se quita, los clientes/empleados con más de 1000 registros de tiempo perderán datos en todos los cálculos de coste y dedicación. |
| `createAdminClient()` en páginas de sueldos | Si se cambia a `createClient()`, los sueldos devuelven array vacío por RLS y todos los cálculos de rentabilidad dan 0. |
| Fórmula de coste personal | `sueldo × (mins_cliente / total_mins_empleado)`. Cambiarla sin entender bien la lógica de paginación y el scope del loop romperá silenciosamente los cálculos. |
| `vercel.json` cron schedule | El cron es `0 8 * * 1-5` (UTC). Cambiarlo sin tener en cuenta horario de verano/invierno Madrid puede que el daily Slack llegue a las 10:00 en verano. |
| `APP_URL` en Vercel | Si se pone una URL de preview, los links de Slack del cron apuntarán a esa preview en lugar de producción. |

### Qué está a medias

| Feature | Estado | Qué falta |
|---------|--------|-----------|
| `/fichar` Slack command | Endpoint creado, lógica vacía | El flujo conversacional de Block Kit (seleccionar cliente → servicio → tiempo) |
| Slack interactions | Handler registrado | Sin implementación real de respuesta a botones/selects de Block Kit |
| Google Calendar bidireccional | Solo ida (tarea → Google) | El webhook de Google Calendar para actualizar tareas cuando el evento cambia |
| Publicación editorial en Meta | OAuth y botón no implementados | Pendiente de que Meta apruebe los permisos de la app de agencia |
| Portal cliente editorial | No implementado | Generación de token privado + vista pública del tablero |
| Perfil de usuario completo | Solo Google Calendar y Slack username | Falta foto de perfil, datos personales, cambio de contraseña desde la app |
| Control de acceso por URL en gestión | Solo sidebar oculta los links | Las pages de costes/ingresos/dedicación/comercial no redirigen si un empleado navega directamente |

---

## 16. Qué duele: los 5 problemas reales del día a día

### 1. 🔴 `SUPABASE_SERVICE_ROLE_KEY` no está en local

**Síntoma:** Al desarrollar en local, todas las páginas que usan `createAdminClient()` fallan: el detalle de cliente no muestra costes, el perfil de empleado no muestra sueldos, los cálculos de rentabilidad dan 0 o errores de servidor.

**Por qué duele:** Es el problema más frecuente al retomar el desarrollo después de un tiempo. Se pierde tiempo debugueando hasta recordar que la key falta.

**Fix inmediato:** `vercel env pull .env.local` (requiere estar autenticado en Vercel CLI).

---

### 2. 🟠 Worktree de Claude Code apunta al Supabase equivocado

**Síntoma:** Si se lanza el servidor desde el worktree (`.claude/worktrees/vigilant-hugle-77d412/`), el login falla con "Failed to fetch" sin mensaje claro. Las credenciales del formulario se envían al proyecto antiguo de Supabase que ya no existe.

**Por qué duele:** Claude Code a veces trabaja desde el worktree y lanza el servidor desde ahí. La confusión entre qué directorio está activo cuesta 10-15 minutos cada vez que ocurre.

**Fix:** Siempre lanzar `npm run dev` desde `ceosiana-v2/` explícitamente.

---

### 3. 🟠 Build Vercel falla por warnings ESLint que localmente pasan

**Síntoma:** El código funciona perfectamente en local (`npm run dev`). Se hace push y el deploy de Vercel falla con `Type error: ...` o `ESLint error: ...`. Suele ser un `any` sin tipar, una variable declarada pero no usada, o una importación que falta.

**Por qué duele:** Corta el flujo de trabajo — hay que hacer un commit de fix solo para que Vercel construya. En ramas activas puede haber 2-3 commits seguidos de "fix build".

**Fix:** Siempre ejecutar `CI=true npx tsc --noEmit && CI=true npm run build` antes de cualquier push. Está en la regla de oro del documento, pero es fácil olvidarlo cuando hay urgencia.

---

### 4. 🟡 time_logs sin `id_servicio` → costes no imputados a ningún servicio

**Síntoma:** En la tabla de rentabilidad por servicio de un cliente, hay horas fichadas que "desaparecen" — no se suman al coste de ningún servicio. Esto hace que el coste personal total del cliente no coincida con la suma de costes por servicio.

**Por qué duele:** Genera desconfianza en los datos. El equipo ficha tiempo a un cliente pero a veces sin especificar el servicio concreto (porque la tarea no tiene servicio asignado, o porque se fichó directamente desde el cronómetro sin seleccionar).

**Fix parcial implementado:** Si el departamento del log tiene exactamente 1 servicio con facturación ese mes, el coste se imputa allí. Pero si hay 2 o más servicios del mismo departamento, el log queda sin imputar.

**Fix real pendiente:** El item "Campo Servicio en tareas" — si cada tarea tiene un servicio asignado, el fichaje siempre tendrá `id_servicio` y este problema desaparece.

---

### 5. 🟡 Tareas de ejemplo (mockData) aparecen en vistas de equipo

**Síntoma:** Ocasionalmente, tareas con nombres genéricos ("Tarea de ejemplo 1", etc.) aparecen en `/fichar` o en la vista global de tareas. Son datos del archivo `mockData.ts` que en algún momento se colaron en la base de datos real.

**Por qué duele:** Ensucia las vistas del equipo y genera confusión sobre qué es real y qué es prueba. No es un bug de código — los datos están en BD. Hay que identificar las IDs concretas y borrarlas desde Supabase, pero primero hay que confirmar que no afectan a ningún cálculo de tiempo real.

**Estado:** Pendiente de revisar (Item 20 del PDF). El usuario quiere ver primero qué tareas son para confirmar antes de borrar.

# Análisis de los PDFs de propuestas

**Fecha:** 12/11/2026
**Base de código:** `main@159829f` (producción) + rama local `feat/light-theme-clickup-sidebar`
**Método:** cada ítem contrastado contra el código, no contra el documento de estado.

Estados:

- ✅ **Hecho** — existe y hace lo que pide
- 🟡 **Parcial** — existe, pero no cubre el caso o falla en algo
- ❌ **No existe**
- ❓ **Existe pero el fallo es de datos/config** — hay que reproducirlo en la app

---

## 0. Progreso de corrección (rama `fix/fichaje-servicio`)

| # | Arreglo | Estado | Verificación |
|---|---|---|---|
| 35 | Tarea creada al fichar sin `id_servicio` | ✅ | Tarea de prueba con servicio relleno |
| 6 / 31 | Fichaje sin vínculo a la tarea (`id_tarea`) | ✅ | Fila con `id_tarea` en `time_logs` |
| 6 / 31 | Reuniones: propagación solo desde el modal | ✅ | Segunda fila para el otro responsable |
| 4 | Selector de fichar filtraba estados inexistentes | ✅ | Tareas en "proceso" visibles |
| — | Borrado con `confirm()` silencioso | ✅ | Modal propio + restaurar si falla |
| 23 | Catálogo `tipos_servicio` vacío (no dejaba crear servicios) | ✅ | 19 tipos, 222/222 enlazados |
| — | 7 tareas atascadas en `en_curso` | ✅ | `UPDATE` aplicado, migración en repo |
| 19 | Foto de perfil en tarjetas y filas de tarea | ✅ | Probado en preview |
| 16 / 33 | Flechas del checklist ocultas (no se podía reordenar) | ✅ | Probado en preview |
| 3 | Nombre de tarea cortado con "…" en la lista | ✅ | Dos líneas; pendiente de confirmar en Gantt |

Pendiente de decisión: los 20 departamentos duplican los nombres de los tipos de servicio.

---

## 1. `CAMBIOS CEOSIANA (5).pdf` — 42 propuestas

### 1.1 Tareas

| # | Propuesta | Estado | Evidencia / nota |
|---|---|---|---|
| 2 | Poder poner hora a la tarea para vincular con Calendar | ✅ | `tareas.hora`, `TareaDetailModal.tsx:377`, `syncTarea` recibe `time` |
| 3 | Gantt: que el título salga completo | 🟡 | `GanttChart.tsx:142` usa `title` (tooltip) y `break-words`; el texto visible sigue limitado por el ancho. Verificar en Ceivan Medical |
| 5 | Reuniones/visitas terminadas → bloque de terminadas | ✅ | `vista-global/page.tsx:126,136,146` filtra `estado !== 'terminado'` |
| 7 | Editar y borrar mensajes del chat | ✅ | `ChatMock.tsx:92-108` (✏️ y 🗑️) |
| 8 | Añadir checklist a la tarea | ✅ | `tareas.checklist` (jsonb) + UI en `TareaDetailModal` |
| 9 | Asignar bien el tiempo a cada responsable (play vs manual) | ❓ | Reportado por Anaís. Hay que reproducir: conviven `useTimerTarea` y alta manual |
| 10 | Imágenes en la descripción (WYSIWYG) | ✅ | Tiptap + `api/tareas/imagenes` |
| 16 | Mover y modificar tareas del checklist | 🟡 | Se modifica; **no se reordena** (no hay dnd-kit en el checklist) |
| 22 | Selector de creador de tarea | ✅ | `store.tsx:525`, `TareaDetailModal.tsx:400-403`; pendiente hacerlo más visible |
| 21 | Ordenar tareas por fecha | 🟡 | Orden por `created_at`; el sort por `fecha_limite` se revirtió (commits `2897dac`, `4a16195`) |
| 42 | Tareas diarias no caer en fin de semana | ❌ | `store.tsx:555` usa `addDays(+1)` sin saltar sábado/domingo |
| 35 | Tarea creada desde Fichar: sale "terminada" y con servicio vacío | ❌ | `FicharClient.tsx:395` crea la tarea **sin `id_servicio`**; confirma el bug |
| 36 | Servicios en el desplegable aunque no estén en el cliente | ❓ | Hay que ver el filtro del selector y decidir el comportamiento |
| 13 | Fichar a todos los responsables, sea tarea, reunión o visita | 🟡 | `time-logs/route.ts:221`: solo propaga en reunión/visita |
| 6 | Fichar desde tareas debe contar en mi fichaje y en la ficha del cliente | 🟡 | `TareaDetailModal` crea `time_log`, pero el fallo está reportado dos veces (6 y 31) |
| 31 | Reunión de 1 h con Carlos: no aparece ni en fichaje ni como terminada | 🟡 | Mismo origen que el 6 |

### 1.2 Fichaje y tiempo

| # | Propuesta | Estado | Evidencia / nota |
|---|---|---|---|
| 4 | Pipeline visible en fichajes para todos (a Carlos no le sale) | ❌ | `FicharClient` no consulta pipeline y `api/pipeline` exige admin (`route.ts:7-11`) |
| 24 | Carlos: el cronómetro deja la tarea activa, no mide y duplica la tarea | ❓ | Bug de estado del timer; hay que reproducirlo |
| 20 | Fichaje de la tarde de Verde Esmeralda no se asigna | ❓ | Pinta a dato sin `id_servicio`/`id_cliente`, no a código |
| 30 | Reunión de 4 personas: que se propaguen las 4 h | ✅ | `propagarTiempoReunion` (`time-logs/route.ts:214-247`) |
| 32 | Crear un servicio "REUNIONES/VISITAS" para medir ese tiempo | ❌ | Idea nueva; requiere servicio por defecto + asignación masiva |
| 41 | El tiempo de una tarea de proceso no suma al fichaje | ❌ | Sin vínculo tarea-de-proceso → `time_log` |

### 1.3 Procesos

| # | Propuesta | Estado | Evidencia / nota |
|---|---|---|---|
| 37 | Las tareas de procesos deben ficharse como tareas normales | ❌ | No hay relación entre fase y `tareas`/`time_logs` |
| 38 | Crear procesos desde la ficha del cliente | ❌ | No existe en `ClienteDetailClient` |
| 39 | Procesos repetibles mes a mes sin recargar plantilla | ❌ | Solo hay recurrencia por tarea (`RECURRENCIA_DIAS`) |
| 40 | Tarea de proceso terminada → a terminadas | ❓ | Depende de 37; sin vínculo no hay nada que mover |

### 1.4 Notificaciones y Slack

| # | Propuesta | Estado | Evidencia / nota |
|---|---|---|---|
| 12 | Apartado de notificaciones | ✅ | `NotificacionesPanel`, `api/notificaciones` |
| 17 | Mención en chat → notifica; y que aparezca el autor | 🟡 | DM por mención sí (`tareas/route.ts:120-190`); el autor del comentario ya se guarda (`autorId`) pero hay que revisar la vista |
| 18 | El botón lateral de notificaciones no funciona | ❓ | El panel existe; fallo de UI a reproducir |
| 26 | Al crear tarea, notificar por Slack a los añadidos | ✅ | `tareas/route.ts:165-190`: mensaje al canal + DM a cada responsable |
| 29 | Menciones → Slack al grupo del cliente + notificaciones | ✅ | Igual que 17/26 |
| 34 | Menciones con contexto: tarea, cliente y enlace | ✅ | `slackMsgNuevaTarea` incluye cliente, departamento y link (`route.ts:95-100`) |
| 28 | Automatización diaria a las 9:00 en Slack | ✅ | Cron `0 8 * * 1-5` + `api/slack/daily-tasks` |
| 1 | Cliente ganado en pipeline → crear cliente si no existe | ✅ | `api/pipeline/route.ts:102-103`, además migra `time_logs` |
| 25 | Al entrar en tareas, filtrado por tu persona | ✅ | `vista-global/page.tsx:32,38` (pestaña "empleado" por defecto) |
| 27 | Pantalla global con todas las tareas de todos | ✅ | `/tareas/vista-global` |

### 1.5 Plantillas, checklist, perfil

| # | Propuesta | Estado | Evidencia / nota |
|---|---|---|---|
| 14 | Editar el nombre de una plantilla | ✅ | `plantillas/page.tsx:102-107` |
| 15 | Eliminar una plantilla importada | ✅ | `plantillas/page.tsx:229` |
| 33 | Checklist: flechas fijas junto a la X y más grandes | ❌ | UI del checklist sin cambios |
| 19 | Foto de perfil en responsables y en el chat | 🟡 | Subida de avatar ✅ (`/api/avatares`), pero `TareaCard`, `TareaListItem` y `ChatMock` **no pintan avatar** |
| 23 | No deja añadir servicios nuevos (GPTAds) | ❓ | El CRUD existe (`api/tipos-servicio`, `ServiciosClient.tsx:54-82`); el fallo debe estar en el selector del formulario de servicio |
| 11 | El enlace de Slack no se guarda | 🟡 | La columna `tareas.enlace_info` existe; hay que verificar el guardado |

---

## 2. `J&A (1).pdf` — dos documentos en uno

### 2.1 Cambios de UI (verificables)

| Propuesta | Estado | Nota |
|---|---|---|
| Ampliación de letra | ❌ | Sin escala tipográfica global |
| Fondo beige/gris (web Siana) | 🟡 | En la rama local (`globals.css` modificado), no en producción |
| Centrar columnas de tareas activas | ❓ | Revisar `TareasShell` |
| Menú lateral con los clientes (ClickUp) | 🟡 | En rama local (`Sidebar.tsx`); producción no lo tiene |
| Fecha de captación real, por años desde 2023 | ✅ | Implementado en noviembre (doc §8) |
| Habilitar otros años de facturación por servicio | 🟡 | Depende de la UI de ingresos |
| Histórico/evolución por año en barras en la ficha | ✅ | `HistoricoFacturacionChart.tsx` (rama local) |
| Recuadro de % de rentabilidad en ficha y panel | ❓ | Ya hay columna de margen; falta el recuadro |
| Márgenes: rojo < 50 %, verde el resto | ❓ | Revisar `ClientesClient` |
| Cambiar mes arriba filtra todo, incluido "Horas fichadas" | ❓ | Revisar estado del filtro |
| Mover coste/hora junto a coste de personal | ❌ | Orden de columnas |
| Interna de servicio: todos los clientes + desplegable | 🟡 | Página nueva `/servicios/[id]` en rama local |
| Quitar bloque "Proyectos y servicios" y responsables | ❌ | Sigue existiendo |
| Evolución mensual en barras, no tabla | 🟡 | `EvolucionMensualChart.tsx` en rama local |
| Revisar la interna de Hosting | ✅ | Item 17 del PDF, resuelto por la página de tipo |
| Meta Ads no coge fichajes | ❌ | Item 18, pendiente. Requiere `SERVICE_ROLE_KEY` local |
| Verde Esmeralda: agrupar Meta Ads | ❌ | Item 19, pendiente |
| Tareas de ejemplo que aparecen en fichajes | ❌ | Item 20: es limpieza de datos (`mockData.ts`), no código |
| ¿Conectar Ceosiana con Claude? | 🟡 | Existe el MCP; falta interfaz dentro de la app |
| "Convertidor real" (10 % a project) | ⏸ | Aplazado por decisión del usuario (item 22) |

### 2.2 Visión "Panel personal del empleado"

Esto **no son mejoras: es un producto nuevo**. Ocho bloques, cada uno con dependencias externas:

| Bloque | Qué exige | Dificultad |
|---|---|---|
| Jerarquía cliente → proyecto principal → subproyectos | Modelo de datos nuevo + migración | Alta |
| Panel "Hoy" (reuniones, tareas, correos, Slack, entregas) | Agregador de 5 fuentes | Alta |
| Gmail dentro de la app (leer, responder, borradores) | Google OAuth con verificación, scopes restringidos | Muy alta |
| Slack dentro de la app (canales, menciones, responder) | OAuth por usuario + scopes de Slack | Alta |
| Google Ads / Meta Ads / TikTok Ads (inversión, CPA/ROAS) | MCC + Business Manager + revisión de app de Meta | Muy alta |
| GA4 / Tag Manager | API por usuario | Media |
| Asistente Claude contextual | API de Anthropic + permisos por usuario | Media |
| Portal del cliente + roles (experto/responsable/dirección) | Multi-rol, tokens públicos, visibilidad | Alta |

Estimación honesta: **6-9 meses** de una persona, y con bloqueos externos (aprobación de Meta, verificación de Google). No es un sprint.

---

## 3. Prioridad propuesta

Lo que más duele no son las features que faltan: es que **lo ya construido falla** en el núcleo (fichaje). Cinco arreglos de coste bajo y alto impacto:

| Orden | Arreglo | Por qué | Esfuerzo |
|---|---|---|---|
| 1 | `FicharClient.tsx:395` → incluir `id_servicio` al crear tarea | Rompe la imputación de costes de todas las tareas creadas desde el cronómetro | 10 min |
| 2 | Fichaje desde tareas/reuniones no imputa al cliente | Dos personas lo reportan; afecta a rentabilidad | 2-4 h |
| 3 | Cronómetro duplica tarea (Carlos) | Corrompe datos | 2-4 h |
| 4 | Pipeline visible para empleados al fichar | Bloquea a Carlos | 1 h |
| 5 | Fichar a todos los responsables de una tarea normal | Pedido explícito y coherente con reuniones | 2 h |

Después: mover checklist, avatar en tarjetas, filtro de servicios y los ítems de Meta Ads (18/19).

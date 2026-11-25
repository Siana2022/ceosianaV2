# Análisis del prototipo «Siana Hub»

**Fecha:** 12/11/2026
**Fuente:** `siana-hub-prototipo.zip` → `siana-hub-prototipo.html` (5 pantallas incrustadas, datos ficticios)
**Base comparada:** `main@159829f` + rama `feat/light-theme-clickup-sidebar` (con los 11 arreglos de hoy)

---

## 1. Qué es

Un prototipo de **panel personal del especialista**. No es un rediseño del panel de dirección: no aparecen Costes, Equipo, Rentabilidad, Dedicación ni Administración. Es la vista de "mi trabajo del día" del J&A (§ «Panel personal del empleado»).

Cinco pantallas: **Hoy · Calendario · Bandeja · Ficha de cliente · Portal del cliente**.

Navegación global: `Hoy · Bandeja clientes · Calendario · Tareas · Clientes · Conocimiento · Google Ads`.

Datos de ejemplo coherentes entre pantallas (Grupo Alba, Clínica Norte, Verde Hogar, Hotel Marina, Luma Cosmética), con la misma persona (Enrique) y las mismas reuniones y tareas en «Hoy» y en «Calendario».

---

## 2. Modelo de datos que se deduce del prototipo

Sacado del JS de cada pantalla, no de la maqueta.

```js
cliente   { id, nombre, iniciales, dominio }
contacto  { nombre, rol, iniciales, principal }
proyecto  { id, cliente, nombre, descripcion, visibilidad: compartida|interna,
            estado, progreso (0-100|null), esAds, fechaFin }
tarea     { id, cliente, proyecto, titulo, columna: todo|doing|review|done,
            vence, vencida, prioridad, visibilidad }
evento    { id, cliente, inicio, fin, titulo, donde, notas, asistentes, pasado|ahora }
hilo      { id, cliente, proyecto, asunto, estado: reply|wait, horas, noLeido,
            adjunto, resumen[], accion, mensajes[] }
mensaje   { direccion: in|out, de, para, hora, cuerpo, adjunto }
timeline  { tipo: in|cal|nota|ads, titulo, detalle, cuando, visibilidad }
```

Tres detalles muy reveladores:

1. **La tarea ya lleva `proyecto`**, no solo cliente. Es exactamente lo que acabamos de arreglar hoy con `tareas.id_servicio`.
2. **Cada elemento tiene visibilidad** (`compartida` / `interna`). Es la base del portal del cliente: se comparte lo marcado.
3. **Cada hilo de correo tiene `proyecto` y `acción`** ("Enviar la propuesta antes de las 11:00"). El correo no es una bandeja genérica: está clasificado por cliente y proyecto, y con una acción pendiente.

---

## 3. Mapeo a lo que ya existe

| Prototipo | En Ceosiana hoy | Veredicto |
|---|---|---|
| Cliente | `clientes` (nombre, activo, fecha_alta, slack_canal) | ✅ base; falta **dominio de correo** |
| Contacto del cliente | — | ❌ tabla nueva |
| Proyecto | `servicios` (nombre, tipo, precio, fechas, responsable) | 🟡 sirve de base; falta descripción, **visibilidad**, estado y progreso |
| Tarea → proyecto | `tareas.id_servicio` | ✅ **desde el arreglo de hoy**; falta visibilidad |
| Columnas del Kanban | `tareas.estado` (espera/proceso/bloqueada/terminado) | ✅ equivalente |
| Evento / reunión | `tareas` tipo reunión con `hora` + Google Calendar | 🟡 falta hora fin, lugar y asistentes |
| Vista Calendario | `/tareas` (lista y Gantt) | ❌ no hay vista mensual |
| Bandeja / hilos / mensajes | — | ❌ **Gmail** |
| Timeline del cliente | — | ❌ tabla nueva (agregación) |
| Conocimiento | — | ❌ tabla nueva |
| Google Ads | — | ❌ API + developer token |
| Portal del cliente | — | ❌ token público + vista |
| Alertas Google Ads | — | ❌ depende de la API |

**Resumen:** de las 12 piezas, 4 están cubiertas o casi, 4 necesitan tablas nuevas sencillas, 2 dependen de Gmail y 2 de Google Ads.

---

## 4. Plan de construcción en 4 bloques

### Bloque A — Lo que se puede hacer ya (sin integraciones)

| Trabajo | Esfuerzo |
|---|---|
| Proyectos en la ficha del cliente: descripción, estado, progreso, visibilidad | 4-5 días |
| Timeline del cliente (tareas + reuniones + notas, ordenado) | 2-3 días |
| Conocimiento: notas por cliente, marcables como compartidas | 2 días |
| Calendario mensual propio (reuniones y tareas, sin Google) | 4-5 días |
| Contactos del cliente | 1 día |

**Total: ~3 semanas.** Sin dependencias externas.

### Bloque B — Correo (el corazón del prototipo)

Conectar Gmail por empleado (OAuth **interno**, sin verificación de Google), bandeja filtrada por dominio de cliente, hilo, responder, y clasificar por proyecto con acción pendiente.

**Total: ~2-3 semanas.** Requiere: proyecto en Google Cloud, Gmail API, y **cerrar antes la seguridad de los tokens** (hoy `perfiles` es legible por cualquier usuario autenticado).

### Bloque C — Portal del cliente

Vista pública por token, solo lo marcado `compartida`: proyectos, avance, tareas, conocimiento y aprobaciones.

**Total: ~1 semana.** Depende del bloque A (visibilidad) y, si se quiere mostrar resultados de campañas, del bloque D.

### Bloque D — Google Ads

Cuentas, inversión, CPA/ROAS, alertas.

**Bloqueado por el developer token de Google Ads** (solicitud y revisión). No es tiempo de código: es cola de aprobación.

---

## 5. Decisiones que necesito de ti

1. **¿Sustituye o convive?** El prototipo es la vista del especialista. ¿La app de dirección (costes, equipo, rentabilidad) se mantiene tal cual y esto es una capa más, o quieres que el nuevo hub sea la puerta de entrada y lo demás viva dentro?
2. **¿Quién ve el hub?** ¿Solo especialistas, o también dirección?
3. **El correo, ¿todos los buzones o solo dominios de clientes?** Tiene implicaciones de privacidad que hay que decidir y comunicar al equipo.
4. **«Proyecto» = «servicio»?** En el prototipo, un cliente tiene 3-4 proyectos (Estrategia 2027, Google Ads · Captación, Landing Mirador). Hoy eso se parece a `servicios`, pero no es idéntico. ¿Aceptamos que proyecto = servicio, o son cosas distintas?

---

## 6. Riesgos

- **Seguridad:** no se puede conectar Gmail con la RLS actual de `perfiles`.
- **Dos apps en una:** si el hub no comparte modelo con el panel de dirección, acabas manteniendo dos productos.
- **Correo = dato personal:** política de uso y aviso al equipo antes de la fase B.
- **Google Ads:** puede tardar meses; no planificar el portal contando con datos de campañas.

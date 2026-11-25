# Propuestas y mejoras para ceosiana

Fecha: 25/11/2026, tras el lanzamiento. Basado en lo visto construyendo el hub,
el Creative Lab y el MCP.

Prioridad: **P0** = riesgo real · **P1** = duele a diario · **P2** = mejora.
Esfuerzo: **S** (horas) · **M** (días) · **L** (semanas).

---

## 1. Seguridad y datos

| # | Propuesta | Prioridad | Esfuerzo |
|---|---|---|---|
| 1 | **Cerrar la RLS de `sueldos`**: hoy cualquier usuario autenticado puede leer los sueldos de toda la plantilla. Debe ser solo administración | **P0** | S |
| 2 | **Revisar `perfiles`**: su política de lectura expone más de lo necesario (llegó a incluir tokens de Google) | **P0** | S |
| 3 | **Auditar el conector que vio facturación con llave operativa**: quedó sin aclarar y hay llaves en uso | **P0** | S |
| 4 | **Caducidad y auditoría de llaves MCP**: además de revocar, que caduquen solas y quede registro de qué consultó cada una | P1 | M |
| 5 | **Portal del cliente**: limitar intentos por IP, cabecera `noindex` y caducidad opcional del enlace | P1 | S |
| 6 | **Copias de seguridad**: confirmar que Supabase tiene *point-in-time recovery* activo y probar una restauración | P1 | S |

## 2. Fiabilidad

| # | Propuesta | Prioridad | Esfuerzo |
|---|---|---|---|
| 7 | **Monitorización de errores** (Sentry o similar). Hoy los fallos se escriben en consola y nadie los ve: así estuvo meses roto el portal sin que nadie lo notara | P1 | S |
| 8 | **Dejar de tragarse los errores de consulta**: varias pantallas devuelven “vacío” cuando la consulta falla (el caso de `servicios.descripcion`). Un helper común que registre y avise | P1 | S |
| 9 | **Pruebas mínimas**: ni una sola hoy. Empezar por 5-6 de humo: login, crear tarea, fichar, rentabilidad, portal, MCP | P1 | M |
| 10 | **Aviso si el cron falla**: si `CRON_SECRET` falta o Slack rechaza, que salte una alerta en vez de silencio | P1 | S |
| 11 | **Cierre mensual guiado**: comprobar facturación, sueldos y gastos del mes antes de cerrarlo, y avisar de lo que falte | P1 | M |

## 3. Rendimiento

| # | Propuesta | Prioridad | Esfuerzo |
|---|---|---|---|
| 12 | **Paginar `/api/tareas`**: hoy devuelve las 1.730 tareas completas en cada carga. Con 3.000 será notable | P1 | M |
| 13 | **Aprovechar `metricas_diarias` y `campanas`**: existen y están vacías. Guardar agregados evitaría recalcular rentabilidad en cada visita | P2 | L |
| 14 | **Índices de `time_logs`** por empleado+fecha y por servicio+fecha | P2 | S |
| 15 | **Cachear la ficha del cliente** unos minutos: hoy recalcula sueldos, fichajes e ingresos en cada visita | P2 | M |

## 4. Interfaz y uso diario

| # | Propuesta | Prioridad | Esfuerzo |
|---|---|---|---|
| 16 | **Quitar los parches de color de `globals.css`** y sustituirlos por variables de tema reales. Ya nos han mordido tres veces (textos invisibles) y cada pantalla nueva hay que revisarla a mano | P1 | M |
| 17 | **Móvil**: manifest + icono (PWA) para tenerla como app, y una pasada de responsive en Fichar y Tareas, que es donde se usa de pie | P1 | M |
| 18 | **Autocompletar tareas al fichar**: escribir una descripción muestra tareas existentes. Evita duplicados por “Revisar CRM” vs “Revisar el CRM” | P1 | S |
| 19 | **Buscador global**: una caja que encuentre tareas, clientes y notas sin saber en qué menú están | P2 | M |
| 20 | **Vistas guardadas en Tareas**: “mis vencidas”, “lo de Ceivan”, sin reconfigurar filtros cada vez | P2 | M |
| 21 | **Panel de administración de avisos**: ver de un vistazo servicios sin facturación, clientes sin servicio y fichajes sin imputar | P1 | S |

## 5. Datos y negocio

| # | Propuesta | Prioridad | Esfuerzo |
|---|---|---|---|
| 22 | **Aviso cuando falta el sueldo del mes**: hoy la rentabilidad sale al 100 % sin avisar (solo se marca “sin coste” en la tabla) | P1 | S |
| 23 | **Bloquear meses cerrados**: que no se puedan editar importes de meses ya presentados | P2 | M |
| 24 | **Reconciliación semanal automática**: tareas sin cliente, fichajes sin servicio, servicios sin facturación | P1 | M |
| 25 | **Histórico de cambios** en importes y sueldos: quién cambió qué y cuándo | P2 | M |

## 6. Creative Lab e IA

| # | Propuesta | Prioridad | Esfuerzo |
|---|---|---|---|
| 26 | **Terminar Meta**: el puente está hecho, falta el token del usuario del sistema | P1 | S (tu parte) |
| 27 | **Migrar la biblioteca de Claude** a Supabase: hoy sigue habiendo conocimiento atrapado allí | P1 | M |
| 28 | **Agrupar Meta/Google Ads por mercado** con desplegable (hoy se distinguen por la etiqueta) | P2 | S |
| 29 | **OAuth del MCP** para conectarlo desde claude.ai sin pegar URL con llave | P2 | M |
| 30 | **IA híbrida**: Claude para evaluar imágenes; DeepSeek para informes y resúmenes de texto si se automatizan | P2 | M |

## 7. Deuda técnica visible

- `public/creative-lab/index.html` es un artefacto de 300 KB con parches a mano.
  Funciona, pero cada cambio es delicado: conviene documentar los puntos tocados.
- `mcp-server/` (el paquete Node del MCP local) quedó sin uso tras el MCP real.
- `HUB_EMAILS` sigue en variables de entorno y ya no se usa.
- `.docs-pdf/` y los informes sueltos (`AUDITORIA.md`, `ANALISIS-*.md`) están sin
  versionar; conviene decidir si se guardan o se borran.

---

## Por dónde empezar

1. **`sueldos` con RLS cerrada** (P0, una hora). Es el agujero más serio y no
   requiere tocar código.
2. **Monitorización de errores** (P1, media hora). Sin esto, cualquier fallo
   futuro tarda semanas en descubrirse.
3. **Quitar los parches de color** (P1). Es la causa de la mitad de las quejas
   visuales de estas semanas.

Los tres son pequeños y quitan mucho ruido.

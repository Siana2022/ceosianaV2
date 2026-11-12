# Cambios y mejoras — Ceosiana · Noviembre 2026

Branch: `feat/light-theme-clickup-sidebar`  
Commit base: `c9f2b94` → Commit final: `9a4d08d`

---

## Resumen ejecutivo

Esta ronda de trabajo se centró en dos grandes áreas: **rediseño visual del sidebar y la autenticación** (tema más legible, estilo ClickUp) y **nuevas funcionalidades de negocio** en los módulos de Clientes y Servicios. No se ha hecho push — todos los cambios están en local, listos para revisión.

---

## 1. Rediseño visual del Sidebar

**Archivo:** `src/components/Sidebar.tsx` (+282 líneas / −155)

### Problema
El sidebar original tenía textos en gris muy claro sobre fondo oscuro. El ítem activo (sección seleccionada) apenas se diferenciaba visualmente del resto, dificultando la navegación.

### Cambios
- **Ítem activo**: fondo azul intenso (`bg-blue-600`) + texto blanco → contraste claro y reconocible.
- **Ítem hover**: fondo gris suave (`bg-gray-800`) + texto blanco, en lugar del gris desaturado anterior.
- **Texto inactivo**: subido de `text-gray-600` a `text-gray-400` para mayor legibilidad sin llegar a blanco.
- **Iconos**: alineados con el estado del ítem (blanco activo, gris claro inactivo).
- **Separadores y grupos**: revisados para mantener coherencia visual.
- **Estilo general**: inspirado en la barra lateral de ClickUp — más compacto, más limpio, mejor jerarquía visual.

---

## 2. Mejoras en la pantalla de Login

**Archivo:** `src/app/globals.css` (+116 líneas)

### Problema
Textos auxiliares del formulario de login (etiquetas, placeholders, enlace "¿Olvidaste tu contraseña?") aparecían en un gris demasiado claro, casi ilegibles sobre el fondo oscuro.

### Cambios
- Colores de texto del formulario ajustados: etiquetas a `text-gray-300`, texto de apoyo a `text-gray-400`.
- Enlace de recuperación de contraseña: `text-blue-400` con hover a `text-blue-300`.
- Mejora general del contraste en inputs y botones del formulario.

---

## 3. Item 8 — Advertencia de coste sin datos de sueldo

**Archivo:** `src/app/(app)/clientes/[id]/ClienteDetailClient.tsx`

### Problema
En la tabla de rentabilidad por servicio, cuando un empleado no tenía sueldo registrado en la tabla `sueldos`, el `coste_personal` era 0. Esto hacía que el margen apareciera como **100%**, un dato engañoso que podía llevar a conclusiones incorrectas de negocio.

### Solución
Se detecta la condición `sinDatosCoste`: cuando `coste_personal === 0` pero `totalMin > 0` (hay horas fichadas pero sin sueldo). En ese caso:
- La columna **% Margen** muestra `⚠ sin coste` en amarillo en lugar del porcentaje.
- El tooltip explica: *"Sin datos de sueldo para este mes"*.
- El margen no se calcula para no mostrar datos falsos.

```tsx
const sinDatosCoste = s.coste_personal === 0 && s.totalMin > 0
{sinDatosCoste
  ? <span className="text-yellow-500 text-xs" title="Sin datos de sueldo para este mes">⚠ sin coste</span>
  : pct !== null ? `${pct.toFixed(1)}%` : '—'
}
```

---

## 4. Item 14 — Página de detalle por Tipo de Servicio

**Archivos nuevos:**
- `src/app/(app)/servicios/[id]/page.tsx`
- `src/app/(app)/servicios/[id]/TipoServicioDetailClient.tsx`

**Archivo modificado:** `src/app/(app)/servicios/ServiciosClient.tsx`

### Qué hace
Cada tipo de servicio (ej. *Meta Ads*, *Hosting*, *SEO*) ahora tiene su propia página interna accesible desde `/servicios/[id]`.

### Contenido de la página
- **KPIs del año**: total facturado, número de clientes activos, MRR del tipo, número de instancias de servicio.
- **Selector de año** para cambiar el período analizado.
- **Lista de clientes** que tienen este tipo de servicio, con:
  - Número de servicios de ese tipo contratados.
  - Facturación del año seleccionado.
  - Toggle para expandir y ver cada instancia de servicio en detalle (nombre, tipo, precio base, fechas, departamento, responsable, facturado en el año).
  - Enlace directo al detalle de cada cliente.

### Acceso desde el catálogo
En la pestaña **Catálogo** de `/servicios`, el nombre del tipo ahora es un enlace clickable a su página de detalle. Lo mismo en la pestaña de servicios individuales, donde el tipo aparece como enlace.

---

## 5. Item 17 — Verificación Hosting

La nueva página `/servicios/[id]` permite revisar directamente el tipo *HOSTING* y ver qué clientes lo tienen contratado, qué se ha facturado en el año y el estado de cada instancia. No requería cambios de código adicionales: se beneficia directamente del Item 14.

---

## 6. Item 5 — Año de captación en lista de clientes + Histórico en detalle

### 6a. Lista de clientes `/clientes`

**Archivos:** `src/app/(app)/clientes/page.tsx`, `src/app/(app)/clientes/ClientesClient.tsx`

Cada cliente en la lista ahora muestra el **año de captación** en azul debajo del nombre:

```
Nombre del cliente
Captado 2024
```

Si no hay captación registrada, se muestra el año de alta como texto gris más discreto.

**Cambios técnicos:**
- La query de `captacion_clientes` ahora incluye `fecha_inicio`.
- El map de enriquecimiento propaga `fecha_captacion` al objeto cliente.
- La interfaz `Cliente` en `ClientesClient.tsx` incluye el nuevo campo.

### 6b. Histórico de captaciones en detalle del cliente

**Archivos:** `src/app/(app)/clientes/[id]/page.tsx`, `src/app/(app)/clientes/[id]/ClienteDetailClient.tsx`

En el detalle de un cliente, si existen **múltiples entradas** en `captacion_clientes` (historia de quién captó y quién mantuvo a lo largo del tiempo), aparece una tabla de histórico bajo el bloque principal de captación.

**Tabla de histórico:**
| Año | Captador | Mantenedor | Inicio | Fin |
|-----|----------|------------|--------|-----|
| 2023 | Juanjo | María | 2023-01-15 | 2024-03-01 |
| 2024 | Sara | Juanjo | 2024-03-01 | — |

- Filtrada desde 2023 en adelante.
- Solo se muestra si hay más de 1 entrada (evita redundancia cuando solo hay una).

**Cambios técnicos:**
- Se eliminó el `.limit(1)` de la query en `page.tsx` → ahora trae todas las captaciones.
- Se pasa `captaciones={captacion ?? []}` como nueva prop.
- Se añadió `captaciones?: Captacion[]` a la interfaz `Props` y al destructuring de la función.

---

## 7. Correcciones técnicas

### RLS en `/servicios/[id]`
La query inicial intentaba filtrar ingresos por `id_tipo_servicio` directamente (columna inexistente). Corregido: se obtienen primero los IDs de servicios del tipo y luego se consultan ingresos con `.in('id_servicio', servicioIds)`.

### TypeScript
Todas las modificaciones pasan `CI=true npx tsc --noEmit` sin errores.

---

## Archivos modificados (resumen)

| Archivo | Tipo de cambio |
|---------|---------------|
| `src/components/Sidebar.tsx` | Rediseño visual completo |
| `src/app/globals.css` | Mejoras de contraste login |
| `src/app/(app)/clientes/page.tsx` | Añade `fecha_captacion` y todas las captaciones |
| `src/app/(app)/clientes/ClientesClient.tsx` | Muestra año de captación en lista |
| `src/app/(app)/clientes/[id]/page.tsx` | Elimina `.limit(1)`, pasa prop `captaciones` |
| `src/app/(app)/clientes/[id]/ClienteDetailClient.tsx` | ⚠ sin coste + histórico captaciones |
| `src/app/(app)/servicios/ServiciosClient.tsx` | Nombre de tipo → enlace a detalle |
| `src/app/(app)/servicios/[id]/page.tsx` | **NUEVO** — servidor del detalle por tipo |
| `src/app/(app)/servicios/[id]/TipoServicioDetailClient.tsx` | **NUEVO** — UI del detalle por tipo |

---

## Items pendientes (del PDF original)

| Item | Estado | Notas |
|------|--------|-------|
| 8 | ✅ Hecho | ⚠ sin coste en rentabilidad |
| 14 | ✅ Hecho | Página detalle por tipo de servicio |
| 17 | ✅ Verificado | Usa la página del Item 14 |
| 5 | ✅ Hecho | Año captación en lista + histórico en detalle |
| 18 | ⏳ Pendiente | Meta Ads sin fichajes — requiere `SUPABASE_SERVICE_ROLE_KEY` local |
| 19 | ⏳ Pendiente | Verde Esmeralda: agrupación automática Meta Ads — requiere investigar datos |
| 20 | ⏳ Pendiente | Tareas de ejemplo borradas en /fichar y /análisis-equipo (revisar primero) |
| 22 | ⏳ Aplazado | Bloque "convertidor real" — usuario pidió esperar |

---

> **Nota:** Ningún cambio ha sido pusheado. Todo está en local en la rama `feat/light-theme-clickup-sidebar`.

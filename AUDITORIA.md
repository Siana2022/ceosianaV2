# Auditoría técnica — ceosianaV2

**Fecha:** 12/11/2026
**Commit auditado:** `159829f` (`main`) — *fix: cron daily-tasks a las 08:00 UTC*
**Alcance:** 26.728 líneas en `src`, 167 ficheros, 52 rutas API, 27 rutas de aplicación.
**Método:** revisión estática + instalación limpia + `tsc`, `eslint` y `next build`.

---

## 1. Resumen ejecutivo

El proyecto está **funcionalmente sano**: compila sin errores de TypeScript y el build de producción genera las 44 rutas. La arquitectura general es razonable (Server Components con `Promise.all`, Supabase SSR, API routes finas).

El problema no es la calidad del código de negocio, sino **la superficie de seguridad**: hay **tres vías directas para acceder a datos de dirección sin credenciales** (clave MCP, Slack, buckets públicos), y el control de acceso por rol está implementado en un único punto (el proxy) que tiene huecos.

| Área | Estado | Nota |
|---|---|---|
| TypeScript | ✅ 0 errores | `tsc --noEmit` limpio |
| Build producción | ✅ OK | 44 rutas, `ƒ Proxy (Middleware)` detectado |
| ESLint | ❌ 14 errores / 33 warnings | `npm run lint` **falla** (reglas React Compiler) |
| Tests | ❌ 0 | Sin framework ni un solo test |
| CI/CD | ❌ No hay | Sin `.github/`, sin gate de calidad |
| Cobertura de authz | ⚠️ Parcial | 3 endpoints críticos abiertos, 2 rutas sin rol |
| RLS | ⚠️ No versionada | El esquema base vive solo en Supabase |

### Prioridad recomendada

1. **Cerrar MCP** (crítico, ~2 h).
2. **Cerrar Slack** (crítico, ~3 h).
3. **Subidas y buckets** (alto, ~4 h).
4. **Proxy + rutas sin rol** (alto, ~2 h).
5. **Google OAuth** (alto, ~2 h).
6. **RLS versionada y test de permisos** (alto, ~1 día).
7. Resto (medio/bajo) según el plan de la §6.

---

## 2. Línea base verificada

```bash
npm ci                              # 481 paquetes, 0 vulnerabilidades reportadas
npx tsc --noEmit                    # exit 0
npm run lint                        # 47 problemas (14 errores, 33 warnings)
npm run build                       # OK, 44 rutas
```

Métricas del código:

| Métrica | Valor |
|---|---|
| Ficheros `'use client'` | 59 |
| Llamadas `fetch(` | 157 |
| `select('*')` | 23 |
| `as any` / `: any` | 10 |
| `catch {}` vacíos | 8 |
| `console.error` | 83 |
| `error.tsx` / `loading.tsx` / `not-found.tsx` | 0 / 0 / 0 |
| Tests | 0 |

Ficheros más grandes (candidatos a refactor):

| Fichero | Líneas |
|---|---|
| `src/app/(app)/clientes/[id]/ClienteDetailClient.tsx` | 2.162 |
| `src/app/(app)/fichar/FicharClient.tsx` | 1.491 |
| `src/app/(app)/costes/CostesClient.tsx` | 1.170 |
| `src/app/(app)/informes/InformesClient.tsx` | 890 |
| `src/app/(app)/tareas/store.tsx` | 826 |

---

## 3. Hallazgos críticos (P0)

### P0-1 · El endpoint OAuth de MCP entrega la API key a cualquiera

**Dónde:** `src/app/api/mcp/token/route.ts:30`, `src/app/api/mcp/route.ts:7-9`, `src/app/api/mcp/register/route.ts:25`, `src/app/api/mcp/authorize/route.ts:43-45,63`

El flujo OAuth es una simulación: no hay `authorization_code` real, ni PKCE, ni validación de cliente.

```ts
// token/route.ts:30 — devuelve la clave estática sin comprobar nada
const token = process.env.CEOSIANA_MCP_KEY ?? 'ceosiana-mcp-siana'
return cors(NextResponse.json({ access_token: token, token_type: 'Bearer', expires_in: 31536000 }))
```

Un `POST /api/mcp/token` con `{"grant_type":"authorization_code"}` devuelve `access_token = CEOSIANA_MCP_KEY`. Con esa clave se accede a **todos** los tools de `src/app/api/mcp/route.ts`: `get_rentabilidad`, `get_costes` (sueldos), `get_fichajes`, `get_clientes`, `get_empleados`, `get_comercial`…

Además:

- `route.ts:7-9` → si `CEOSIANA_MCP_KEY` no está definida, **el endpoint queda abierto** (`if (!key) return true`).
- `route.ts:11` → acepta la clave por query string (`?key=`), que se registra en logs de Vercel/CDN.
- `authorize/route.ts:43-45` → interpola `redirect_uri`, `state` y `client_id` en HTML **sin escapar** → XSS reflejado (`?redirect_uri="><script>…`).
- `authorize/route.ts:63` → `new URL(redirectUri)` + `redirect()` con URL arbitraria → **open redirect**; el `code` se entrega a cualquier dominio.
- No hay comprobación de sesión en `authorize` (`GET`/`POST`): el botón "Permitir acceso" no verifica quién pulsa.

**Impacto:** exfiltración completa de datos financieros y de equipo sin autenticación. Es el hallazgo más grave del repo.

**Propuesta:**

1. Eliminar `token`, `register`, `authorize` y `.well-known` si el uso real es "Claude con una key fija".
2. Si se mantiene MCP, sustituir por **API key en header** (`Authorization: Bearer`) validada con `timingSafeEqual`, exigida siempre (fail-closed), y **nunca** por query string.
3. Si se quiere OAuth de verdad: usar `@supabase/ssr` para autenticar en `/authorize`, generar `code` de un solo uso con caducidad (tabla `oauth_codes`), validar `redirect_uri` contra una allowlist y verificar PKCE en `/token`.
4. Escapar todo lo interpolado en HTML (`escapeHtml`) y validar `redirect_uri` con `new URL()` + allowlist de orígenes.

---

### P0-2 · La verificación de firma de Slack falla en abierto y hay endpoints sin autenticar

**Dónde:** `src/lib/slack.ts:10-21`, `src/app/api/slack/notify/route.ts:7`, `src/app/api/slack/dm/route.ts:7`, `src/app/api/slack/test/route.ts:14`, `src/app/api/slack/test-mention/route.ts:7`, `src/app/api/slack/timer-warning/route.ts:6`

```ts
// lib/slack.ts:11-12
const secret = process.env.SLACK_SIGNING_SECRET ?? ''
if (!secret) return true          // ← fail-open
```

Si la variable no está configurada en Vercel (o se rota mal), **cualquiera puede falsificar eventos de Slack**. Y como los handlers usan `createAdminClient()` (service role), pueden crear fichajes, mover tareas y notificar en nombre de la empresa.

Además faltan dos comprobaciones en la propia verificación:

- **No se valida el timestamp** (`x-slack-request-timestamp`) → replay de una petición capturada, indefinidamente.
- No se comprueba que el timestamp esté dentro de ±5 min (lo exige Slack).

Endpoints que ni siquiera llaman a `verifySlackSignature` y usan service role:

| Endpoint | Qué permite |
|---|---|
| `POST /api/slack/notify` | Publicar en el canal de Slack de **cualquier cliente** con el bot de la empresa |
| `POST /api/slack/dm` | Enviar DM a cualquier empleado |
| `GET /api/slack/test` | Devuelve `token_prefix` del `SLACK_BOT_TOKEN` y datos del workspace |
| `GET /api/slack/test-mention` | Resuelve `slack_user_id` → email y perfil completo de cualquier usuario |
| `POST /api/slack/timer-warning` | Enviar DMs arbitrarios a los admins |

**Impacto:** spam/phishing interno con el bot oficial, enumeración de empleados y fuga parcial de credenciales. Si además el secret falta, escalada a escritura de datos.

**Propuesta:**

```ts
// lib/slack.ts
export function verifySlackSignature(req: NextRequest, body: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret) return false                       // fail-closed
  const ts = Number(req.headers.get('x-slack-request-timestamp') ?? 0)
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false   // anti-replay
  const sig = req.headers.get('x-slack-signature') ?? ''
  const expected = `v0=${crypto.createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex')}`
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}
```

Y para `notify`/`dm`: exigir sesión de usuario (`getUser()`) o un secreto interno (`SLACK_INTERNAL_SECRET`) con `timingSafeEqual`. `test` y `test-mention` deberían **eliminarse en producción** o protegerse con `isAdmin()`.

---

## 4. Hallazgos altos (P1)

### P1-1 · Subida de ficheros sin validar tipo ni tamaño, a buckets públicos

**Dónde:** `src/app/api/avatares/route.ts:20-27`, `src/app/api/tareas/imagenes/route.ts:19-25`, `src/app/api/editorial/imagenes/route.ts:17-24`

```ts
const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'   // extensión del nombre, sin sanear
await admin.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: true })
```

- Se confía en `file.type` y en la extensión que envía el cliente.
- Sin límite de tamaño → un usuario autenticado puede llenar el Storage.
- Buckets **públicos** (`getPublicUrl`): un `.svg` o `.html` servido desde el dominio de Supabase puede ejecutar scripts → **XSS almacenado** (origen distinto, pero rompe la CSP futura y engaña a usuarios).
- `src/app/(app)/editorial/imagenes` y avatares no comprueban que el recurso pertenezca al usuario (avatares sí usa `perfil.id_empleado`, correcto).

**Propuesta:** allowlist de MIME (`image/jpeg|png|webp`), límite de 2-5 MB, reutilizar un helper `validateImageUpload(file)`, generar nombre con `crypto.randomUUID()` y extensión derivada del MIME (no del nombre), y mantener los buckets privados sirviendo con signed URLs si el contenido es sensible.

### P1-2 · Cualquier usuario autenticado puede borrar cualquier imagen de tareas

**Dónde:** `src/app/api/tareas/imagenes/route.ts:38-52`

`DELETE` extrae el path de la URL pública y llama a `remove([path])` con service role, **sin comprobar que la imagen pertenezca a una tarea del usuario**. Un empleado puede borrar el material gráfico de cualquier tarea.

**Propuesta:** buscar el path en el registro de la tarea (o usar una tabla `tarea_adjuntos`) y autorizar por responsable/admin.

### P1-3 · Huecos de autorización en el proxy (y `getSession` en servidor)

**Dónde:** `src/proxy.ts:9-25` (allowlist de rutas protegidas), `:42`, `:55-59`

El proxy solo protege una lista cerrada de prefijos. Comparando con las rutas reales:

| Ruta | ¿Pasa por el control de rol? | ¿Tiene guard en la página? |
|---|---|---|
| `/editorial`, `/editorial/[clienteId]` | ❌ No | ❌ **No** |
| `/desactivados` | ❌ No | ❌ **No** |
| `/pipeline` | ❌ No | ✅ `redirect('/fichar')` |
| `/informes` | ❌ No | ✅ `redirect('/fichar')` |
| `/perfil` | ❌ No (solo lista de rol) | ✅ (es su propio perfil) |

La sesión sí se exige en `src/app/(app)/layout.tsx:8-12`, así que no hay acceso anónimo; pero **un empleado con sesión válida puede abrir `/editorial` y ver el listado completo de clientes**, y `/api/editorial/*` solo pide sesión (no rol), así que puede leer y editar los tableros editoriales de cualquier cliente.

Además `getSession()` (`proxy.ts:42`, `layout.tsx:8`, `lib/server/perfil.ts:12`) **no valida el JWT** contra Supabase; para decisiones de autorización en servidor debe usarse `getUser()`.

**Propuesta:**

1. Invertir el modelo: proteger por defecto y permitir explícitamente (`/fichar`, `/tareas`, `/perfil`, `/alertas`) para `empleado`; el resto, solo `admin`.
2. Reutilizar un helper `requireAdmin()` (ya existe en `src/app/api/pipeline/route.ts:7-11`) en páginas y APIs sensibles.
3. Cambiar `getSession()` → `getUser()` en proxy, layout y `getPerfil()`.

### P1-4 · Google OAuth: `state` sin ligar a la sesión y callback sin autenticar

**Dónde:** `src/app/api/auth/google/route.ts:9`, `src/app/api/auth/google/callback/route.ts:9-24`

`state` es el `userId` en claro y el callback **no comprueba sesión**: acepta `code` + `state` y escribe `google_refresh_token` en `perfiles.id = state` con service role.

**Impacto:** *account linking CSRF* — un atacante puede conseguir que la cuenta de Google que él controla quede vinculada al perfil de otra persona (si conoce su UUID), y desde ese momento los eventos de calendario de las tareas de la víctima se crean en el calendario del atacante. También permite sobrescribir tokens ajenos.

**Propuesta:** generar `state` aleatorio de un solo uso (cookie `httpOnly` + tabla/Redis), verificarlo en el callback, exigir `getUser()` y escribir solo `eq('id', user.id)` **del usuario autenticado**, no del `state`.

### P1-5 · RLS no versionada en el repo y, probablemente, permisiva

**Dónde:** `supabase/migrations/` (solo 6 migraciones; falta el esquema base: `clientes`, `empleados`, `sueldos`, `ingresos`, `time_logs`, `tareas`, `perfiles`…)

El esquema real vive únicamente en Supabase. Consecuencias:

- No se puede reproducir el entorno ni revisar las políticas en code review.
- `src/app/(app)/dashboard/page.tsx:29` lee `sueldos` con el **cliente de usuario** (anon + JWT del usuario). Para que el dashboard muestre datos, la política RLS de `sueldos` tiene que permitir `SELECT` a cualquier `authenticated`. Si es así, **cualquier empleado puede leer los sueldos de todos** llamando a `/api/sueldos` o directamente a PostgREST con su propia sesión (el proxy excluye `/api` y PostgREST no pasa por Next).
- Varias APIs financieras (`/api/costes`, `/api/ingresos`, `/api/administracion`, `/api/gastos-fijos`) no tienen guardia propia y dependen exclusivamente de RLS.

**Propuesta (a verificar con acceso a la BD):**

1. `supabase db dump --schema public > supabase/migrations/00000000000000_init.sql` para versionar el esquema y las políticas actuales.
2. Revisar `pg_policies` y aplicar el principio de mínimo privilegio: `sueldos`, `costes`, `ingresos`, `control_facturacion` solo `admin`; `time_logs` el propio empleado o admin; `clientes` lectura para todos (los usan las tareas).
3. Test automatizado de permisos (ver §6, fase 4): con un JWT de `empleado`, comprobar que `GET /rest/v1/sueldos` devuelve 0 filas.

---

## 5. Hallazgos medios (P2)

| # | Hallazgo | Dónde | Impacto |
|---|---|---|---|
| P2-1 | `/api/time-logs/propagar` crea fichajes **para otros empleados** con service role, sin comprobar que el solicitante sea responsable de la tarea ni admin | `src/app/api/time-logs/propagar/route.ts:6-30` | Integridad de nóminas/horas; un empleado puede imputar horas a un compañero |
| P2-2 | `error.message` de Postgres devuelto al cliente en ~40 handlers | p. ej. `clientes/route.ts:13,31` | Fuga de nombres de tablas/columnas y detalles de infraestructura |
| P2-3 | `catch {}` vacíos (8) silencian fallos de cookies, localStorage y migraciones | `lib/server/supabase.ts:17`, `tareas/store.tsx:194`, `costes/*` | Errores invisibles en producción |
| P2-4 | Sin *rate limiting* en login, `/api/mcp`, Slack, subidas | `src/app/login/actions.ts:19` | Fuerza bruta y abuso de recursos |
| P2-5 | `getPerfil()` se ejecuta 2-4 veces por navegación (layout + página + helper), cada una con su consulta | `layout.tsx:14`, `perfil.ts:10` | Latencia extra y 2-4 queries idénticas por request |
| P2-6 | `NEXT_PUBLIC_SITE_URL` sin fallback: si falta, el enlace de recuperación es `undefined/login/update-password` | `src/app/login/actions.ts:11` | Recuperación de contraseña rota en silencio |
| P2-7 | Sin cabeceras de seguridad (CSP, `X-Frame-Options`, `Referrer-Policy`) | `next.config.ts` | Clickjacking, XSS sin contención |
| P2-8 | `redirect_uri` de MCP y `state` de Google acaban en URLs de terceros sin allowlist | `mcp/authorize`, `google/callback` | Open redirect / fuga de parámetros |

---

## 6. Calidad, DX y rendimiento (P3)

### Lint (bloquea CI hoy)

`npm run lint` falla con **14 errores**, casi todos de la regla de React Compiler `react-hooks/set-state-in-effect`:

`fichar/FicharClient.tsx:89`, `perfil/page.tsx:64,67`, `tareas/components/TareaCard.tsx:30`, `TareaListItem.tsx:27`, `TareaDetailModal.tsx:74`, `tareas/store.tsx:194`, `tareas/vista-global/page.tsx:45`, `editorial/[clienteId]/BoardClient.tsx:372`, `NotificacionesPanel.tsx:107`, más `prefer-const` (`FicharClient.tsx:252,286`) y `react/no-unescaped-entities` (`RichTextEditor.tsx:126`).

No son solo estilo: `setState` sincrónico dentro de `useEffect` provoca renders en cascada. En `NotificacionesPanel` se dispara un `fetch` en cada montaje; en `store.tsx` se rehidrata el timer desde `localStorage` en un efecto que luego actualiza todo el array de tareas.

**Propuesta:** inicializar el estado con `useState(() => leerLocalStorage())`, extraer la lógica a `useSyncExternalStore` para el timer, y arreglar los `prefer-const` a mano. Objetivo: `npm run lint` en verde y añadirlo como gate.

### Tests y CI

No hay ni un test ni pipeline. El repo tiene lógica de negocio con dinero (prorrateo de coste por minutos, MRR, márgenes, `dedicacionCalculada.ts`) que merece tests unitarios puros antes que E2E.

**Propuesta mínima:**

- `vitest` para `lib/server/dedicacionCalculada.ts`, `tareas/conflictos.ts`, cálculos de Clientes/Costes.
- Un test de integración de permisos (P1-5).
- `.github/workflows/ci.yml` con `tsc --noEmit`, `lint`, `test`, `build`.

### Sin fronteras de error

No existe ningún `error.tsx`, `loading.tsx` ni `not-found.tsx`. Si una query de Supabase falla, el usuario ve una pantalla en blanco o el error genérico de Next.

**Propuesta:** un `src/app/(app)/error.tsx` y `loading.tsx` a nivel de grupo (y opcionalmente por módulo pesado: `/clientes/[id]`, `/costes`, `/tareas`).

### Rendimiento

1. **`tareas/layout.tsx:31` carga todas las tareas** (`select('*')`, sin filtro ni paginación) para todos los clientes en **cada** navegación del módulo. Con el histórico creciendo, esto se convierte en un payload de MBs dentro del RSC. Propuesta: cargar por rango (mes/trimestre), o paginar por columna Kanban, y no enviar el HTML enriquecido de cada tarea al listado.
2. **157 `fetch` en cliente** → cada acción modal hace ida y vuelta a `/api/*`. Muchas podrían ser Server Actions o mutaciones directas con `revalidatePath`.
3. **`select('*')` en 23 sitios**, varios en páginas (p. ej. `tareas/layout.tsx:31-33`, `clientes/[id]/page.tsx:31`). Seleccionar columnas explícitas reduce payload y evita exponer campos nuevos por accidente.
4. **Monolitos de 2.000 líneas**: `ClienteDetailClient` mezcla KPIs, servicios, captación, gastos, ingresos y responsables en un componente. Partir en `ClienteKPIs`, `ClienteServicios`, `ClienteGastos`, `ClienteIngresos` con estado local por pestaña.
5. **Sin `loading.tsx`** no hay streaming: el usuario espera a que terminen todas las queries de la página.

### DX

- `README.md` es el boilerplate de `create-next-app`: no explica módulos, variables de entorno ni cómo obtener las claves.
- No hay `.env.example`. Variables detectadas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `APP_URL`, `CRON_SECRET`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CEOSIANA_MCP_KEY`, `VERCEL_PROJECT_PRODUCTION_URL`.
- `next.config.ts` fija `allowedDevOrigins: ['192.168.5.136']` (IP de una máquina concreta).
- `package.json` sin `engines` (Next 16 exige Node ≥ 20.9).
- Comentario del cron desactualizado: `vercel.json` dice `0 8 * * 1-5` (08:00 UTC) y `slack/daily-tasks/route.ts:5` dice "07:00 UTC".

---

## 7. Plan de acción propuesto

| Fase | Trabajo | Esfuerzo | Resultado |
|---|---|---|---|
| **0. Bloqueo** | Rotar `CEOSIANA_MCP_KEY`, `SLACK_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` si el repo estuvo expuesto; desactivar `/api/mcp/token`, `/register`, `/authorize`; desplegar | 2-3 h | Cierra P0-1 y P0-2 |
| **1. Authz** | Fail-closed en Slack + anti-replay; guardias en `notify`/`dm`/`test`; proxy por defecto-deny; `getUser()`; guard en `/editorial` y `/desactivados`; `requireAdmin` compartido | 1 día | P0-2, P1-3 |
| **2. Ficheros** | Validación MIME/tamaño, nombres aleatorios, ownership en `DELETE`, buckets privados + signed URLs | 4 h | P1-1, P1-2 |
| **3. OAuth Google** | `state` de un solo uso ligado a sesión, callback autenticado | 3 h | P1-4 |
| **4. Datos** | Volcar esquema + políticas a `supabase/migrations`, endurecer RLS, test de permisos con JWT de empleado | 1 día | P1-5, P2-1 |
| **5. Robustez** | Errores genéricos al cliente + logging, `error.tsx`/`loading.tsx`, rate limit en login/MCP, cabeceras de seguridad | 1 día | P2-2…P2-7 |
| **6. Calidad** | Arreglar los 14 errores de lint, tests de lógica de negocio, CI con `tsc`+`lint`+`test`+`build` | 2 días | P3 lint/tests |
| **7. Rendimiento** | Paginar tareas, `loading.tsx` con streaming, partir `ClienteDetailClient`, reducir `select('*')` | 2-3 días | P3 rendimiento |
| **8. DX** | `README` real, `.env.example`, `engines`, limpiar `allowedDevOrigins` | 2 h | Onboarding |

Total orientativo: **~8-9 días** de una persona. Las fases 0-2 son las que reducen riesgo real y caben en dos jornadas.

---

## 8. Verificación pendiente (necesito credenciales)

Para convertir las hipótesis en hechos necesito, en un entorno de **pruebas**:

1. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. Un usuario de prueba con rol `empleado` (email/contraseña) para comprobar:
   - si `/editorial` y `/desactivados` son accesibles;
   - si `GET /api/sueldos` y `GET /rest/v1/sueldos` devuelven datos;
   - si `GET /api/mcp` responde sin cabecera.
3. Acceso al SQL editor (o `supabase db dump`) para volcar `pg_policies` y el esquema base.

Con eso puedo entregar, además del informe, los parches de las fases 0-2 ya verificados contra la app en local.

---

## 9. Anexo · Cosas que están bien y conviene preservar

- `time-logs/route.ts` valida correctamente la propiedad de los fichajes en `PATCH`/`DELETE` (`:165`, `:261`).
- `isAdmin()` y `getPerfil()` hacen *fail-closed*: perfil ausente ⇒ `empleado` (`perfil.ts:41`).
- `propagar` evita duplicados comprobando `id_tarea` + `id_empleado` (`:227-230`).
- `clientes/page.tsx` pagina `time_logs` en bloques de 1.000 conscientemente (`:56-66`).
- Las páginas servidor usan `Promise.all` para paralelizar queries (dashboard, clientes, tareas).
- `editorial` y `configuracion` tienen migraciones con RLS explícita y comentada: buen patrón a extender al resto.
- El `build` funciona sin variables de entorno reales, lo que facilita montar CI.

---

## 10. Contexto del proyecto (documento de estado, nov 2026)

Fuente: `docs/ceosiana-estado-completo.md` (748 líneas) + panel de Vercel.

### 10.1 Qué confirma

- **Producción = `main@159829f`**, el mismo commit auditado. Los hallazgos no son de una rama local: están desplegados.
- **MCP se usa** como herramienta de dirección desde Claude Code → no se elimina: se cierra el agujero de `/api/mcp/token` y se conservan los tools.
- **Slack está en uso activo** y `SLACK_SIGNING_SECRET` está configurado en Vercel → el *fail-open* de `lib/slack.ts:12` es hoy latente, no activo. Sigue siendo prioritario: se convierte en brecha el día que se rote o falte la variable.
- **`/editorial` es de uso activo** → su falta de control de rol deja la cartera de clientes visible a cualquier empleado.
- El equipo **ya conocía** el hueco de acceso por URL (§12 y §15 del documento). Este informe añade que afecta también a `/editorial` y `/desactivados`, y que el proxy es el punto único de fallo.
- `SUPABASE_SERVICE_ROLE_KEY` **no está en `.env.local`** (confirmado: solo hay `APP_URL`, `GOOGLE_*`, `SUPABASE_URL`, `ANON_KEY`). Cualquier verificación en local que use `createAdminClient()` fallará hasta hacer `vercel env pull`.

### 10.2 Qué corrige del documento

| Afirmación del documento | Realidad verificada |
|---|---|
| Repo `Siana2022/EmpresaSaaS.git` | Remoto real: `Siana2022/ceosianaV2.git` |
| "Vercel falla por warnings de ESLint con `CI=true`" | `CI=true npm run build` pasa con 14 errores de lint (exit 0). Next 16 **no** ejecuta ESLint en build; los fallos eran de **TypeScript**. La regla correcta es `tsc --noEmit && build && lint` por separado |
| "Rutas con sueldos usan `createAdminClient()`" | `dashboard/page.tsx:29` lee `sueldos` con el cliente normal. O la RLS es más permisiva de lo que se cree, o el P&L muestra sueldos = 0. **Pendiente de verificar** |
| 270 commits | 270 en local, 269 en `main` (falta `9a4d08d`, sin push) |

### 10.3 Prioridad revisada

1. **P0-1 MCP** — sigue siendo lo más urgente: `/api/mcp/token` entrega la key a cualquiera, y el endpoint está en un dominio público.
2. **P1-3 Control de acceso por URL** — sube de prioridad: `/editorial` es de uso diario y expone clientes; el arreglo es pequeño (proxy por defecto-deny + `requireAdmin` en páginas).
3. **P0-2 Slack** — baja de "crítico hoy" a "fallo latente", pero se arregla en la misma sesión que MCP.
4. **P1-5 RLS / sueldos** — sube: hay una contradicción entre lo documentado y el código que puede estar falseando el beneficio del dashboard.
5. `/informes` (890 líneas, sin adopción) — no invertir; candidato a eliminar en el futuro.

### 10.4 Estado del árbol de trabajo

- `main` (producción y clon): limpio.
- `feat/light-theme-clickup-sidebar` (solo en el Desktop): 1 commit + 9 ficheros modificados + 3 nuevos, **sin push**.
- Ficheros de seguridad (`proxy.ts`, `slack.ts`, `mcp/*`, `google/callback`) idénticos entre ambos → los parches aplican igual.
- Solape previsto entre el hotfix de seguridad y la rama de UI: **ninguno** (la rama toca `Sidebar`, `globals.css`, `layout`, `clientes`, `departamentos`, `servicios`).

# Plan SaaS Editorial — Publicación en Redes Sociales

## El problema central

Publicar en Instagram/Facebook requiere una **Meta App aprobada por Meta**. No hay atajos reales. Todas las herramientas del mercado (Buffer, Metricool, Later, Ayrshare) han pasado por ese proceso. La diferencia es quién asume el trámite:

- **Ayrshare, Buffer, Later** → ellos ya la tienen, tú pagas por usarla (~29-100€/mes)
- **Make, Zapier, n8n Cloud** → ellos ya la tienen, tú pagas por usarla
- **n8n self-hosted** → no funciona para Instagram (Meta bloquea OAuth en instancias self-hosted)
- **Meta App propia** → gratis para siempre, una sola vez, 2-4 semanas de trámite

---

## Arquitectura elegida

```
Usuario crea ficha en el SaaS (título, copy, imagen, canal, fecha)
        ↓
Scheduler comprueba cada minuto fichas con fecha_publicacion = ahora
        ↓
Llama a la Graph API de Meta con el access_token del usuario
        ↓
Post publicado en Instagram/Facebook del usuario
```

Para LinkedIn el flujo es idéntico pero con la LinkedIn API (más fácil de aprobar, sin esperar a Meta).

---

## Stack técnico

| Componente | Tecnología | Coste |
|---|---|---|
| Frontend + Backend | Next.js 16 App Router | 0€ |
| Base de datos | Supabase (PostgreSQL) | 0€ (free tier) |
| Storage imágenes | Supabase Storage | 0€ (free tier) |
| Deploy | Vercel | 0€ (free tier) |
| Dominio | A elegir | ~10€/año |
| Meta App | Meta for Developers | 0€ (solo tiempo) |
| LinkedIn App | LinkedIn Developers | 0€ (solo tiempo) |
| **Total arranque** | | **~10€/año** |

---

## Fase 0 — Tramitar la Meta App (semanas 1-4, en paralelo con todo)

> ⚠️ Este es el único bloqueante real. No es código, es burocracia. Empieza cuanto antes para que el tiempo corra mientras se construye el producto.

### Pasos

1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Crear app tipo **"Business"**
3. Solicitar estos permisos:
   - `instagram_content_publish` — publicar en Instagram Business
   - `pages_manage_posts` — publicar en Facebook Pages
   - `pages_read_engagement` — leer métricas básicas
4. Añadir cuentas de prueba (hasta 5, sin aprobación) para poder grabar el vídeo de demo
5. Grabar vídeo de demo (~2-3 minutos con Loom o QuickTime):
   - Usuario inicia sesión en el SaaS
   - Crea un post con imagen, copy y fecha
   - Hace clic en "Publicar en Instagram"
   - El post aparece en la cuenta de prueba
6. Publicar política de privacidad (se puede generar en 10 minutos)
7. Rellenar formulario de revisión describiendo el caso de uso: *"Herramienta SaaS para que empresas y agencias gestionen y publiquen su calendario editorial en redes sociales"*
8. Esperar aprobación: **1-4 semanas**

### Si ya tenéis Meta App como agencia de publicidad

Entrar en [developers.facebook.com](https://developers.facebook.com) → vuestra app → **App Review → Permissions and Features** y comprobar si `instagram_content_publish` ya está aprobado o disponible para solicitar. Si la app ya está en modo Live y es de tipo Business, la aprobación puede ser más rápida.

---

## Fase 1 — MVP funcional sin autopublicación (semanas 1-2)

> Funciona desde el día 1, sin Meta App, sin que el usuario configure nada técnico.

### Qué se construye

- **Registro y login** de usuarios (Supabase Auth)
- **Workspaces** — cada empresa tiene el suyo, aislado de los demás
- **Tablero Kanban** por perfil social (reutilizar código de Ceosiana)
- **Vista calendario con mapa de calor** (reutilizar código de Ceosiana)
- **Upload de imágenes** a Supabase Storage (reutilizar código de Ceosiana)
- **Scheduler semi-automático**: cuando llega la hora de publicar, envía notificación al usuario (email) con el post listo para que lo publique manualmente con un clic

### Modelo "push" semi-automático

El SaaS programa todo. En el momento exacto de publicación:
1. Envía email/notificación al usuario con el copy e imagen adjunta
2. El usuario abre la notificación y publica manualmente

Es lo que hacía Buffer antes de tener API de Instagram. Permite validar el producto y conseguir primeros clientes pagando antes de tener la autopublicación real.

### Base de datos (tablas nuevas respecto a Ceosiana)

```sql
-- Workspaces (una empresa = un workspace)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- Miembros del workspace
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  id_workspace uuid references workspaces(id) on delete cascade,
  id_user uuid references auth.users(id) on delete cascade,
  rol text default 'member', -- owner, admin, member
  created_at timestamptz default now()
);

-- Perfiles sociales conectados
create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  id_workspace uuid references workspaces(id) on delete cascade,
  red_social text not null, -- instagram, facebook, linkedin, tiktok
  nombre_cuenta text not null,
  account_id text not null, -- ID en la plataforma
  access_token text, -- cifrado
  token_expira_at timestamptz,
  activo boolean default true,
  created_at timestamptz default now()
);
```

---

## Fase 2 — Autopublicación real (cuando Meta aprueba)

> Una vez aprobada la Meta App, esto es 1-2 sesiones de código.

### OAuth por usuario

Botón "Conectar Instagram/Facebook" en el panel del usuario:
1. Redirige a Meta OAuth con los permisos solicitados
2. Usuario acepta en la pantalla de Meta (30 segundos)
3. Se guarda el `access_token` en Supabase (cifrado con AES-256)
4. A partir de ahí, la publicación es completamente automática

### Scheduler real

- Proceso que corre cada minuto (Vercel Cron Jobs)
- Busca fichas con `fecha_publicacion <= ahora` y estado `programado`
- Llama a la Graph API de Meta con el token del usuario
- Actualiza estado: `publicado` o `error` con mensaje
- Reintento automático en caso de error temporal

### Flujo de publicación Instagram

```
1. POST /{ig-user-id}/media
   { image_url, caption }
   → Devuelve creation_id

2. POST /{ig-user-id}/media_publish
   { creation_id }
   → Post publicado
```

### Flujo de publicación Facebook Page

```
POST /{page-id}/feed
{ message, link (opcional) }
o
POST /{page-id}/photos
{ url, caption }
```

---

## Fase 3 — Producto completo

- **LinkedIn** — API independiente de Meta, se puede implementar en paralelo desde Fase 1
- **Analytics básicos** — alcance, likes, comentarios tirando de Graph API
- **Multi-usuario por workspace** — invitar al equipo
- **Generación de copy con Claude** — botón "Generar copy" en el modal de ficha
- **Plantillas de contenido** — reutilizar entre fichas
- **Portal de aprobación por cliente** — link privado para que el cliente apruebe fichas antes de publicar
- **TikTok** — solo vídeos, API similar a Meta

---

## Redes sociales: estado de integración

| Red | API oficial | Dificultad trámite | Tipo contenido |
|---|---|---|---|
| Instagram | Graph API (Meta) | Media — App Review 1-4 semanas | Foto, vídeo, Reels, Stories |
| Facebook | Graph API (Meta) | Media — misma app que Instagram | Foto, vídeo, texto, enlaces |
| LinkedIn | LinkedIn API | Baja — aprobación más rápida | Texto, foto, vídeo, artículos |
| TikTok | Content Posting API | Media — App Review similar a Meta | Solo vídeo |
| Blog/WordPress | WordPress REST API | Ninguna | Artículos |

---

## Modelo de negocio sugerido

| Plan | Precio | Límites |
|---|---|---|
| Free | 0€ | 1 workspace, 3 perfiles sociales, 10 posts/mes |
| Starter | 19€/mes | 1 workspace, 5 perfiles, posts ilimitados |
| Agency | 49€/mes | Workspaces ilimitados, perfiles ilimitados, analytics |

---

## Relación con Ceosiana

El módulo editorial de Ceosiana y este SaaS comparten:
- La misma Meta App aprobada (un solo trámite para los dos)
- El mismo código base de tablero Kanban y calendario
- Supabase **separado** — los datos del SaaS no se mezclan con los de Ceosiana

Para **Ceosiana** (clientes de agencia): se pueden usar los Page Access Tokens del Business Manager directamente, sin que el cliente haga OAuth.

Para el **SaaS externo**: cada usuario conecta su propia cuenta vía OAuth.

---

## Plan de acción

| Cuándo | Qué | Quién |
|---|---|---|
| Esta semana | Abrir Meta App y enviar solicitud de permisos | Juanjo |
| Esta semana | Decidir nombre y dominio del SaaS | Juanjo |
| Semana 1-2 | Construir MVP Fase 1 (tablero + calendario + notificación manual) | Claude |
| Semana 2-3 | Construir OAuth y scheduler para LinkedIn (sin esperar Meta) | Claude |
| Semanas 2-4 | Esperar aprobación Meta | Meta |
| Cuando Meta aprueba | Conectar autopublicación Instagram/Facebook | Claude |

---

## Notas importantes

- **n8n self-hosted no funciona para Instagram** — Meta bloquea OAuth en instancias self-hosted. Solo funciona con n8n Cloud (~20€/mes) o Meta App propia.
- **Make y Zapier sí funcionan** como puente si no quieres tramitar la Meta App, pero el usuario final tiene que configurarlo.
- **Nunca usar scraping** (Puppeteer, Selenium) — Meta detecta IPs de servidor y banea las cuentas de los clientes.
- Los **Page Access Tokens del Business Manager** de Siana permiten publicar en cuentas de clientes que ya gestionáis como agencia, sin OAuth del cliente.

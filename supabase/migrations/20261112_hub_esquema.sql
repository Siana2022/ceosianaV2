-- ============================================================
-- HUB por cliente — fase 0
-- 12/11/2026
--
-- Todo es aditivo: tablas nuevas y dos columnas nuevas con valor
-- por defecto. No se modifica ni se borra nada existente.
-- ============================================================

-- Helper de rol. security definer para no recursar sobre perfiles.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- 1. Cuenta de plataforma vinculada a un servicio del cliente
--    (Ceivan → servicio "Meta Ads · España" → act_123456)
-- ------------------------------------------------------------
create table if not exists public.cuenta_plataforma (
  id            uuid primary key default gen_random_uuid(),
  id_servicio   uuid not null references public.servicios(id) on delete cascade,
  plataforma    text not null check (plataforma in ('google_ads', 'meta_ads', 'ga4')),
  id_externo    text not null,                 -- customer id / act_... / property id
  nombre        text not null,
  moneda        text not null default 'EUR',
  zona_horaria  text not null default 'Europe/Madrid',
  activa        boolean not null default true,
  ultima_sync   timestamptz,
  created_at    timestamptz not null default now(),
  unique (plataforma, id_externo)
);
create index if not exists idx_cuenta_plataforma_servicio on public.cuenta_plataforma (id_servicio);

comment on table public.cuenta_plataforma is
  'Cuenta externa (Google Ads, Meta Ads, GA4) vinculada a un servicio. Una por cuenta real.';

-- ------------------------------------------------------------
-- 2. Campañas (espejo de la plataforma, se rellena por sync)
-- ------------------------------------------------------------
create table if not exists public.campanas (
  id            uuid primary key default gen_random_uuid(),
  id_cuenta     uuid not null references public.cuenta_plataforma(id) on delete cascade,
  id_externo    text not null,
  nombre        text not null,
  estado        text,                          -- activa | pausada | finalizada
  tipo          text,                          -- search | pmax | display | social...
  presupuesto   numeric(12, 2),
  fecha_inicio  date,
  fecha_fin     date,
  datos         jsonb not null default '{}'::jsonb,  -- campos propios de la plataforma
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id_cuenta, id_externo)
);
create index if not exists idx_campanas_cuenta on public.campanas (id_cuenta);
create index if not exists idx_campanas_estado on public.campanas (estado);

-- ------------------------------------------------------------
-- 3. Métricas diarias por campaña
--    Se guardan snapshots para poder ver tendencia sin golpear la API.
-- ------------------------------------------------------------
create table if not exists public.metricas_diarias (
  id                  bigserial primary key,
  id_campana          uuid not null references public.campanas(id) on delete cascade,
  fecha               date not null,
  impresiones         bigint  not null default 0,
  clics               bigint  not null default 0,
  coste               numeric(12, 2) not null default 0,
  conversiones        numeric(12, 2) not null default 0,
  valor_conversiones  numeric(12, 2) not null default 0,
  datos               jsonb not null default '{}'::jsonb,
  unique (id_campana, fecha)
);
create index if not exists idx_metricas_campana_fecha on public.metricas_diarias (id_campana, fecha desc);
create index if not exists idx_metricas_fecha on public.metricas_diarias (fecha desc);

-- ------------------------------------------------------------
-- 4. Acciones: el registro de trabajo del hub
--    "Pausé Display por bajo rendimiento · 20 min" → timeline + fichaje + conocimiento
-- ------------------------------------------------------------
create table if not exists public.acciones (
  id            uuid primary key default gen_random_uuid(),
  id_servicio   uuid not null references public.servicios(id) on delete cascade,
  id_cuenta     uuid references public.cuenta_plataforma(id) on delete set null,
  id_tarea      uuid references public.tareas(id) on delete set null,
  id_empleado   uuid not null references public.empleados(id) on delete restrict,
  id_time_log   uuid references public.time_logs(id) on delete set null,
  fecha         date not null default current_date,
  tipo          text not null default 'optimizacion'
                check (tipo in ('optimizacion', 'cambio', 'incidencia', 'entrega', 'nota')),
  titulo        text not null,
  detalle       text,
  minutos       integer,
  visibilidad   text not null default 'interna'
                check (visibilidad in ('interna', 'compartida')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_acciones_servicio on public.acciones (id_servicio, fecha desc);
create index if not exists idx_acciones_empleado on public.acciones (id_empleado, fecha desc);

comment on table public.acciones is
  'Registro de cambios y trabajo en un servicio. Puede generar fichaje y aparecer en el timeline.';

-- ------------------------------------------------------------
-- 5. Conocimiento por cliente (decisiones, briefs, aprendizajes)
-- ------------------------------------------------------------
create table if not exists public.notas_conocimiento (
  id            uuid primary key default gen_random_uuid(),
  id_cliente    uuid not null references public.clientes(id) on delete cascade,
  id_servicio   uuid references public.servicios(id) on delete set null,
  id_empleado   uuid references public.empleados(id) on delete set null,
  titulo        text not null,
  contenido     text,
  visibilidad   text not null default 'interna'
                check (visibilidad in ('interna', 'compartida')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_notas_cliente on public.notas_conocimiento (id_cliente, created_at desc);

-- ------------------------------------------------------------
-- 6. Contactos del cliente
-- ------------------------------------------------------------
create table if not exists public.contactos_cliente (
  id            uuid primary key default gen_random_uuid(),
  id_cliente    uuid not null references public.clientes(id) on delete cascade,
  nombre        text not null,
  rol           text,
  email         text,
  telefono      text,
  principal     boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_contactos_cliente on public.contactos_cliente (id_cliente);

-- ------------------------------------------------------------
-- 7. Dominios de correo del cliente (para vincular emails más adelante)
-- ------------------------------------------------------------
create table if not exists public.dominios_cliente (
  id            uuid primary key default gen_random_uuid(),
  id_cliente    uuid not null references public.clientes(id) on delete cascade,
  dominio       text not null,
  created_at    timestamptz not null default now(),
  unique (dominio)
);

-- ------------------------------------------------------------
-- 8. Columnas nuevas en tablas existentes (aditivas)
-- ------------------------------------------------------------
alter table public.servicios add column if not exists descripcion text;
alter table public.tareas    add column if not exists visibilidad text not null default 'interna'
  check (visibilidad in ('interna', 'compartida'));

-- ============================================================
-- RLS
-- ============================================================
alter table public.cuenta_plataforma  enable row level security;
alter table public.campanas           enable row level security;
alter table public.metricas_diarias   enable row level security;
alter table public.acciones           enable row level security;
alter table public.notas_conocimiento enable row level security;
alter table public.contactos_cliente  enable row level security;
alter table public.dominios_cliente   enable row level security;

-- Cuentas: todo el equipo las ve; solo admin las vincula o desvincula.
drop policy if exists "cuenta_plataforma_select" on public.cuenta_plataforma;
create policy "cuenta_plataforma_select" on public.cuenta_plataforma
  for select to authenticated using (true);
drop policy if exists "cuenta_plataforma_admin" on public.cuenta_plataforma;
create policy "cuenta_plataforma_admin" on public.cuenta_plataforma
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Campañas y métricas: lectura para el equipo; escritura solo service role (sync).
drop policy if exists "campanas_select" on public.campanas;
create policy "campanas_select" on public.campanas
  for select to authenticated using (true);
drop policy if exists "metricas_select" on public.metricas_diarias;
create policy "metricas_select" on public.metricas_diarias
  for select to authenticated using (true);

-- Acciones: registro de trabajo, cualquier empleado puede leer y crear.
drop policy if exists "acciones_select" on public.acciones;
create policy "acciones_select" on public.acciones
  for select to authenticated using (true);
drop policy if exists "acciones_insert" on public.acciones;
create policy "acciones_insert" on public.acciones
  for insert to authenticated with check (true);
drop policy if exists "acciones_update" on public.acciones;
create policy "acciones_update" on public.acciones
  for update to authenticated using (true) with check (true);

-- Notas de conocimiento: igual que las acciones.
drop policy if exists "notas_select" on public.notas_conocimiento;
create policy "notas_select" on public.notas_conocimiento
  for select to authenticated using (true);
drop policy if exists "notas_write" on public.notas_conocimiento;
create policy "notas_write" on public.notas_conocimiento
  for all to authenticated using (true) with check (true);

-- Contactos y dominios: lectura para el equipo, escritura admin.
drop policy if exists "contactos_select" on public.contactos_cliente;
create policy "contactos_select" on public.contactos_cliente
  for select to authenticated using (true);
drop policy if exists "contactos_admin" on public.contactos_cliente;
create policy "contactos_admin" on public.contactos_cliente
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "dominios_select" on public.dominios_cliente;
create policy "dominios_select" on public.dominios_cliente
  for select to authenticated using (true);
drop policy if exists "dominios_admin" on public.dominios_cliente;
create policy "dominios_admin" on public.dominios_cliente
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

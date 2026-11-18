-- Biblioteca del Creative Lab dentro de ceosiana.
-- Solo tablas nuevas (prefijo lab_). No se modifica nada existente.

-- 1. Bases de conocimiento por cliente y plataforma (con histórico de versiones)
create table if not exists public.lab_bases (
  id          uuid primary key default gen_random_uuid(),
  id_cliente  uuid not null references public.clientes(id) on delete cascade,
  plataforma  text not null check (plataforma in ('google_ads', 'meta_ads')),
  version     int  not null default 1,
  contenido   jsonb not null default '{}'::jsonb,
  autor       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_lab_bases_cliente on public.lab_bases (id_cliente, plataforma, version desc);

-- 2. Variaciones propuestas sobre creatividades ganadoras
create table if not exists public.lab_variaciones (
  id               uuid primary key default gen_random_uuid(),
  id_cliente       uuid not null references public.clientes(id) on delete cascade,
  plataforma       text not null check (plataforma in ('google_ads', 'meta_ads')),
  id_creatividad   text,
  nombre_origen    text,
  propuesta        text,
  resultado        text,
  estado           text not null default 'propuesta'
                   check (estado in ('propuesta', 'publicada', 'ganada', 'perdida')),
  datos            jsonb not null default '{}'::jsonb,
  autor            text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_lab_variaciones_cliente on public.lab_variaciones (id_cliente, plataforma, created_at desc);

-- 3. Análisis guardados (los últimos de cada proyecto y plataforma)
create table if not exists public.lab_analisis (
  id          uuid primary key default gen_random_uuid(),
  id_cliente  uuid not null references public.clientes(id) on delete cascade,
  plataforma  text not null check (plataforma in ('google_ads', 'meta_ads')),
  desde       date,
  hasta       date,
  datos       jsonb not null default '{}'::jsonb,
  autor       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_lab_analisis_cliente on public.lab_analisis (id_cliente, plataforma, created_at desc);

-- 4. Evaluaciones de piezas (antes de publicar)
create table if not exists public.lab_evaluaciones (
  id               uuid primary key default gen_random_uuid(),
  id_cliente       uuid not null references public.clientes(id) on delete cascade,
  plataforma       text not null check (plataforma in ('google_ads', 'meta_ads')),
  nombre_pieza     text,
  imagen_url       text,
  puntuacion       numeric,
  fortalezas       jsonb not null default '[]'::jsonb,
  riesgos          jsonb not null default '[]'::jsonb,
  notas            text,
  modelo           text,
  autor            text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_lab_evaluaciones_cliente on public.lab_evaluaciones (id_cliente, plataforma, created_at desc);

-- 5. Hipótesis a probar
create table if not exists public.lab_hipotesis (
  id          uuid primary key default gen_random_uuid(),
  id_cliente  uuid not null references public.clientes(id) on delete cascade,
  plataforma  text check (plataforma in ('google_ads', 'meta_ads')),
  texto       text not null,
  estado      text not null default 'abierta'
              check (estado in ('abierta', 'en_prueba', 'confirmada', 'descartada')),
  evidencia   jsonb not null default '{}'::jsonb,
  autor       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_lab_hipotesis_cliente on public.lab_hipotesis (id_cliente, created_at desc);

-- 6. Briefs guardados
create table if not exists public.lab_briefs (
  id          uuid primary key default gen_random_uuid(),
  id_cliente  uuid not null references public.clientes(id) on delete cascade,
  plataforma  text check (plataforma in ('google_ads', 'meta_ads')),
  titulo      text,
  contenido   jsonb not null default '{}'::jsonb,
  autor       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_lab_briefs_cliente on public.lab_briefs (id_cliente, created_at desc);

-- 7. Procedimientos del equipo (los "skills" compartidos)
create table if not exists public.lab_procedimientos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  contenido   text not null,
  version     int  not null default 1,
  ambito      text not null default 'global'
              check (ambito in ('global', 'google_ads', 'meta_ads', 'seo', 'analitica', 'redes')),
  autor       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS: lectura y escritura para el equipo autenticado.
alter table public.lab_bases          enable row level security;
alter table public.lab_variaciones    enable row level security;
alter table public.lab_analisis       enable row level security;
alter table public.lab_evaluaciones   enable row level security;
alter table public.lab_hipotesis      enable row level security;
alter table public.lab_briefs         enable row level security;
alter table public.lab_procedimientos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lab_bases' and policyname = 'lab_bases_team') then
    create policy "lab_bases_team" on public.lab_bases for all to authenticated using (true) with check (true);
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lab_variaciones' and policyname = 'lab_variaciones_team') then
    create policy "lab_variaciones_team" on public.lab_variaciones for all to authenticated using (true) with check (true);
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lab_analisis' and policyname = 'lab_analisis_team') then
    create policy "lab_analisis_team" on public.lab_analisis for all to authenticated using (true) with check (true);
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lab_evaluaciones' and policyname = 'lab_evaluaciones_team') then
    create policy "lab_evaluaciones_team" on public.lab_evaluaciones for all to authenticated using (true) with check (true);
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lab_hipotesis' and policyname = 'lab_hipotesis_team') then
    create policy "lab_hipotesis_team" on public.lab_hipotesis for all to authenticated using (true) with check (true);
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lab_briefs' and policyname = 'lab_briefs_team') then
    create policy "lab_briefs_team" on public.lab_briefs for all to authenticated using (true) with check (true);
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lab_procedimientos' and policyname = 'lab_procedimientos_team') then
    create policy "lab_procedimientos_team" on public.lab_procedimientos for all to authenticated using (true) with check (true);
  end if;
end $$;

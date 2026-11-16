-- Portal del cliente: enlace privado por token y aprobaciones.

alter table public.clientes add column if not exists token_portal text;
create unique index if not exists idx_clientes_token_portal on public.clientes (token_portal) where token_portal is not null;

create table if not exists public.aprobaciones (
  id          uuid primary key default gen_random_uuid(),
  id_cliente  uuid not null references public.clientes(id) on delete cascade,
  id_tarea    uuid references public.tareas(id) on delete cascade,
  estado      text not null default 'aprobada' check (estado in ('aprobada', 'comentada', 'rechazada')),
  comentario  text,
  autor       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_aprobaciones_cliente on public.aprobaciones (id_cliente, created_at desc);

alter table public.aprobaciones enable row level security;
drop policy if exists "aprobaciones_select" on public.aprobaciones;
create policy "aprobaciones_select" on public.aprobaciones
  for select to authenticated using (true);
drop policy if exists "aprobaciones_insert" on public.aprobaciones;
create policy "aprobaciones_insert" on public.aprobaciones
  for insert to authenticated with check (true);

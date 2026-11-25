-- Informes configurables por cliente (estilo Looker, dentro de ceosiana).
-- Cada informe guarda sus bloques en un JSON: no hacen falta tablas por widget.

create table if not exists public.informes (
  id          uuid primary key default gen_random_uuid(),
  id_cliente  uuid not null references public.clientes(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  tipo        text not null default 'mensual' check (tipo in ('mensual', 'semanal', 'anual', 'a_medida')),
  config      jsonb not null default '{"bloques":[]}'::jsonb,
  publico     boolean not null default false,   -- visible en el portal del cliente
  orden       int not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_informes_cliente on public.informes (id_cliente, orden);

alter table public.informes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'informes' and policyname = 'informes_team'
  ) then
    create policy "informes_team" on public.informes
      for all to authenticated using (true) with check (true);
  end if;
end $$;

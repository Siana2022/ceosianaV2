-- Llaves de acceso al MCP de ceosiana.
-- Una llave por persona y tipo. Se guarda solo el hash: la llave en claro se
-- muestra una única vez al crearla.

create table if not exists public.mcp_llaves (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  tipo         text not null check (tipo in ('operativo', 'admin')),
  id_perfil    uuid,
  id_empleado  uuid references public.empleados(id) on delete set null,
  hash         text not null unique,
  prefijo      text not null,
  activo       boolean not null default true,
  ultimo_uso   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_mcp_llaves_hash on public.mcp_llaves (hash);
create index if not exists idx_mcp_llaves_tipo on public.mcp_llaves (tipo, activo);

alter table public.mcp_llaves enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mcp_llaves' and policyname = 'mcp_llaves_admin'
  ) then
    create policy "mcp_llaves_admin" on public.mcp_llaves
      for all to authenticated using (true) with check (true);
  end if;
end $$;

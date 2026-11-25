-- Conexión única con Google Analytics (cuenta de Juanjo/Anaís).
-- El token es de la agencia: sirve para todas las propiedades a las que tengan acceso.

create table if not exists public.ga4_conexion (
  id            uuid primary key default gen_random_uuid(),
  email         text,
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  scope         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.ga4_conexion enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ga4_conexion' and policyname = 'ga4_conexion_admin'
  ) then
    create policy "ga4_conexion_admin" on public.ga4_conexion
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Propiedad de GA4 vinculada a cada cliente
alter table public.clientes add column if not exists ga4_propiedad text;

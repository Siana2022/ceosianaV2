-- Artefactos integrados en ceosiana (botonera de herramientas por cliente).
-- Añadir uno nuevo = una fila más y su HTML en public/.

create table if not exists public.artefactos (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nombre      text not null,
  descripcion text,
  ruta        text not null,
  orden       int  not null default 100,
  activo      boolean not null default true,
  roles       text[] not null default '{admin}',
  created_at  timestamptz not null default now()
);

insert into public.artefactos (slug, nombre, descripcion, ruta, orden, roles)
values (
  'creative-lab',
  'Creative Lab',
  'Analizar creatividades, evaluarlas y guardar lo aprendido',
  '/creative-lab/index.html',
  10,
  '{admin}'
)
on conflict (slug) do nothing;

alter table public.artefactos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'artefactos' and policyname = 'artefactos_select'
  ) then
    create policy "artefactos_select" on public.artefactos
      for select to authenticated using (true);
  end if;
end $$;

-- Almacén documental del Creative Lab: una fila por documento.
-- Sustituye al almacén de Claude cuando el artefacto corre dentro de ceosiana.

create table if not exists public.lab_docs (
  id          uuid primary key default gen_random_uuid(),
  coleccion   text not null,
  doc_id      text not null,
  id_cliente  uuid references public.clientes(id) on delete cascade,
  plataforma  text,
  datos       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (coleccion, doc_id)
);

create index if not exists idx_lab_docs_coleccion on public.lab_docs (coleccion, doc_id);
create index if not exists idx_lab_docs_cliente on public.lab_docs (id_cliente, coleccion);
create index if not exists idx_lab_docs_datos on public.lab_docs using gin (datos);

alter table public.lab_docs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lab_docs' and policyname='lab_docs_team') then
    create policy "lab_docs_team" on public.lab_docs for all to authenticated using (true) with check (true);
  end if;
end $$;

create table if not exists configuracion (
  clave text primary key,
  valor text not null,
  updated_at timestamptz default now()
);

alter table configuracion enable row level security;

-- Only authenticated users can read; only admins can write
create policy "read configuracion" on configuracion for select to authenticated using (true);
create policy "write configuracion" on configuracion for all using (
  exists (select 1 from empleados where id = auth.uid() and rol = 'admin')
);

insert into configuracion (clave, valor) values ('coste_hora_umbral', '300') on conflict do nothing;

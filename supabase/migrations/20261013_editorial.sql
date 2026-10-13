-- Editorial module: Trello-style content calendar per client

create table if not exists editorial_boards (
  id uuid primary key default gen_random_uuid(),
  id_cliente uuid references clientes(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(id_cliente)
);

create table if not exists editorial_columnas (
  id uuid primary key default gen_random_uuid(),
  id_board uuid references editorial_boards(id) on delete cascade not null,
  nombre text not null,
  orden int not null default 0,
  color text not null default '#6366f1',
  created_at timestamptz default now()
);

create table if not exists editorial_fichas (
  id uuid primary key default gen_random_uuid(),
  id_board uuid references editorial_boards(id) on delete cascade not null,
  id_columna uuid references editorial_columnas(id) on delete cascade not null,
  titulo text,
  copy text,
  canal text not null default 'instagram',
  fecha_publicacion date,
  imagen_url text,
  orden int not null default 0,
  created_at timestamptz default now()
);

-- RLS: all authenticated employees can read/write (public for the team)
alter table editorial_boards enable row level security;
alter table editorial_columnas enable row level security;
alter table editorial_fichas enable row level security;

create policy "editorial_boards_all" on editorial_boards for all to authenticated using (true) with check (true);
create policy "editorial_columnas_all" on editorial_columnas for all to authenticated using (true) with check (true);
create policy "editorial_fichas_all" on editorial_fichas for all to authenticated using (true) with check (true);

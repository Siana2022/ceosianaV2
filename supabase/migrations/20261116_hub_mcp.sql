-- Conexiones OAuth con servidores MCP externos (Google Ads de Siana).
-- Solo accesible con service role: no se define ninguna política RLS.

create table if not exists public.mcp_conexiones (
  id            uuid primary key default gen_random_uuid(),
  proveedor     text not null unique,        -- google_ads | meta_ads
  client_id     text,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  scopes        text,
  resource      text,
  token_endpoint       text,
  authorization_endpoint text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.mcp_conexiones enable row level security;
-- Sin políticas a propósito: solo el service role puede leer y escribir.

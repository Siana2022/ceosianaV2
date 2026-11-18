-- Tercer tipo de llave: externos, con acceso de solo lectura al hub de su cliente.

alter table public.mcp_llaves add column if not exists id_cliente uuid references public.clientes(id) on delete cascade;

alter table public.mcp_llaves drop constraint if exists mcp_llaves_tipo_check;
alter table public.mcp_llaves add constraint mcp_llaves_tipo_check
  check (tipo in ('operativo', 'admin', 'externo'));

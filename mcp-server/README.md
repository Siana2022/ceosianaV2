# ceosiana-mcp

Servidor MCP propio de ceosiana. Expone clientes, tareas y registro de trabajo
para que **Claude** y el **hub** consuman la misma fuente de datos.

## Herramientas

| Herramienta | Qué hace |
|---|---|
| `listar_clientes` | Clientes activos con id y nombre |
| `resumen_cliente` | Servicios, tareas abiertas, horas registradas y cuentas |
| `tareas_de_cliente` | Tareas ordenadas por urgencia |
| `registrar_trabajo` | Crea la acción **y** el fichaje en una sola llamada |

## Variables de entorno

```bash
SUPABASE_URL=https://vbrkedtaesuoabxxyhan.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # solo en servidor, nunca en el navegador
```

## Uso local

```bash
cd mcp-server
npm install
npm run dev        # arranca por stdio
```

## Conectarlo a Claude Desktop

En `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ceosiana": {
      "command": "node",
      "args": ["/ruta/a/ceosianaV2/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://vbrkedtaesuoabxxyhan.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "..."
      }
    }
  }
}
```

Compilar antes con `npm run build`.

## Siguientes pasos

1. **Transporte HTTP** para poder conectarlo desde un VPS y desde el hub.
2. **Autenticación por usuario**: hoy usa service role y no distingue quién llama.
3. **Google Ads**: añadir herramientas que consulten el MCP oficial de Google Ads
   con el developer token de la agencia.
4. **Meta Ads**: igual, cuando su app esté aprobada.

## Seguridad

Usa `SERVICE_ROLE_KEY`, así que **salta RLS**: cualquiera que tenga acceso a este
proceso puede leer toda la base de datos. No exponerlo a internet sin autenticación.

# Conexión de Meta Ads (token de usuario del sistema)

Estado: **token creado y funcionando a medias**. Ve las cuentas, pero no puede
leer sus métricas.

## Síntoma

`GET /api/hub/meta/estado?cuenta=act_XXXX` devuelve:

```
conectado: true, cuentas: 31
pruebaCuenta: { ok: false,
  error: "(#200) Ad account owner has NOT grant ads_management or ads_read
          permission, ..." }
```

Traducción: el usuario del sistema ve las cuentas del negocio, pero **no está
asignado a las cuentas publicitarias** con permiso de lectura.

## Solución (una vez por cuenta)

### 1. Asignar activos al usuario del sistema

1. `business.facebook.com` → **Configuración del negocio**.
2. **Usuarios** → **Usuarios del sistema** → abrir el usuario usado.
3. **Asignar activos** → **Añadir** → **Cuentas publicitarias**.
4. Seleccionar las cuentas necesarias.
5. Permiso: **Ver rendimiento de campañas** (o *Administrar campañas*).
6. **Guardar cambios**.

### 2. Generar el token con los permisos correctos

En el mismo usuario del sistema → **Tokens** → **Generar token nuevo**:

- `ads_read` ← el que faltaba
- `business_management`

### 3. Actualizar la variable en Vercel

`META_SYSTEM_USER_TOKEN` → nuevo valor → **Redeploy**.

### 4. Comprobar

```
/api/hub/meta/estado?cuenta=act_XXXX
→ pruebaCuenta: { ok: true, anuncios: N }
```

## Cuentas de otros Business Manager

Si una cuenta pertenece a otro negocio (cliente que no comparte), hay que:

- Pedir al cliente que asigne el usuario del sistema a su cuenta, o
- Añadir esa cuenta al Business propio.

Mientras no se haga, esa cuenta seguirá devolviendo `(#200)`.

## Dónde se usa el token

| Sitio | Uso |
|---|---|
| `/api/hub/cuentas/disponibles?plataforma=meta_ads` | Lista de cuentas para vincular a un servicio |
| `/api/informes/datos?fuente=meta_ads` | Métricas del informe (inversión, compras, CPA, ROAS…) |
| `/api/hub/mcp` | Puente del Creative Lab |

## Diagnóstico

```
/api/hub/meta/estado                 → cuentas visibles
/api/hub/meta/estado?cuenta=act_XXX  → prueba real contra una cuenta
```

Solo responde a administradores.

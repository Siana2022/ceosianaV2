# Volver al despliegue anterior

**Anotado el 25/11/2026, al lanzar la versión nueva a producción.**

## Cómo revertir en 20 segundos

Vercel → **Deployments** → filtra **Production** → busca el despliegue de
**`159829f`** → **⋯** → **Promote to Production**.

## Referencias

| | |
|---|---|
| Commit en producción al lanzar | `9aa6d7f` |
| **Commit anterior (al que se vuelve)** | **`159829f`** |
| Fecha del lanzamiento | 25/11/2026 |
| Tipo de publicación | fast-forward de `feat/hub` a `main` (sin merge commit) |

## Qué implica volver atrás

- Solo cambia **qué despliegue sirve** Vercel. No toca git ni la base de datos.
- **No hay migraciones que deshacer**: todo lo añadido a la base de datos es
  aditivo (columnas nuevas con valor por defecto y tablas nuevas). El código
  antiguo funciona igual con ellas.
- Los datos no se ven afectados.

## Si hay que volver atrás en git también

```bash
git push origin 159829f:main
```

Eso devuelve `main` al commit anterior y Vercel redespliega esa versión.

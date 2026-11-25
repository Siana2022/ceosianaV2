# Eficiencia con IA y datos dentro de ceosiana

Fecha: 25/11/2026. Propuesta de sistemas, no de pantallas sueltas.

Punto de partida: ya existe `cuenta_plataforma` (cliente → cuenta real),
`campanas` y `metricas_diarias` (vacías), el MCP de Google Ads funcionando,
el puente de Meta preparado y el portal del cliente con enlace privado.

---

## 1. Una sola capa de datos por cliente

Hoy cada plataforma se consulta en el momento, pantalla a pantalla. Eso no
escala y hace que cada informe dependa de que la API responda.

**Propuesta:** un **sync nocturno** que guarde en `metricas_diarias` los datos
de ayer de cada cuenta vinculada:

- Google Ads (ya hay puente)
- Meta Ads (puente listo, falta token)
- GA4 (sesiones, conversiones)
- Search Console (clics, impresiones, posición)
- WordPress vía Novamira (contenido publicado, salud del sitio)

Ventajas inmediatas:

- Los informes se pintan **en milisegundos**, sin golpear APIs.
- Se puede comparar mes contra mes y año contra año.
- Si una API cae, el informe del lunes sigue existiendo.
- El MCP responde con datos ya agregados (más rápido y más barato).

**Esfuerzo:** medio. **Impacto:** alto. Es la base de todo lo demás.

---

## 2. Looker Studio dentro de ceosiana

Lo que pides: informes por proyecto, dentro de la app.

**Cómo lo plantearía:**

```
/clientes/<cliente>/informes
  ├── Informe mensual (plantilla)
  ├── Informe semanal (plantilla)
  └── Informe a medida
```

Cada informe es una lista de **bloques** guardados en base de datos:

| Bloque | Qué enseña |
|---|---|
| KPI | Un número con su variación (inversión, CPA, ROAS, sesiones, leads) |
| Serie | Evolución en el tiempo (barras o línea) |
| Tabla | Campañas, páginas o piezas con métricas |
| Comparativa | Periodo actual contra el anterior |
| Texto | Conclusión escrita por el equipo o por la IA |

Ventajas frente a Looker:

- **Ya tiene los datos** de todas las plataformas en un solo sitio.
- Se comparte con el cliente **por el portal**, sin darle acceso a Looker.
- Las plantillas se reutilizan: “informe mensual de SEO” se configura una vez.
- Se puede generar el PDF con un botón.

**Esfuerzo:** alto (2-3 semanas). **Impacto:** muy alto: sustituye la
herramienta externa y el trabajo manual de montar informes.

---

## 3. IA que trabaja mientras nadie mira

Cuatro automatizaciones que ahorran horas reales:

1. **Resumen semanal por cliente.** Cada lunes, un párrafo por cliente con lo
   que subió, lo que bajó y lo que requiere atención. Se envía a Slack y queda
   en el hub. Modelo: el barato (DeepSeek) sirve; es texto sobre datos.
2. **Detección de anomalías.** Si el CPA sube un 30 %, el gasto se queda sin
   conversiones o las impresiones caen en picado, aviso al especialista. No
   espera a que alguien mire la cuenta.
3. **Borradores de brief.** A partir del rendimiento de las creatividades, la IA
   propone el brief del siguiente mes. El equipo lo revisa y lo guarda; no
   empieza de cero.
4. **Actas de reunión.** Pegas las notas (o la transcripción) y ceosiana saca
   tareas con responsable y fecha, listas para revisar.

**Esfuerzo:** bajo-medio cada una. **Impacto:** alto en tiempo del equipo.

---

## 4. Novamira: las webs dentro de ceosiana

Tenéis las webs gestionadas con Novamira. Eso permite convertirlas en datos:

- **Salud del sitio**: plugins desactualizados, versión de PHP, peso, errores.
- **Inventario de contenido**: páginas y posts con fecha, autor y estado.
- **Alertas**: web caída, plugin con vulnerabilidad, certificado a punto de
  caducar.
- **SEO técnico**: enlaces roos, títulos duplicados, páginas huérfanas.

Y cruzarlo con Search Console: *“esta página baja de posición y no se ha tocado
en 6 meses”* es la clase de aviso que ahorra una auditoría.

**Esfuerzo:** medio. **Impacto:** alto si lleváis muchas webs.

---

## 5. Eficiencia operativa (procesos)

- **Crear procesos recurrentes solos** el día 1 de cada mes (artículos,
  newsletter). Hoy hay que pulsar “Repetir”.
- **Checklist automática por tipo de servicio**: al abrir una tarea de SEO, que
  ya traiga sus pasos.
- **Informe mensual con un botón**: junta los bloques, genera el PDF y lo deja
  en el portal del cliente.
- **Cierre de mes guiado**: facturación, sueldos y gastos, con aviso de lo que
  falta.

---

## 6. Claude como puerta de entrada

El MCP ya funciona. Las mejoras que más rendimiento darán:

- **Herramientas de escritura**: crear tarea, actualizar estado, fichar y
  guardar evaluación desde el chat (fichar y estado ya están).
- **Consultas compuestas**: *“compárame el CPA de Ceivan en Google y Meta este
  mes”* en una sola pregunta.
- **Plantillas de pregunta** en el hub: botones que lanzan consultas concretas
  al Claude de cada persona.

---

## Orden propuesto

| Fase | Qué | Por qué primero |
|---|---|---|
| 1 | Sync nocturno a `metricas_diarias` | Es la base de informes, IA y MCP rápido |
| 2 | Informes por cliente (bloques + plantillas) | Sustituye Looker y el trabajo manual |
| 3 | Resumen semanal y detección de anomalías | Ahorro inmediato de tiempo |
| 4 | Novamira: salud de webs y alertas | Evita sustos y auditorías reactivas |
| 5 | Actas y briefs con IA | Quita trabajo repetitivo al equipo |
| 6 | PDF al portal con un botón | Cierra el círculo con el cliente |

## Lo que necesito para empezar

- **Meta**: el token del usuario del sistema (sigue pendiente).
- **GA4 y Search Console**: acceso de lectura por cuenta (OAuth de Google).
- **Novamira**: las credenciales de las webs que queráis incluir primero.
- **Decisión**: ¿el resumen semanal lo genera DeepSeek (barato) o Claude?

# Modelo de informe: Verde Esmeralda (extraído del PDF)

Informe mensual real de Siana Digital. Sirve como plantilla de lo que debe poder
montar el Looker interno de ceosiana.

Todas las métricas llevan **variación** frente al periodo anterior (mes previo o
mismo mes del año anterior).

---

## Bloque 1 · Tienda online (datos generales)

Fuente: **Shopify + GA4** (embudo de compra).

### Embudo (de arriba abajo)

| Nivel | Métrica | Ejemplo |
|---|---|---|
| Sesiones | Sesiones totales | 18.817 |
| Usuarios | Total de usuarios | 14.679 |
| Sesiones por usuario activo | Ratio | 1,31 |
| Interés | Usuarios que ven producto | 6.224 |
| Interés | Productos vistos | 13.350 |
| Intención | Usuarios que añaden al carrito | 2.269 |
| Intención | Añadidos al carrito | 6.468 |
| Compra | Compras | 809 |
| Compra | Total de compradores | 761 |
| Compra | Artículos comprados | 2.087 |
| Ingreso | Total de ingresos | 82.280,29 € |
| Ticket | AOV | 101,71 € |

### Tasa de conversión

Cambia según el punto del embudo: **63,6 % → 36,46 % → 35,65 % → 5,51 %**.
Cada una es la conversión al siguiente paso, no una sola CR global.

### Laterales

| Métrica | Ejemplo |
|---|---|
| Conversación Chatbot | 67 (34,0 %) |
| Lead Regalos Empresa | 24 (1.100 %) |
| Inversión publicitaria | 11.597,30 € (78,6 %) |
| ROAS | 7,11 |

### Fila de realidad (dato frente a plataforma)

| | Valor |
|---|---|
| AOV Pedidos Real | 65 |
| AOV Ingresos Real | 422 → 40.876,35 € |
| ROAS Real | 6,29 |

Es el **contraste** entre lo que dicen las plataformas y lo que confirma la
tienda. Es la parte más valiosa del informe y la que hoy nadie tiene en ceosiana.

---

## Bloque 2 · Google Ads

Dos filas de KPIs y un gráfico de barras + línea.

**Fila 1:** Importe gastado · Ingresos* · Conversiones* · CPA · ROAS*
**Fila 2:** AOV · Impresiones · Clics · CPC medio · CTR

**Gráfico:** barras de Valor de conversión y de Inversión por mes, con la línea
de ROAS encima. Dos años de histórico.

---

## Bloque 3 · Meta Ads

**Fila 1:** Importe gastado · Ingresos · Compras · Coste por compra · ROAS
**Fila 2:** AOV · Impresiones · Clics · CPC · CTR

**Gráfico:** igual que Google Ads (valor de conversión y ROAS por mes).

---

## Bloque 4 · Artículos top 10

| Columna | Ejemplo |
|---|---|
| Nombre del artículo | Green Emerald Picual 500ML |
| Artículos vistos | 2.969 |
| Artículos comprados | 431 |
| Ingresos del artículo | 15.300,5 € |

Ordenable por ingresos.

---

## Qué hace falta para que ceosiana monte esto

| Dato | Fuente | Estado |
|---|---|---|
| Inversión, conversiones, CPA, ROAS, impresiones, clics, CPC, CTR de Google | Google Ads | **Ya hay puente funcionando** |
| Lo mismo de Meta | Meta Ads | Puente hecho, **falta token** |
| Sesiones, usuarios, embudo de compra, AOV, CR | **GA4** (o Shopify) | **Falta conectar** |
| Ingresos reales, compras, artículos | **Shopify** | **Falta conectar** |
| Chatbot y leads | Herramienta de chatbot / formulario | **Falta decidir de dónde se lee** |

### Conclusión

Con lo que hay hoy, ceosiana puede montar **los bloques 2 (Google) y 3 (Meta)**.
Los bloques 1 y 4 dependen de **GA4 y Shopify**, que aún no están conectados.

### Orden propuesto

1. **GA4** (sesiones, usuarios, embudo, AOV, CR) — es el 70 % del informe.
2. **Shopify** (ingresos reales y artículos) — permite la fila de “Real” y el top 10.
3. **Meta** — en cuanto llegue el token.
4. **Variaciones automáticas**: cada KPI con su % frente al periodo anterior.

### Bloques nuevos que hay que añadir al editor

- **Embudo**: varios KPIs encadenados con su tasa paso a paso.
- **Fila de KPIs**: cinco o más tarjetas en una línea, con variación.
- **Barras + línea**: dos series de barras y una línea en el mismo gráfico.
- **Top N**: tabla ordenable con límite.

Los bloques actuales (KPI, serie, tabla, campañas) sirven para el resto, pero
estos cuatro son los que hacen que el informe se parezca al de verdad.

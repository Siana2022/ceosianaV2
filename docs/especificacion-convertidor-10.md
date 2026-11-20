# Convertidor real del 10 % (partida Project)

Estado: **pendiente de implementar**. Documentado el 20/11/2026.

## Qué es

Hoy el servicio **Project** de un cliente no tiene fee mensual asignado, así que
aparece con coste pero sin ingreso y su rentabilidad no significa nada.

La idea es que Project **sí tenga un ingreso**, pero no inventado: se le
**transfiere** una parte del fee de los demás servicios del cliente.

## Regla

0. **Solo se aplica si el cliente tiene el servicio Project.** Si no lo tiene, no
   hay convertidor: su rentabilidad es la de siempre. Es una decisión del
   cliente, no un cálculo universal.
1. Se toma el **10 % del fee mensual total del cliente**.
2. Ese 10 % se asigna como ingreso del servicio **Project**.
3. El 10 % se reparte **a partes iguales entre los servicios que no son Project**.
   - Con 5 servicios en total (4 no Project): cada uno cede **2,5 %**.
   - Con 3 servicios en total (2 no Project): cada uno cede **5 %**.
4. El fee de cada servicio se reduce en esa parte, y el de Project se incrementa
   en la suma de todas las cesiones (el 10 % total).

Ejemplo con 5 servicios y 10.000 € de fee mensual:

| Servicio | Fee actual | Cesión | Fee con Project |
|---|---|---|---|
| Google Ads | 3.000 € | −2,5 % | 2.925 € |
| Meta Ads | 3.000 € | −2,5 % | 2.925 € |
| SEO | 2.000 € | −2,5 % | 1.950 € |
| Analítica | 2.000 € | −2,5 % | 1.950 € |
| **Project** | 0 € | +10 % del total | **1.000 €** |

## Consecuencia: dos rentabilidades

- **Real por servicio**: la de hoy, con el fee original de cada servicio.
- **Con Project**: con el fee ajustado, que reparte el coste de la coordinación
  entre todos los servicios y da una foto más honesta del margen.

Las dos deben poder verse, no sustituirse.

## Decisiones tomadas

- El reparto es **equitativo** entre los servicios no Project.
- Project **nunca** tiene fee propio: su ingreso sale siempre del convertidor.
- **El convertidor solo existe donde hay servicio Project.** Sin Project, no hay
  reparto ni segunda rentabilidad.

## Decisiones cerradas (20/11/2026)

1. **Qué servicios cuentan**: solo los que tienen **fee mayor que 0** ese mes.
   Los de fee 0 no diluyen el reparto.
2. **Cómo se identifica Project**: todo cliente que tenga el **servicio Project**
   (por el tipo del catálogo, con el nombre como respaldo).
3. **Redondeo**: cada cesión se redondea a céntimos y **el resto se le da a
   Project**, para que la suma cuadre exacta.
4. **Alcance**: afecta **solo a la rentabilidad interna**. El cliente sigue
   recibiendo la factura de los demás servicios, sin línea de Project. Por eso
   hay **dos rentabilidades**: con Project y sin Project.
5. **Histórico**: empieza a contar en **diciembre de 2026**. Los meses anteriores
   no se recalculan.

## REUNIONES: caso aparte

El servicio REUNIONES **no entra en la rentabilidad**: no tiene fee y no se
imputa a ningún lado. Solo sirve para **contabilizar el tiempo dedicado a
reuniones** y ver dónde se van las horas.

- Se muestra en la interna como servicio con horas.
- No suma coste al cliente ni entra en el cálculo de márgenes.
- Queda fuera también del reparto del convertidor.

## Dónde encaja

- Datos: `servicios` (fee mensual por servicio) y `time_logs` (horas y coste).
- Vistas afectadas: ficha del cliente, panel de todos los clientes, interna de
  cada servicio y el bloque de rentabilidad por servicio.
- No requiere tabla nueva si el cálculo es al vuelo; sí una marca por cliente
  para activar o desactivar el convertidor.

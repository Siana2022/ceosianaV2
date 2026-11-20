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

## Preguntas abiertas antes de implementar

1. **Cuántos servicios cuentan**: ¿solo los activos del cliente, o también los
   que no tienen fee ese mes?
2. **Cómo se identifica Project**: ¿por el tipo de servicio del catálogo
   (`Project`) o por el nombre?
3. ~~Qué pasa si el cliente no tiene servicio Project~~ → **decidido**: si no
   tiene Project, no se aplica el convertidor. Nada de crearlo solo ni avisar.
4. **Redondeo**: ¿a céntimos por servicio y el resto al Project, para que la suma
   cuadre exacta?
5. **Ámbito**: ¿solo afecta al cálculo de rentabilidad, o también a lo que se
   factura al cliente? (Lo lógico: solo rentabilidad.)
6. **Histórico**: ¿se recalcula para meses pasados o empieza a contar desde su
   activación?

## Dónde encaja

- Datos: `servicios` (fee mensual por servicio) y `time_logs` (horas y coste).
- Vistas afectadas: ficha del cliente, panel de todos los clientes, interna de
  cada servicio y el bloque de rentabilidad por servicio.
- No requiere tabla nueva si el cálculo es al vuelo; sí una marca por cliente
  para activar o desactivar el convertidor.

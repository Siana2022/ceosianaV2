# Puntos abiertos del listado J&A — para reunión

Fecha: 24/11/2026. Estado verificado contra el código y la base de datos.

Para cada punto: qué piden, qué hay hoy, qué hay que decidir y qué recomiendo.

---

## (resuelto) Centrar las columnas de “Tareas activas”

**Qué pedían.** “Coger las columnas y centrarlas más”.

**Qué hay hoy.** Se sustituyó la fila flexible por una **rejilla de anchos
fijos** (título, cliente 10 rem, responsables 10, departamento 7, fecha 9,
cronómetro 7, estado 8). Las columnas ya no bailan entre filas y la fecha no se
parte en dos líneas.

**Qué queda.** Solo una preferencia estética: hoy cliente y departamento van a la
izquierda y la fecha al centro. Centrar todo es un cambio de dos palabras.

**Recomendación.** Dejarlo como está: el título a la izquierda se lee mejor.

## 1. Recuadro de % de rentabilidad en el panel de todos los clientes

**Qué piden.** El recuadro con el % de rentabilidad que ya existe en la ficha,
también en el listado general de clientes.

**Qué hay hoy.** El porcentaje aparece **dentro de la columna Margen**
(`3.228,88 € (35,9 %)`), en verde o rojo según el 50 %. No hay recuadro propio.

**Qué hay que decidir.**
- **A)** Dejarlo como está: el dato ya se ve.
- **B)** Añadir una columna “% Rentab.” independiente y ordenable.
- **C)** Un recuadro arriba con el % medio de la cartera.

**Recomendación.** **B**: en la reunión se compara mejor cliente por cliente.

**Esfuerzo.** Bajo.

---

## 2. Quitar responsables y eliminar el bloque “Proyectos y servicios”

**Qué piden.** “Quitar responsables, ya no existen. (Bloque Proyectos y servicios
eliminar)”.

**Qué hay hoy.** Ese bloque **es la tabla de servicios del cliente**, y de ella
cuelga todo el cálculo económico:

- la facturación por servicio (`ingresos.id_servicio`),
- el coste de personal imputado (`time_logs.id_servicio`),
- la rentabilidad por servicio,
- el convertidor del 10 % hacia Project,
- el servicio REUNIONES que acabamos de crear.

**Qué hay que decidir.** Es la decisión más importante de la lista.
- **A)** Quitar solo **los responsables** (el botón 👥 y la columna), y dejar la
  tabla de servicios.
- **B)** Quitar la tabla entera y **mover la facturación a nivel de cliente**:
  se pierde la rentabilidad por servicio.
- **C)** Quitar la tabla de la ficha y llevarla a una pantalla propia
  (“Servicios del cliente”), para que la ficha quede limpia pero el dato siga
  existiendo.

**Recomendación.** **A** si el problema es el ruido de los responsables; **C** si
el problema es que la ficha está cargada. **B no**: rompe la rentabilidad por
servicio, que es lo que usáis para decidir.

**Esfuerzo.** A: bajo. C: medio. B: alto y destructivo.

---

## 3. No coge fichajes de tiempo en Meta Ads (Verde Esmeralda, Prolaboral)

**Qué piden.** Hay tiempo dedicado a Meta Ads que no aparece en el servicio.

**Qué hay hoy.** El fichaje se imputa al servicio **solo si el fichaje lleva
`id_servicio`**. Si se fichó sin servicio (o con un departamento que corresponde
a varios servicios), el tiempo cae en “Sin asignar” y no entra en la rentabilidad
del servicio.

Además, ahora los fichajes **siguen al servicio** cuando se corrige, así que
buena parte se puede arreglar reasignando.

**Qué hay que decidir.**
- ¿Se corrige **caso a caso** (abrir la tarea o el servicio y asignarlo)?
- ¿O se hace **una limpieza masiva** de los fichajes “Sin asignar” imputándolos
  al servicio que corresponda por departamento?

**Recomendación.** Primero mirar cuántos son y de qué meses; si son pocos, caso a
caso. Si son muchos, limpieza con regla: “si el departamento del fichaje tiene un
único servicio del cliente, asígnalo”.

**Esfuerzo.** Bajo (consulta + update).

---

## 4. Agrupar Meta Ads en Verde Esmeralda

**Qué piden.** En “rentabilidad por servicio”, Verde Esmeralda tiene Meta España,
Meta USA, Meta Italia… y quieren **una sola línea de Meta Ads**. O, si no, que se
vea el desglose por mercado dentro.

**Qué hay hoy.** Cada servicio es una línea. Verde Esmeralda tiene 3 servicios de
Meta y salen separados.

**Qué hay que decidir.**
- **A)** Agrupar por **tipo de servicio** (Meta Ads, Web, SEO…) en esa vista.
- **B)** Una línea por servicio, con **desplegable** que muestre el desglose por
  mercado.
- **C)** Solo para Verde Esmeralda, unir sus tres Meta en una.

**Recomendación.** **B**: sirve para todos los clientes y no rompe el detalle. La
A es más limpia pero se pierde el mercado; la C es un parche para un cliente.

**Esfuerzo.** Medio (agrupación + desplegable).

---

## 5. El caso del 3h45 al 100 % de rentabilidad

**Qué piden.** En SEO, con 3 h 45 fichadas, la ficha dice **100 % de
rentabilidad**, y eso no puede ser.

**Qué hay hoy.** **No reproducido.** El % se calcula como
`(facturado − coste) / facturado`. Da 100 % si el **coste es 0**, cosa que pasa
cuando:

- el empleado no tiene sueldo registrado en ese mes, o
- las horas no están imputadas a ese servicio (caen en “Sin asignar”).

**Qué hay que decidir.** Nada de negocio: hay que **reproducirlo** para saber
cuál de las dos causas es. Ya existe un aviso de “sin datos de coste” en la tabla,
pero no siempre se dispara.

**Recomendación.** Que alguien abra esa ficha y diga cliente, mes y servicio.
Con eso lo cierro.

**Esfuerzo.** Bajo una vez reproducido.

---

## 6. Revisar la interna de HOSTING

**Qué piden.** “Revisar interna de HOSTING”.

**Qué hay hoy.** No sé **qué** hay que revisar: es una nota sin detalle. La
pantalla de interna del servicio existe y funciona para el resto.

**Qué hay que decidir.** Necesito el caso concreto: ¿un cliente que no aparece?,
¿un importe mal?, ¿un servicio que no suma?

**Esfuerzo.** Desconocido hasta saber el caso.

---

## 7. Tareas de ejemplo que siguen fichadas

**Qué piden.** “En /fichar y /análisis de equipo me salen fichadas las tareas de
ejemplo que había borrado de tareas. ¿Eso se cuenta como fichaje?”

**Qué hay hoy.** Se borraron **4 fichajes** de prueba. No puedo verificar que no
quede ninguno sin revisar la lista completa con los nombres concretos.

**Qué hay que decidir.** Si aparecen más, se borran. Y decidir la regla: cuando se
borra una tarea, ¿se borran sus fichajes o se conservan?

**Recomendación.** Borrar los que queden y, a futuro, que borrar una tarea
**no** borre el tiempo fichado (es historial de trabajo), pero que se marque como
“tarea eliminada”.

**Esfuerzo.** Bajo.

---

## Lo que sí he verificado al revisar esta lista

- **Evolución de facturación por año en barras, en la ficha**: existe
  (`HistoricoFacturacionChart`), está dentro de la ficha del cliente.
- **Evolución mensual en barras en la interna del servicio**: existe
  (`EvolucionMensualChart`), ya no es tabla.
- **Todos los clientes en la interna**: la pantalla los lista; falta confirmar
  visualmente que el desplegable de desglose se comporta como esperan.
- **Coste/hora junto a coste de personal**: columnas adyacentes en el panel.
- **Márgenes rojo por debajo del 50 %**: aplicado en el panel de clientes.

## Resumen para la reunión

| Punto | Tipo | Decisión necesaria |
|---|---|---|
| 1. Recuadro % en el panel | Cosmético | Columna nueva o dejarlo |
| 2. Quitar servicios | **Estructural** | A, B o C (B rompe la rentabilidad) |
| 3. Fichajes sin imputar | Datos | Caso a caso o limpieza |
| 4. Agrupar Meta | Producto | A, B o C |
| 5. 3h45 al 100 % | Fallo | Reproducirlo |
| 6. HOSTING | Sin definir | Qué revisar |
| 7. Tareas de ejemplo | Datos | Borrar y fijar regla |

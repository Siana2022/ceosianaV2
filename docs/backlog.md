# Backlog

Pendientes anotados durante las sesiones de trabajo.

## Cerrados por decisión (no se tocan)

- **Gantt: título completo** — se da por bueno tal y como está.
- **Pipeline en fichajes** — se da por bueno; no se espera más comprobación.

## Tareas / interfaz

- **Avatares del equipo**: solo Anais tiene foto. Cada persona debe subirla en
  *Mi perfil* para que se vea en lista, tarjetas, chat, hub y menciones.
- **Mensajes antiguos sin autor**: guardan `autorId: "emp-1"`, que no existe.
  Se muestran con `?`. Pendiente decidir si se repara con heurística (asignar el
  responsable cuando la tarea tiene uno solo) o se deja como está.
- **Vista de tareas**: por defecto lista (`lista`), con el nombre en una sola
  línea y más ancho para que no se parta en dos.

## Fichaje

- **Minutos antiguos sin autor**: hay tareas cuyo `minutos_acumulados` viene de
  antes de que el fichaje se ligara a la tarea, así que no tienen desglose por
  persona. Ejemplo: *[CAF] Creatividades Cafuster | Meta/Google* (110 min, 0
  fichajes). Ya se avisa en la ficha.
  - Opción A: dejarlos (el total es correcto, sin autor).
  - Opción B: que cada implicado fiche su parte real y ajustar el contador para
    no duplicar.
- **Repartir el tiempo entre varios responsables**: hoy cada uno ficha lo suyo y
  se suma; falta definir si debe haber un reparto automático.

## Funcionalidad

- **Convertidor real del 10 %**: ver `especificacion-convertidor-10.md`.
- **Servicio REUNIONES**: crear el servicio y asignarlo a los clientes.
- **Tiempo por responsable**: definir cómo se reparte el fichaje entre varios.
- **Cronómetro que duplica la tarea** (Carlos): falta reproducir.
- **Gantt con el título completo**: falta reproducir.
- **Botón lateral de notificaciones**: falta definir qué muestra.
- **Orden de tareas por fecha**: decidir criterio por defecto.
- **Tareas creadas sobre un prospecto**: reapuntar a cliente al ganar.

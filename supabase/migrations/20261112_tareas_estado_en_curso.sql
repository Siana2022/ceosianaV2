-- Normaliza el estado 'en_curso' que escribía /fichar al iniciar el cronómetro.
-- La app usa espera | proceso | bloqueada | terminado; 'en_curso' dejaba las
-- tareas fuera de las vistas por estado (Kanban, mis tareas).
-- Aplicado en producción el 12/11/2026 (7 filas).

update public.tareas
set estado = 'proceso'
where estado = 'en_curso';

-- Campo "Enlace con la información" en tareas
-- No se había añadido la columna en la BD aunque sí existía en el código
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS enlace_info text DEFAULT '';

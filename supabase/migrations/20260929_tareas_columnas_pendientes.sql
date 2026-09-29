-- Columnas añadidas al código pero nunca migradas a la DB
-- checklist: commit 5cc9048 (dijo "SQL migration requerida" pero no se creó)
-- sync_calendar: commit d8900ce (sin migración)
-- imagenes: commit d8900ce (sin migración)

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '[]';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS sync_calendar boolean DEFAULT false;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS imagenes jsonb DEFAULT '[]';

-- Añade id_tarea a time_logs para poder detectar fichajes ya creados por una tarea
ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS id_tarea uuid REFERENCES tareas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS time_logs_id_tarea_idx ON time_logs(id_tarea);

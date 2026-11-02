-- Add id_creador to tareas table
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS id_creador uuid REFERENCES empleados(id) ON DELETE SET NULL;

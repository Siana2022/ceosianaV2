-- Añade campo avatar_url a empleados para foto de perfil
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS avatar_url text;

-- Bucket público para avatares
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatares', 'avatares', true)
ON CONFLICT (id) DO NOTHING;

-- Política: cualquier usuario autenticado puede subir/actualizar su propio avatar
CREATE POLICY "avatares_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatares');

CREATE POLICY "avatares_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatares');

CREATE POLICY "avatares_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatares');

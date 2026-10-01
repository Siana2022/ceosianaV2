import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'

const BUCKET = 'avatares'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const perfil = await getPerfil()
  if (!perfil?.id_empleado) return NextResponse.json({ error: 'Sin empleado vinculado' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file requerido' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${perfil.id_empleado}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const admin = createAdminClient()

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)

  // Guarda la URL en empleados
  await admin.from('empleados').update({ avatar_url: publicUrl }).eq('id', perfil.id_empleado)

  return NextResponse.json({ url: publicUrl })
}

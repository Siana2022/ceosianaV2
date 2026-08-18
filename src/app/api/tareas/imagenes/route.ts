import { createAdminClient } from '@/lib/server/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

const BUCKET = 'tareas-imagenes'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const tareaId = formData.get('tareaId') as string | null
    if (!file || !tareaId) {
      return NextResponse.json({ error: 'file y tareaId son requeridos' }, { status: 400 })
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${tareaId}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const supabase = createAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: publicUrl, nombre: file.name })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

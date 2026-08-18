import { createAdminClient } from '@/lib/server/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

const BUCKET = 'tareas-imagenes'

export async function POST(req: NextRequest) {
  try {
    const { createClient } = await import('@/lib/server/supabase')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const tareaId = formData.get('tareaId') as string | null
    if (!file || !tareaId) {
      return NextResponse.json({ error: 'file y tareaId son requeridos' }, { status: 400 })
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${tareaId}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const adminClient = createAdminClient()
    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    const { data: { publicUrl } } = adminClient.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: publicUrl, nombre: file.name })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { createClient: createAuth } = await import('@/lib/server/supabase')
    const supabase = await createAuth()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const url = new URL(req.url).searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'url requerida' }, { status: 400 })

    // Extract storage path from public URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/tareas-imagenes/[path]
    const marker = `/tareas-imagenes/`
    const idx = url.indexOf(marker)
    if (idx === -1) return NextResponse.json({ error: 'URL no válida' }, { status: 400 })
    const path = url.slice(idx + marker.length)

    const adminClient = createAdminClient()
    const { error } = await adminClient.storage.from(BUCKET).remove([path])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

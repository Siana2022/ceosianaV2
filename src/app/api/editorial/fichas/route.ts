import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

async function checkAuth() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// POST — create ficha
export async function POST(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { id_board, id_columna, titulo, copy, canal, fecha_publicacion, imagen_url, orden } = body
  if (!id_board || !id_columna) return NextResponse.json({ error: 'id_board e id_columna requeridos' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('editorial_fichas')
    .insert({
      id_board, id_columna,
      titulo: titulo ?? null,
      copy: copy ?? null,
      canal: canal ?? 'instagram',
      fecha_publicacion: fecha_publicacion ?? null,
      imagen_url: imagen_url ?? null,
      orden: orden ?? 0,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — update ficha (any field, including id_columna for drag&drop)
export async function PATCH(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  const fields = ['titulo', 'copy', 'canal', 'fecha_publicacion', 'imagen_url', 'orden', 'id_columna']
  for (const f of fields) {
    if (body[f] !== undefined) update[f] = body[f] ?? null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('editorial_fichas')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — delete ficha
export async function DELETE(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('editorial_fichas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

async function checkAuth() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// POST — create column
export async function POST(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id_board, nombre, color, orden } = await req.json()
  if (!id_board || !nombre) return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('editorial_columnas')
    .insert({ id_board, nombre, color: color ?? '#6366f1', orden: orden ?? 0 })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — update column (nombre, color, orden)
export async function PATCH(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.nombre !== undefined) update.nombre = body.nombre
  if (body.color !== undefined) update.color = body.color
  if (body.orden !== undefined) update.orden = body.orden

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('editorial_columnas')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — delete column (and its fichas cascade)
export async function DELETE(req: NextRequest) {
  if (!await checkAuth()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('editorial_columnas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

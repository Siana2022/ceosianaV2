import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin() {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return null
  return perfil
}

export async function GET(req: NextRequest) {
  const perfil = await requireAdmin()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  const client = createAdminClient()

  if (id) {
    const { data, error } = await client
      .from('pipeline_prospectos')
      .select('*, responsable_captacion:empleados!responsable_captacion(id, nombre), responsable_seguimiento:empleados!responsable_seguimiento(id, nombre)')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await client
    .from('pipeline_prospectos')
    .select('*, responsable_captacion:empleados!responsable_captacion(id, nombre), responsable_seguimiento:empleados!responsable_seguimiento(id, nombre)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const perfil = await requireAdmin()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const { nombre, estado, responsable_captacion, responsable_seguimiento, fecha_inicio, fecha_fin, notas } = body

  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('pipeline_prospectos')
    .insert({
      nombre: nombre.trim(),
      estado: estado ?? 'descubrimiento',
      responsable_captacion: responsable_captacion || null,
      responsable_seguimiento: responsable_seguimiento || null,
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      notas: notas || null,
      activo: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const perfil = await requireAdmin()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const body = await req.json()
  const allowed = ['nombre', 'estado', 'responsable_captacion', 'responsable_seguimiento', 'fecha_inicio', 'fecha_fin', 'notas', 'activo']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key] === '' ? null : body[key]
  }

  // Auto-set fecha_fin when moving to ganado/perdido and no fecha_fin provided
  if ((body.estado === 'ganado' || body.estado === 'perdido') && !('fecha_fin' in body)) {
    patch.fecha_fin = new Date().toISOString().split('T')[0]
  }
  // Auto-inactivate when perdido
  if (body.estado === 'perdido' && !('activo' in body)) {
    patch.activo = false
  }

  const { data, error } = await createAdminClient()
    .from('pipeline_prospectos')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const perfil = await requireAdmin()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const { error } = await createAdminClient()
    .from('pipeline_prospectos')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

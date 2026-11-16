import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'

// GET /api/hub/notas?id_cliente=<uuid>
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const idCliente = new URL(req.url).searchParams.get('id_cliente')
  if (!idCliente) return NextResponse.json({ error: 'id_cliente requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('notas_conocimiento')
    .select('id, id_cliente, id_servicio, titulo, contenido, visibilidad, created_at, empleado:id_empleado(nombre)')
    .eq('id_cliente', idCliente)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/hub/notas — crear una nota de conocimiento
export async function POST(req: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { id_cliente, id_servicio, titulo, contenido, visibilidad } = body

  if (!id_cliente) return NextResponse.json({ error: 'id_cliente requerido' }, { status: 400 })
  if (!titulo?.trim()) return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notas_conocimiento')
    .insert({
      id_cliente,
      id_servicio: id_servicio || null,
      id_empleado: perfil.id_empleado ?? null,
      titulo: titulo.trim(),
      contenido: contenido?.trim() || null,
      visibilidad: visibilidad === 'compartida' ? 'compartida' : 'interna',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/hub/notas?id=<uuid>
export async function DELETE(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('notas_conocimiento').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

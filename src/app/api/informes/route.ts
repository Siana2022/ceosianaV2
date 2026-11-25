import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'

// GET /api/informes?id_cliente=...  → informes del cliente
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const idCliente = new URL(req.url).searchParams.get('id_cliente')
  if (!idCliente) return NextResponse.json({ error: 'id_cliente requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('informes')
    .select('id, id_cliente, nombre, descripcion, tipo, config, publico, orden, updated_at')
    .eq('id_cliente', idCliente)
    .order('orden')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST → crear informe
export async function POST(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const body = await req.json()
  const { id_cliente, nombre, descripcion, tipo } = body as {
    id_cliente?: string; nombre?: string; descripcion?: string; tipo?: string
  }
  if (!id_cliente || !nombre?.trim()) {
    return NextResponse.json({ error: 'Cliente y nombre son obligatorios' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('informes')
    .insert({
      id_cliente,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      tipo: tipo ?? 'mensual',
      config: { bloques: [] },
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH → guardar configuración del informe
export async function PATCH(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const body = await req.json()
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.nombre !== undefined) row.nombre = String(body.nombre).trim()
  if (body.descripcion !== undefined) row.descripcion = body.descripcion || null
  if (body.tipo !== undefined) row.tipo = body.tipo
  if (body.config !== undefined) row.config = body.config
  if (body.publico !== undefined) row.publico = Boolean(body.publico)
  if (body.orden !== undefined) row.orden = Number(body.orden)

  const supabase = await createClient()
  const { error } = await supabase.from('informes').update(row).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE
export async function DELETE(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('informes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

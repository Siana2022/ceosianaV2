import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'

// GET /api/hub/cuentas?id_servicio=<uuid>  → cuentas de un servicio
// GET /api/hub/cuentas?id_cliente=<uuid>   → cuentas de todos los servicios del cliente
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const idServicio = searchParams.get('id_servicio')
  const idCliente = searchParams.get('id_cliente')

  let query = supabase
    .from('cuenta_plataforma')
    .select('id, id_servicio, plataforma, id_externo, nombre, moneda, zona_horaria, activa, ultima_sync')
    .order('plataforma')

  if (idServicio) query = query.eq('id_servicio', idServicio)
  else if (idCliente) {
    const { data: servicios } = await supabase.from('servicios').select('id').eq('id_cliente', idCliente)
    const ids = (servicios ?? []).map(s => s.id)
    if (ids.length === 0) return NextResponse.json([])
    query = query.in('id_servicio', ids)
  } else {
    return NextResponse.json({ error: 'id_servicio o id_cliente requerido' }, { status: 400 })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST → vincular cuenta a un servicio (solo admin)
export async function POST(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const body = await req.json()
  const { id_servicio, plataforma, id_externo, nombre, moneda, zona_horaria } = body

  if (!id_servicio || !plataforma || !id_externo?.trim() || !nombre?.trim()) {
    return NextResponse.json({ error: 'Servicio, plataforma, identificador y nombre son obligatorios' }, { status: 400 })
  }
  if (!['google_ads', 'meta_ads', 'ga4'].includes(plataforma)) {
    return NextResponse.json({ error: 'Plataforma no válida' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cuenta_plataforma')
    .insert({
      id_servicio,
      plataforma,
      id_externo: id_externo.trim(),
      nombre: nombre.trim(),
      moneda: moneda?.trim() || 'EUR',
      zona_horaria: zona_horaria?.trim() || 'Europe/Madrid',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Esa cuenta ya está vinculada a otro servicio' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// PUT → editar nombre / activa (solo admin)
export async function PUT(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const body = await req.json()
  const { id, nombre, activa } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (nombre !== undefined) update.nombre = String(nombre).trim()
  if (activa !== undefined) update.activa = Boolean(activa)

  const supabase = await createClient()
  const { data, error } = await supabase.from('cuenta_plataforma').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE → desvincular (solo admin)
export async function DELETE(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('cuenta_plataforma').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

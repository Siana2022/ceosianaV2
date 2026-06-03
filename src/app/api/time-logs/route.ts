import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get('fecha') // YYYY-MM or YYYY-MM-DD
  const id_empleado = searchParams.get('id_empleado') // admin only

  let query = supabase
    .from('time_logs')
    .select(`
      id, id_empleado, id_servicio, id_cliente, id_departamento,
      descripcion, fecha, hora_inicio, hora_fin, minutos, created_at,
      empleado:id_empleado(id, nombre),
      servicio:id_servicio(id, nombre, notas),
      cliente:id_cliente(id, nombre),
      departamento:id_departamento(id, nombre)
    `)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  // Employees only see their own logs
  if (perfil.rol === 'empleado') {
    if (!perfil.id_empleado) return NextResponse.json([])
    query = query.eq('id_empleado', perfil.id_empleado)
  } else if (id_empleado) {
    // Admin filtering by specific employee
    query = query.eq('id_empleado', id_empleado)
  }

  // Filter by month (YYYY-MM) or specific date
  if (fecha) {
    if (fecha.length === 7) {
      query = query.gte('fecha', `${fecha}-01`).lte('fecha', `${fecha}-31`)
    } else {
      query = query.eq('fecha', fecha)
    }
  }

  const { data, error } = await query.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil || !perfil.id_empleado) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { id_servicio, id_cliente, id_departamento, descripcion, fecha, hora_inicio, hora_fin, minutos } = body

  if (!descripcion?.trim()) return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 })
  if (!fecha) return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 })
  if (!minutos || minutos <= 0) return NextResponse.json({ error: 'Los minutos deben ser mayores que 0' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_logs')
    .insert({
      id_empleado: perfil.id_empleado,
      id_servicio: id_servicio || null,
      id_cliente: id_cliente || null,
      id_departamento: id_departamento || null,
      descripcion: descripcion.trim(),
      fecha,
      hora_inicio: hora_inicio || null,
      hora_fin: hora_fin || null,
      minutos: parseInt(minutos),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const supabase = await createClient()

  // Check ownership if not admin
  if (perfil.rol !== 'admin') {
    const { data: log } = await supabase.from('time_logs').select('id_empleado').eq('id', id).single()
    if (log?.id_empleado !== perfil.id_empleado) {
      return NextResponse.json({ error: 'No puedes eliminar logs de otros' }, { status: 403 })
    }
  }

  const { error } = await supabase.from('time_logs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

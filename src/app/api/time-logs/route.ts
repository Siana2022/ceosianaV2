import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'
import { NextRequest, NextResponse } from 'next/server'

// Resolve the empleado ID for the current session.
// Priority: perfiles table → fallback to email match in empleados
async function resolveEmpleadoId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ id: string; rol: 'admin' | 'empleado' } | null> {
  const perfil = await getPerfil()
  if (perfil?.id_empleado) return { id: perfil.id_empleado, rol: perfil.rol }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.email) return null

  const { data: emp } = await supabase
    .from('empleados')
    .select('id')
    .eq('email', session.user.email)
    .maybeSingle()

  if (!emp) return null
  // No profile row → treat as admin (existing users)
  return { id: emp.id, rol: perfil?.rol ?? 'admin' }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const resolved = await resolveEmpleadoId(supabase)
  if (!resolved) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get('fecha')
  const id_empleado_filter = searchParams.get('id_empleado')

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
  if (resolved.rol === 'empleado') {
    query = query.eq('id_empleado', resolved.id)
  } else if (id_empleado_filter) {
    query = query.eq('id_empleado', id_empleado_filter)
  }

  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  if (desde && hasta) {
    query = query.gte('fecha', desde).lte('fecha', hasta)
  } else if (fecha) {
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
  const supabase = await createClient()
  const resolved = await resolveEmpleadoId(supabase)
  if (!resolved) return NextResponse.json({ error: 'No autorizado. Asegúrate de que tu email coincide con un empleado en el sistema.' }, { status: 401 })

  const body = await req.json()
  const { id_servicio, id_cliente, id_departamento, descripcion, fecha, hora_inicio, hora_fin, minutos } = body

  if (!descripcion?.trim()) return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 })
  if (!fecha) return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 })
  if (!minutos || minutos <= 0) return NextResponse.json({ error: 'Los minutos deben ser mayores que 0' }, { status: 400 })

  const { data, error } = await supabase
    .from('time_logs')
    .insert({
      id_empleado: resolved.id,
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

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const resolved = await resolveEmpleadoId(supabase)
  if (!resolved) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  if (resolved.rol === 'empleado') {
    const { data: log } = await supabase.from('time_logs').select('id_empleado').eq('id', id).single()
    if (log?.id_empleado !== resolved.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const { descripcion, id_cliente, id_departamento, minutos } = body
  const { data, error } = await supabase.from('time_logs')
    .update({ descripcion, id_cliente: id_cliente || null, id_departamento: id_departamento || null, minutos: parseInt(minutos) })
    .eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const resolved = await resolveEmpleadoId(supabase)
  if (!resolved) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  // Employees can only delete their own logs
  if (resolved.rol === 'empleado') {
    const { data: log } = await supabase.from('time_logs').select('id_empleado').eq('id', id).single()
    if (log?.id_empleado !== resolved.id) {
      return NextResponse.json({ error: 'No puedes eliminar logs de otros' }, { status: 403 })
    }
  }

  const { error } = await supabase.from('time_logs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

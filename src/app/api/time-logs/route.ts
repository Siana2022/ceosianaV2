import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
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

  if (!emp) {
    // Valid session but no employee record → deny admin access
    return { id: session.user.id, rol: 'empleado' as const }
  }
  // No profile row → treat as empleado (safe default)
  return { id: emp.id, rol: perfil?.rol ?? 'empleado' }
}

export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient()
  const resolved = await resolveEmpleadoId(supabase)
  if (!resolved) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get('fecha')
  const id_empleado_filter = searchParams.get('id_empleado')
  const mine = searchParams.get('mine')

  // Admins use the service client to bypass RLS and see all employees' logs
  let queryClient = supabase
  if (resolved.rol === 'admin' && mine !== '1') {
    try {
      queryClient = createAdminClient()
    } catch (e) {
      console.error('createAdminClient failed, falling back to user client:', e)
    }
  }

  let query = queryClient
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

  if (mine === '1') {
    query = query.eq('id_empleado', resolved.id)
  } else if (resolved.rol === 'empleado') {
    query = query.eq('id_empleado', resolved.id)
  } else if (id_empleado_filter) {
    query = query.eq('id_empleado', id_empleado_filter)
  }

  // Timers activos (hora_fin IS NULL) — solo admin
  const activos = searchParams.get('activos')
  if (activos === '1') {
    if (resolved.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    const today = new Date().toISOString().split('T')[0]
    const { data: activosData, error: activosError } = await createAdminClient()
      .from('time_logs')
      .select('id, id_empleado, descripcion, fecha, hora_inicio, minutos, empleado:id_empleado(id, nombre), cliente:id_cliente(id, nombre), departamento:id_departamento(id, nombre)')
      .is('hora_fin', null)
      .eq('fecha', today)
      .order('hora_inicio', { ascending: true })
    if (activosError) return NextResponse.json({ error: activosError.message }, { status: 500 })
    return NextResponse.json(activosData ?? [])
  }

  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  if (desde && hasta) {
    query = query.gte('fecha', desde).lte('fecha', hasta)
  } else if (fecha) {
    if (fecha.length === 7) {
      const [y, m] = fecha.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      query = query.gte('fecha', `${fecha}-01`).lte('fecha', `${fecha}-${String(lastDay).padStart(2,'0')}`)
    } else {
      query = query.eq('fecha', fecha)
    }
  }

  const PAGE = 1000
  const allResults: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data: page, error } = await query.range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = (page ?? []) as Record<string, unknown>[]
    allResults.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }
  return NextResponse.json(allResults)
  } catch (err) {
    console.error('GET /api/time-logs error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const resolved = await resolveEmpleadoId(supabase)
  if (!resolved) return NextResponse.json({ error: 'No autorizado. Asegúrate de que tu email coincide con un empleado en el sistema.' }, { status: 401 })

  const body = await req.json()
  const { id_servicio, id_cliente, id_departamento, descripcion, fecha, hora_inicio, hora_fin, minutos, timer_abierto } = body

  if (!descripcion?.trim()) return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 })
  if (!fecha) return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 })
  // Allow minutos=0 only for open timer records (timer_abierto=true)
  if (!timer_abierto && (!minutos || minutos <= 0)) return NextResponse.json({ error: 'Los minutos deben ser mayores que 0' }, { status: 400 })

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
      // Timer abierto → 1 (placeholder; se actualiza con el PATCH al parar)
      // Timer cerrado → minutos reales
      minutos: timer_abierto ? 1 : (parseInt(minutos) || 1),
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
  const { descripcion, id_cliente, id_departamento, id_servicio, minutos, hora_fin, hora_inicio } = body
  const updatePayload: Record<string, unknown> = {}
  if (descripcion !== undefined) updatePayload.descripcion = descripcion
  if (id_cliente !== undefined) updatePayload.id_cliente = id_cliente || null
  if (id_departamento !== undefined) updatePayload.id_departamento = id_departamento || null
  if (id_servicio !== undefined) updatePayload.id_servicio = id_servicio || null
  if (minutos !== undefined) updatePayload.minutos = parseInt(minutos)
  if (hora_fin !== undefined) updatePayload.hora_fin = hora_fin || null
  if (hora_inicio !== undefined) updatePayload.hora_inicio = hora_inicio || null
  const { data, error } = await supabase.from('time_logs')
    .update(updatePayload)
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

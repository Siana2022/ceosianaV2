import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id_cliente = searchParams.get('id_cliente')

  let query = supabase
    .from('servicios')
    .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre)')

  if (id_cliente) {
    query = query.eq('id_cliente', id_cliente)
  }

  const { data, error } = await query

  if (error) {
    console.error('GET /api/servicios', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id_cliente, nombre, tipo, precio_base, id_departamento, id_responsable, fecha_inicio, fecha_fin, notas } = body

  const { data, error } = await supabase
    .from('servicios')
    .insert({ id_cliente, nombre, tipo, precio_base, id_departamento, id_responsable, fecha_inicio, fecha_fin, notas })
    .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre)')
    .single()

  if (error) {
    console.error('POST /api/servicios', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aviso a administración: servicio creado sin facturación, hay que ponerle precio
  try {
    const admin = createAdminClient()
    const { data: cliente } = await admin.from('clientes').select('nombre').eq('id', id_cliente).maybeSingle()
    const { data: admins } = await admin
      .from('perfiles')
      .select('id_empleado')
      .eq('rol', 'admin')
      .not('id_empleado', 'is', null)

    const avisos = (admins ?? [])
      .filter((a: { id_empleado: string | null }) => !!a.id_empleado)
      .map((a: { id_empleado: string }) => ({
        id_empleado: a.id_empleado,
        tipo: 'servicio_sin_facturacion',
        titulo: `Servicio sin facturación: ${nombre}`,
        mensaje: `Se creó "${nombre}" en ${cliente?.nombre ?? 'un cliente'} desde el fichaje. Revísalo y ponle precio.`,
        leida: false,
      }))

    if (avisos.length > 0) await admin.from('notificaciones').insert(avisos)
  } catch (e) {
    console.error('POST /api/servicios · aviso', e)
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, nombre, tipo, precio_base, id_departamento, id_responsable, fecha_inicio, fecha_fin, activo, notas } = body

  const { data, error } = await supabase
    .from('servicios')
    .update({ nombre, tipo, precio_base, id_departamento, id_responsable, fecha_inicio, fecha_fin, activo, notas })
    .eq('id', id)
    .select('*, cliente:id_cliente(id,nombre), departamento:id_departamento(id,nombre), responsable:id_responsable(id,nombre)')
    .single()

  if (error) {
    console.error('PUT /api/servicios', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Si cambia el departamento del servicio, los fichajes de ese servicio lo siguen
  if (id_departamento !== undefined && id) {
    const { error: errLogs } = await supabase
      .from('time_logs')
      .update({ id_departamento: id_departamento || null })
      .eq('id_servicio', id)
    if (errLogs) console.error('PUT /api/servicios · time_logs', errLogs)
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  const { error } = await supabase
    .from('servicios')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE /api/servicios', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

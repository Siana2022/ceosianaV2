import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('departamentos')
    .select('*')
    .order('nombre')

  if (error) {
    console.error('GET /api/departamentos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

async function saveDedicacion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id_departamento: string,
  empleados: { id_empleado: string; porcentaje: number }[]
) {
  if (empleados.length === 0) return
  const anio = new Date().getFullYear()
  const records = Array.from({ length: 12 }, (_, i) => i + 1).flatMap(mes =>
    empleados.map(e => ({
      id_empleado: e.id_empleado,
      id_departamento,
      porcentaje: e.porcentaje,
      mes,
      anio,
    }))
  )
  await supabase
    .from('empleado_dedicacion')
    .upsert(records, { onConflict: 'id_empleado,id_departamento,mes,anio' })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { nombre, empleados } = body // empleados: [{id_empleado, porcentaje}]

  const { data, error } = await supabase
    .from('departamentos')
    .insert({ nombre })
    .select()
    .single()

  if (error) {
    console.error('POST /api/departamentos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (empleados?.length > 0) {
    await supabase.from('departamento_empleados').insert(
      empleados.map((e: { id_empleado: string }) => ({ id_departamento: data.id, id_empleado: e.id_empleado }))
    )
    await saveDedicacion(supabase, data.id, empleados)
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, nombre, activo, empleados } = body // empleados: [{id_empleado, porcentaje}]

  const updateData: Record<string, unknown> = {}
  if (nombre !== undefined) updateData.nombre = nombre
  if (activo !== undefined) updateData.activo = activo

  const { data, error } = await supabase
    .from('departamentos')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PUT /api/departamentos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Sync members + dedicacion if provided
  if (empleados !== undefined) {
    await supabase.from('departamento_empleados').delete().eq('id_departamento', id)
    if (empleados.length > 0) {
      await supabase.from('departamento_empleados').insert(
        empleados.map((e: { id_empleado: string }) => ({ id_departamento: id, id_empleado: e.id_empleado }))
      )
      await saveDedicacion(supabase, id, empleados)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')

  const { error } = await supabase.from('departamentos').delete().eq('id', id)
  if (error) {
    console.error('DELETE /api/departamentos', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

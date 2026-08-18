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

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { nombre, empleados } = body // empleados: [{id_empleado}] — solo asigna miembros, la dedicación ya no se guarda a mano

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
  }

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, nombre, activo, empleados } = body // empleados: [{id_empleado}] — solo asigna miembros, la dedicación ya no se guarda a mano

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

  // Sync members if provided
  if (empleados !== undefined) {
    await supabase.from('departamento_empleados').delete().eq('id_departamento', id)
    if (empleados.length > 0) {
      await supabase.from('departamento_empleados').insert(
        empleados.map((e: { id_empleado: string }) => ({ id_departamento: id, id_empleado: e.id_empleado }))
      )
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

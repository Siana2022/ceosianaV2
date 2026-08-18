import { createClient } from '@/lib/server/supabase'
import { NextRequest, NextResponse } from 'next/server'

function rowToPlantilla(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    nombre: (row.nombre as string) ?? '',
    descripcion: (row.descripcion as string) ?? '',
    tipoServicio: (row.tipo_servicio as string | null) ?? null,
    activo: (row.activo as boolean) ?? true,
    fases: (row.fases as unknown[]) ?? [],
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('plantillas')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(r => rowToPlantilla(r as Record<string, unknown>)))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json() as Record<string, unknown>
  const insert: Record<string, unknown> = {
    nombre: body.nombre,
    descripcion: body.descripcion ?? '',
    tipo_servicio: body.tipoServicio ?? null,
    activo: body.activo ?? true,
    fases: body.fases ?? [],
  }
  if (body.id) insert.id = body.id
  const { data, error } = await supabase.from('plantillas').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rowToPlantilla(data as Record<string, unknown>))
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const body = await req.json() as Record<string, unknown>
  const update: Record<string, unknown> = {}
  if (body.nombre !== undefined) update.nombre = body.nombre
  if (body.descripcion !== undefined) update.descripcion = body.descripcion
  if (body.tipoServicio !== undefined) update.tipo_servicio = body.tipoServicio
  if (body.activo !== undefined) update.activo = body.activo
  if (body.fases !== undefined) update.fases = body.fases
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true })
  const { error } = await supabase.from('plantillas').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  const { error } = await supabase.from('plantillas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { createClient } from '@/lib/server/supabase'
import { NextRequest, NextResponse } from 'next/server'

function rowToProceso(row: Record<string, unknown>) {
  return {
    id: row.id,
    idCliente: row.id_cliente ?? '',
    idServicio: row.id_servicio ?? null,
    idPlantilla: row.id_plantilla ?? '',
    nombre: row.nombre ?? '',
    fases: row.fases ?? [],
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('procesos')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json((data ?? []).map(rowToProceso))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json() as {
      id?: string
      idCliente: string
      idServicio: string | null
      idPlantilla: string
      nombre: string
      fases: unknown[]
    }
    const row: Record<string, unknown> = {
      id_cliente: body.idCliente,
      id_servicio: body.idServicio,
      id_plantilla: body.idPlantilla,
      nombre: body.nombre,
      fases: body.fases,
    }
    if (body.id) row.id = body.id
    const { data, error } = await supabase.from('procesos').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(rowToProceso(data as Record<string, unknown>))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    const body = await req.json() as { fases?: unknown[]; nombre?: string }
    const row: Record<string, unknown> = {}
    if (body.fases !== undefined) row.fases = body.fases
    if (body.nombre !== undefined) row.nombre = body.nombre
    if (Object.keys(row).length === 0) return NextResponse.json({ ok: true })
    const { error } = await supabase.from('procesos').update(row).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    const { error } = await supabase.from('procesos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

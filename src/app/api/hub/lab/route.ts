import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'

// Almacén del Creative Lab: mismas operaciones que usaba el artefacto en
// Claude (doc.get/set/update, collection.where().limit().get(), add()).

type Cuerpo = {
  op: 'get' | 'set' | 'update' | 'add' | 'query'
  coleccion?: string
  id?: string
  datos?: Record<string, unknown>
  donde?: { campo: string; valor: unknown }
  limite?: number
}

export async function POST(req: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = (await req.json()) as Cuerpo
  const coleccion = (body.coleccion ?? '').trim()

  if (!coleccion) return NextResponse.json({ error: 'coleccion requerida' }, { status: 400 })

  const supabase = await createClient()

  // Cliente asociado, si el documento lo trae
  const datos = body.datos ?? {}
  const clienteId = typeof datos.clientId === 'string' && datos.clientId.length === 36 ? datos.clientId : null
  const plataforma = typeof datos.plataforma === 'string' ? datos.plataforma : null

  try {
    switch (body.op) {
      case 'get': {
        const { data } = await supabase
          .from('lab_docs')
          .select('datos')
          .eq('coleccion', coleccion)
          .eq('doc_id', body.id ?? '')
          .maybeSingle()
        return NextResponse.json({ exists: !!data, data: data?.datos ?? null })
      }

      case 'set': {
        const { error } = await supabase
          .from('lab_docs')
          .upsert(
            {
              coleccion,
              doc_id: body.id ?? '',
              datos,
              id_cliente: clienteId,
              plataforma,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'coleccion,doc_id' },
          )
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }

      case 'update': {
        const { data: actual } = await supabase
          .from('lab_docs')
          .select('datos')
          .eq('coleccion', coleccion)
          .eq('doc_id', body.id ?? '')
          .maybeSingle()

        const fusionado = { ...((actual?.datos as Record<string, unknown>) ?? {}), ...datos }
        const { error } = await supabase
          .from('lab_docs')
          .upsert(
            {
              coleccion,
              doc_id: body.id ?? '',
              datos: fusionado,
              id_cliente: clienteId,
              plataforma,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'coleccion,doc_id' },
          )
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }

      case 'add': {
        const nuevoId = crypto.randomUUID()
        const { error } = await supabase.from('lab_docs').insert({
          coleccion,
          doc_id: nuevoId,
          datos,
          id_cliente: clienteId,
          plataforma,
        })
        if (error) throw new Error(error.message)
        return NextResponse.json({ id: nuevoId })
      }

      case 'query': {
        let q = supabase
          .from('lab_docs')
          .select('doc_id, datos')
          .eq('coleccion', coleccion)
          .order('created_at', { ascending: false })
          .limit(Math.min(Number(body.limite ?? 50), 500))

        if (body.donde?.campo && body.donde.valor !== undefined) {
          q = q.filter(`datos->>${body.donde.campo}`, 'eq', String(body.donde.valor))
        }

        const { data, error } = await q
        if (error) throw new Error(error.message)
        return NextResponse.json({
          docs: (data ?? []).map(d => ({ id: d.doc_id, data: d.datos })),
        })
      }

      default:
        return NextResponse.json({ error: 'Operación no soportada' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

// GET /api/hub/lab?coleccion=x — utilidad de comprobación
export async function GET(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const coleccion = new URL(req.url).searchParams.get('coleccion')
  const admin = createAdminClient()
  let q = admin.from('lab_docs').select('coleccion, doc_id, created_at').order('created_at', { ascending: false }).limit(20)
  if (coleccion) q = q.eq('coleccion', coleccion)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ docs: data ?? [] })
}

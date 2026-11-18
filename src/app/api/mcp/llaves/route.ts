import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { generarLlave } from '@/lib/server/mcpAuth'

// GET /api/mcp/llaves — listado (sin el secreto)
export async function GET() {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mcp_llaves')
    .select('id, nombre, tipo, prefijo, activo, ultimo_uso, created_at, empleado:id_empleado(nombre)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ llaves: data ?? [] })
}

// POST /api/mcp/llaves — crea una llave y devuelve el secreto una sola vez
export async function POST(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    nombre?: string
    tipo?: string
    id_empleado?: string | null
  }

  const nombre = (body.nombre ?? '').trim()
  const tipo = body.tipo === 'admin' ? 'admin' : 'operativo'
  if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const { token, hash, prefijo } = generarLlave()
  const admin = createAdminClient()
  const { error } = await admin.from('mcp_llaves').insert({
    nombre,
    tipo,
    id_perfil: perfil.id,
    id_empleado: body.id_empleado || null,
    hash,
    prefijo,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ token, prefijo, nombre, tipo })
}

// DELETE /api/mcp/llaves?id=... — revoca
export async function DELETE(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('mcp_llaves').update({ activo: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

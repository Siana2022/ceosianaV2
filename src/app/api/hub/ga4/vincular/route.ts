import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'

// POST /api/hub/ga4/vincular  { id_cliente, propiedad }
export async function POST(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const { id_cliente, propiedad } = await req.json() as { id_cliente?: string; propiedad?: string }
  if (!id_cliente) return NextResponse.json({ error: 'id_cliente requerido' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('clientes')
    .update({ ga4_propiedad: propiedad || null })
    .eq('id', id_cliente)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'

// POST /api/hub/portal — crea (o renueva) el enlace público del cliente
export async function POST(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const { id_cliente } = await req.json()
  if (!id_cliente) return NextResponse.json({ error: 'id_cliente requerido' }, { status: 400 })

  const token = crypto.randomBytes(16).toString('hex')
  const admin = createAdminClient()
  const { error } = await admin.from('clientes').update({ token_portal: token }).eq('id', id_cliente)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ token })
}

// DELETE /api/hub/portal?id_cliente=... — revoca el enlace
export async function DELETE(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })

  const idCliente = new URL(req.url).searchParams.get('id_cliente')
  if (!idCliente) return NextResponse.json({ error: 'id_cliente requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('clientes').update({ token_portal: null }).eq('id', idCliente)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

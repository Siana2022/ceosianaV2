import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin.from('configuracion').select('clave, valor')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.clave] = row.valor
  return NextResponse.json(map)
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Check admin role
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle()

  if (perfil?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo los administradores pueden modificar la configuración' }, { status: 403 })
  }

  const body = await req.json() as { clave: string; valor: string }
  if (!body.clave || body.valor === undefined) {
    return NextResponse.json({ error: 'clave y valor son obligatorios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('configuracion')
    .upsert({ clave: body.clave, valor: String(body.valor), updated_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'

export async function GET() {
  const perfil = await getPerfil()
  if (!perfil?.id_empleado) return NextResponse.json({ count: 0 })

  const admin = createAdminClient()
  const { count, error } = await admin
    .from('notificaciones_empleado')
    .select('id', { count: 'exact', head: true })
    .eq('id_empleado', perfil.id_empleado)
    .eq('leida', false)

  if (error) return NextResponse.json({ count: 0 })
  return NextResponse.json({ count: count ?? 0 })
}

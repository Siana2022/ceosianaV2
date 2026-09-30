import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'

export async function GET() {
  const perfil = await getPerfil()
  if (!perfil?.id_empleado) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const hoy = new Date().toISOString().slice(0, 10)

  const [notifResult, tareasResult] = await Promise.all([
    admin
      .from('notificaciones_empleado')
      .select('id, tipo, titulo, mensaje, id_tarea, leida, created_at')
      .eq('id_empleado', perfil.id_empleado)
      .eq('leida', false)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('tareas')
      .select('id, nombre, tipo, estado, hora, id_cliente, ids_responsables')
      .eq('fecha_limite', hoy)
      .neq('estado', 'terminado')
      .contains('ids_responsables', JSON.stringify([perfil.id_empleado]))
      .order('hora', { ascending: true, nullsFirst: false }),
  ])

  return NextResponse.json({
    notificaciones: notifResult.data ?? [],
    tareasHoy: tareasResult.data ?? [],
  })
}

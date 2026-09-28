import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'

export interface Notificacion {
  id: string
  tipo: string
  titulo: string
  mensaje: string | null
  id_tarea: string | null
  leida: boolean
  created_at: string
}

// GET /api/notificaciones — notificaciones del empleado autenticado
export async function GET() {
  const perfil = await getPerfil()
  if (!perfil?.id_empleado) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('notificaciones_empleado')
    .select('id, tipo, titulo, mensaje, id_tarea, leida, created_at')
    .eq('id_empleado', perfil.id_empleado)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PATCH /api/notificaciones — marcar como leídas
// body: { ids: string[] } o { all: true }
export async function PATCH(req: NextRequest) {
  const perfil = await getPerfil()
  if (!perfil?.id_empleado) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as { ids?: string[]; all?: boolean }
  const admin = createAdminClient()

  let query = admin
    .from('notificaciones_empleado')
    .update({ leida: true })
    .eq('id_empleado', perfil.id_empleado)

  if (body.all) {
    query = query.eq('leida', false)
  } else if (body.ids?.length) {
    query = query.in('id', body.ids)
  } else {
    return NextResponse.json({ ok: true })
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Función helper para crear notificaciones (usada desde /api/tareas)
export async function crearNotificacion(opts: {
  idEmpleado: string
  tipo: string
  titulo: string
  mensaje?: string
  idTarea?: string
}) {
  const admin = createAdminClient()
  await admin.from('notificaciones_empleado').insert({
    id_empleado: opts.idEmpleado,
    tipo: opts.tipo,
    titulo: opts.titulo,
    mensaje: opts.mensaje ?? null,
    id_tarea: opts.idTarea ?? null,
  })
}

// GET /api/notificaciones/count — solo el conteo de no leídas (para el sidebar)
export async function HEAD() {
  return NextResponse.json({})
}

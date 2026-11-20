import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

// GET /api/tareas/tiempos?id=<tarea> — tiempo fichado por persona en una tarea
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('time_logs')
    .select('minutos, id_empleado, empleado:id_empleado(id, nombre, avatar_url)')
    .eq('id_tarea', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapa = new Map<string, { id: string; nombre: string; avatar: string | null; minutos: number }>()

  for (const fila of data ?? []) {
    const emp = fila.empleado as unknown as { id: string; nombre: string; avatar_url: string | null } | null
    const clave = emp?.id ?? 'sin'
    const actual = mapa.get(clave) ?? {
      id: clave,
      nombre: emp?.nombre ?? 'Sin asignar',
      avatar: emp?.avatar_url ?? null,
      minutos: 0,
    }
    actual.minutos += Number(fila.minutos ?? 0)
    mapa.set(clave, actual)
  }

  const porEmpleado = [...mapa.values()].sort((a, b) => b.minutos - a.minutos)
  const total = porEmpleado.reduce((t, e) => t + e.minutos, 0)

  return NextResponse.json({ total, por_empleado: porEmpleado })
}

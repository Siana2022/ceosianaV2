import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { sendSlackMessage } from '@/lib/slack'

// GET /api/slack/test-mention?email=juanjo@sianadigital.com&canal=activage
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email') ?? ''
  const canal = searchParams.get('canal') ?? ''
  const base = new URL(req.url).origin
  const log: Record<string, unknown> = { email, canal, base }

  if (!email || !canal) {
    return NextResponse.json({ error: 'Faltan parámetros: email y canal', log })
  }

  // Step 1: find empleado
  const admin = createAdminClient()
  const { data: emp, error: empError } = await admin.from('empleados').select('id, nombre, email').eq('email', email).maybeSingle()
  log.empleado = emp ?? null
  log.empleado_error = empError?.message ?? null

  if (!emp) {
    return NextResponse.json({ error: 'Empleado no encontrado con ese email', log })
  }

  // Step 2: fetch tasks
  const { data: tareas, error: tareasError } = await admin
    .from('tareas')
    .select('id, nombre, estado, fecha_limite, id_cliente')
    .contains('ids_responsables', [emp.id])
    .neq('estado', 'terminado')
    .order('fecha_limite', { ascending: true })

  log.tareas_count = tareas?.length ?? 0
  log.tareas_error = tareasError?.message ?? null
  log.tareas = tareas?.map(t => ({ id: t.id, nombre: t.nombre, estado: t.estado })) ?? []

  // Step 3: build message
  const bloqueadas = (tareas ?? []).filter(t => t.estado === 'bloqueada')
  const resto = (tareas ?? []).filter(t => t.estado !== 'bloqueada')
  const lines: string[] = []
  type Tarea = { id: string; nombre: string; estado: string; fecha_limite: string | null; id_cliente: string | null }
  const fmt = (t: Tarea) => `• ${t.nombre} _(${t.estado})_`
  if (bloqueadas.length) { lines.push(`🔴 *Bloqueadas (${bloqueadas.length})*`); bloqueadas.forEach(t => lines.push(fmt(t))) }
  if (resto.length) { lines.push(`📋 *Pendientes (${resto.length})*`); resto.forEach(t => lines.push(fmt(t))) }
  const msg = lines.length ? lines.join('\n') : '✅ No tienes tareas pendientes.'
  log.message = msg

  // Step 4: send to Slack
  try {
    await sendSlackMessage(canal, msg)
    log.slack_sent = true
  } catch (e) {
    log.slack_sent = false
    log.slack_error = String(e)
  }

  return NextResponse.json({ ok: true, log })
}

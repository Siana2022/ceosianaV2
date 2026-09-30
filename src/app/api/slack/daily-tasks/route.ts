import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { sendSlackDM } from '@/lib/slack'

// Called daily via Vercel cron (vercel.json) at 09:00h Madrid (07:00 UTC, weekdays only)
// Sends each employee a DM with their pending tasks grouped by priority

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const base = new URL(req.url).origin
  const testEmail = new URL(req.url).searchParams.get('email')

  let query = admin.from('empleados').select('id, nombre, email, slack_email').eq('activo', true)
  if (testEmail) query = query.eq('email', testEmail)
  const { data: empleados } = await query

  if (!empleados?.length) return NextResponse.json({ ok: true, sent: 0 })

  const { data: tareas } = await admin
    .from('tareas')
    .select('id, nombre, estado, fecha_limite, ids_responsables, id_cliente')
    .neq('estado', 'terminado')
    .order('fecha_limite', { ascending: true })

  if (!tareas?.length) return NextResponse.json({ ok: true, sent: 0, reason: 'no pending tasks' })

  const clienteIds = [...new Set(tareas.map(t => t.id_cliente).filter(Boolean))]
  const { data: clientes } = clienteIds.length
    ? await admin.from('clientes').select('id, nombre').in('id', clienteIds)
    : { data: [] }
  const clienteMap = Object.fromEntries((clientes ?? []).map(c => [c.id, c.nombre as string]))

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  let sent = 0

  for (const emp of empleados) {
    const email = (emp as Record<string, unknown>).slack_email as string || emp.email
    if (!email) continue

    const misTareas = tareas.filter(t =>
      Array.isArray(t.ids_responsables) && t.ids_responsables.includes(emp.id)
    )
    if (!misTareas.length) continue

    const vencidas = misTareas.filter(t => {
      if (!t.fecha_limite) return false
      return new Date(t.fecha_limite + 'T00:00:00') < hoy
    })
    const hoyTareas = misTareas.filter(t => {
      if (!t.fecha_limite) return false
      return new Date(t.fecha_limite + 'T00:00:00').getTime() === hoy.getTime()
    })
    const proximas = misTareas.filter(t => {
      if (!t.fecha_limite) return false
      return new Date(t.fecha_limite + 'T00:00:00') > hoy
    })
    const sinFecha = misTareas.filter(t => !t.fecha_limite)

    const fmtTarea = (t: typeof misTareas[0]) => {
      const cliente = t.id_cliente ? clienteMap[t.id_cliente] : null
      const fecha = t.fecha_limite
        ? new Date(t.fecha_limite + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : null
      const clienteStr = cliente ? ` — ${cliente.toUpperCase()}` : ''
      const fechaStr = fecha ? ` _(${fecha})_` : ''
      return `• <${base}/tareas/vista-global?tarea=${t.id}|${t.nombre}>${clienteStr}${fechaStr}`
    }

    const lineas: string[] = [`🌅 *Buenos días, ${emp.nombre}* — tareas pendientes:`]

    if (vencidas.length) {
      lineas.push(`\n🔴 *Vencidas (${vencidas.length})*`)
      vencidas.forEach(t => lineas.push(fmtTarea(t)))
    }
    if (hoyTareas.length) {
      lineas.push(`\n🟡 *Para hoy (${hoyTareas.length})*`)
      hoyTareas.forEach(t => lineas.push(fmtTarea(t)))
    }
    if (proximas.length) {
      lineas.push(`\n📋 *Próximas (${Math.min(proximas.length, 10)})*`)
      proximas.slice(0, 10).forEach(t => lineas.push(fmtTarea(t)))
    }
    if (sinFecha.length) {
      lineas.push(`\n⏳ *Sin fecha (${sinFecha.length})*`)
      sinFecha.slice(0, 5).forEach(t => lineas.push(fmtTarea(t)))
    }

    try {
      await sendSlackDM(email, lineas.join('\n'))
      sent++
    } catch (e) {
      console.error(`[daily-tasks] error enviando DM a ${emp.nombre}:`, e)
    }
  }

  return NextResponse.json({ ok: true, sent })
}

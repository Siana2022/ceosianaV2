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
  // VERCEL_PROJECT_PRODUCTION_URL es la URL canónica de producción sin https://
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : new URL(req.url).origin
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

  const SLACK_API = 'https://slack.com/api'
  const tok = process.env.SLACK_BOT_TOKEN ?? ''

  async function sendSlackDMDebug(email: string, text: string): Promise<{ ok: boolean; error?: string; userId?: string }> {
    if (!tok) return { ok: false, error: 'no SLACK_BOT_TOKEN' }
    const lookupRes = await fetch(`${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
    const lookupData = await lookupRes.json() as { ok: boolean; user?: { id: string }; error?: string }
    if (!lookupData.ok) return { ok: false, error: `lookupByEmail: ${lookupData.error}` }
    const userId = lookupData.user?.id
    if (!userId) return { ok: false, error: 'no userId' }
    const dmRes = await fetch(`${SLACK_API}/conversations.open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ users: userId }),
    })
    const dmData = await dmRes.json() as { ok: boolean; channel?: { id: string }; error?: string }
    if (!dmData.ok) return { ok: false, error: `conversations.open: ${dmData.error}`, userId }
    const channel = dmData.channel?.id
    if (!channel) return { ok: false, error: 'no channel', userId }
    const msgRes = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ channel, text, unfurl_links: false }),
    })
    const msgData = await msgRes.json() as { ok: boolean; error?: string }
    return msgData.ok ? { ok: true, userId } : { ok: false, error: `postMessage: ${msgData.error}`, userId }
  }

  const log: object[] = []
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  let sent = 0

  for (const emp of empleados) {
    const email = (emp as Record<string, unknown>).slack_email as string || emp.email
    if (!email) continue

    const misTareas = tareas.filter(t =>
      Array.isArray(t.ids_responsables) && t.ids_responsables.includes(emp.id)
    )
    if (!misTareas.length) {
      if (testEmail) log.push({ nombre: emp.nombre, email, ok: false, error: 'sin_tareas_asignadas' })
      continue
    }

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

    const result = await sendSlackDMDebug(email, lineas.join('\n'))
    if (result.ok) sent++
    log.push({ nombre: emp.nombre, email, ...result })
  }

  return NextResponse.json({ ok: true, sent, log: testEmail ? log : undefined })
}

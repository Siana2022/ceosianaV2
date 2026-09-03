import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { sendSlackMessage, verifySlackSignature, slackEmailDeUsuario } from '@/lib/slack'

async function tareasDeEmpleado(email: string): Promise<{ nombre: string; estado: string; cliente: string | null; fechaLimite: string | null; id: string }[]> {
  const admin = createAdminClient()

  // Find empleado by email
  const { data: emp } = await admin.from('empleados').select('id').eq('email', email).maybeSingle()
  if (!emp) return []

  // Get their pending tasks
  const { data: tareas } = await admin
    .from('tareas')
    .select('id, nombre, estado, fecha_limite, id_cliente')
    .contains('ids_responsables', [emp.id])
    .neq('estado', 'terminado')
    .order('fecha_limite', { ascending: true })

  if (!tareas?.length) return []

  // Get client names
  const clienteIds = [...new Set(tareas.map(t => t.id_cliente).filter(Boolean))]
  const { data: clientes } = await admin.from('clientes').select('id, nombre').in('id', clienteIds)
  const clienteMap = Object.fromEntries((clientes ?? []).map(c => [c.id, c.nombre]))

  return tareas.map(t => ({
    id: t.id,
    nombre: t.nombre,
    estado: t.estado,
    cliente: t.id_cliente ? clienteMap[t.id_cliente] ?? null : null,
    fechaLimite: t.fecha_limite,
  }))
}

function formatTareas(tareas: Awaited<ReturnType<typeof tareasDeEmpleado>>, base: string): string {
  if (!tareas.length) return '✅ No tienes tareas pendientes.'

  const bloqueadas = tareas.filter(t => t.estado === 'bloqueada')
  const resto = tareas.filter(t => t.estado !== 'bloqueada')

  const fmtTarea = (t: (typeof tareas)[0]) => {
    const cliente = t.cliente ? ` — ${t.cliente.toUpperCase()}` : ''
    const fecha = t.fechaLimite ? ` _(${new Date(t.fechaLimite).toLocaleDateString('es-ES')})_` : ''
    const link = `<${base}/tareas/vista-global?tarea=${t.id}|${t.nombre}>`
    return `• ${link}${cliente}${fecha}`
  }

  const lines: string[] = []

  if (bloqueadas.length) {
    lines.push(`🔴 *Bloqueadas (${bloqueadas.length})*`)
    lines.push(...bloqueadas.map(fmtTarea))
  }

  if (resto.length) {
    lines.push(`📋 *Pendientes (${resto.length})*`)
    lines.push(...resto.map(fmtTarea))
  }

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  if (!verifySlackSignature(req, body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  // Slack URL verification challenge
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // Acknowledge immediately
  const event = payload.event
  if (!event || event.type !== 'app_mention') {
    return NextResponse.json({ ok: true })
  }

  const base = new URL(req.url).origin
  const userId = event.user as string
  const channel = event.channel as string

  // Check if the message contains an email directly (e.g. "@CEOSIANA juanjo@siana.com")
  const text = (event.text as string) ?? ''
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/)
  const emailFromMessage = emailMatch ? emailMatch[0] : null

  if (emailFromMessage) {
    // Fast path: email in message — process synchronously (fast enough for Slack's 3s limit)
    try {
      const tareas = await tareasDeEmpleado(emailFromMessage)
      await sendSlackMessage(channel, formatTareas(tareas, base))
    } catch (e) {
      console.error('[slack/events]', e)
    }
    return NextResponse.json({ ok: true })
  }

  // Slow path: resolve Slack user ID → email — use waitUntil to respond within 3s
  waitUntil((async () => {
    try {
      const email = await slackEmailDeUsuario(userId)
      if (!email) {
        await sendSlackMessage(channel, `❌ No encuentro tu usuario en Ceosiana.\nEspecifica tu email: \`@CEOSIANA juanjo@sianadigital.com\``)
        return
      }
      const tareas = await tareasDeEmpleado(email)
      await sendSlackMessage(channel, formatTareas(tareas, base))
    } catch (e) {
      console.error('[slack/events]', e)
    }
  })())

  return NextResponse.json({ ok: true })
}

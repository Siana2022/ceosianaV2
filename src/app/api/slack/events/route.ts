import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { sendSlackMessage } from '@/lib/slack'
import crypto from 'crypto'

function verifySignature(req: NextRequest, body: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET ?? ''
  if (!secret) return true
  const ts = req.headers.get('x-slack-request-timestamp') ?? ''
  const sig = req.headers.get('x-slack-signature') ?? ''
  const expected = `v0=${crypto.createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex')}`
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

async function slackEmailDeUsuario(userId: string): Promise<string | null> {
  const tok = process.env.SLACK_BOT_TOKEN ?? ''
  if (!tok) return null
  const res = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  const data = await res.json()
  return data.ok ? (data.user?.profile?.email ?? null) : null
}

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

  if (!verifySignature(req, body)) {
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

  // Respond immediately — Slack requires response within 3s
  waitUntil((async () => {
    try {
      const email = await slackEmailDeUsuario(userId)
      if (!email) {
        await sendSlackMessage(channel, `❌ No encuentro tu usuario en Ceosiana. Asegúrate de que tu email de Slack coincide con el registrado.`)
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

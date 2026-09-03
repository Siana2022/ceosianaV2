import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { verifySlackSignature, slackEmailDeUsuario } from '@/lib/slack'

function parseMinutos(s: string): number | null {
  const cleaned = s.trim().toLowerCase().replace(',', '.')
  const hMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*h/)
  const mMatch = cleaned.match(/(\d+)\s*m(?!in)/)
  if (!hMatch && !mMatch) {
    const bare = parseFloat(cleaned)
    if (!isNaN(bare) && bare > 0) return Math.round(bare * 60)
    return null
  }
  const total = Math.round((parseFloat(hMatch?.[1] ?? '0') * 60) + parseInt(mMatch?.[1] ?? '0'))
  return total > 0 ? total : null
}

type SlackValues = Record<string, Record<string, { selected_option?: { value: string }; value?: string; selected_date?: string }>>

async function procesarFichaje(payload: Record<string, unknown>) {
  const view = payload.view as Record<string, unknown>
  const state = view?.state as Record<string, unknown>
  const vals = state?.values as SlackValues
  const slackUserId = (payload.user as Record<string, string>)?.id

  const clienteId = vals?.blk_cliente?.cliente?.selected_option?.value ?? null
  const deptoId = vals?.blk_depto?.depto?.selected_option?.value ?? null
  const fecha = vals?.blk_fecha?.fecha?.selected_date ?? new Date().toISOString().split('T')[0]
  const tiempoStr = vals?.blk_tiempo?.tiempo?.value ?? ''
  const descripcion = (vals?.blk_descripcion?.descripcion?.value ?? '').trim()
  const minutos = parseMinutos(tiempoStr)

  if (!minutos || !deptoId || !descripcion) {
    console.error('[slack/interactions] validation failed:', { minutos, deptoId, descripcion })
    return
  }

  const email = await slackEmailDeUsuario(slackUserId)
  if (!email) {
    console.error('[slack/interactions] no email for slack user:', slackUserId)
    return
  }

  const admin = createAdminClient()

  const { data: emp } = await admin
    .from('empleados')
    .select('id, nombre')
    .or(`email.eq.${email},slack_email.eq.${email}`)
    .maybeSingle()

  if (!emp) {
    console.error('[slack/interactions] empleado no encontrado para:', email)
    return
  }

  const { data: depto } = await admin
    .from('departamentos').select('nombre').eq('id', deptoId).maybeSingle()

  const { error: insertError } = await admin.from('time_logs').insert({
    id_empleado: emp.id,
    id_cliente: clienteId,
    id_servicio: null,
    id_departamento: deptoId,
    descripcion,
    fecha,
    minutos,
  })

  if (insertError) {
    console.error('[slack/interactions] insert error:', insertError)
    return
  }

  console.log('[slack/interactions] fichaje guardado:', { emp: emp.nombre, depto: depto?.nombre, minutos, fecha })

  // DM confirmation
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  const tiempoFmt = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
  const fechaFmt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

  const tok = process.env.SLACK_BOT_TOKEN ?? ''
  try {
    const dmRes = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ users: slackUserId }),
    })
    const dmData = await dmRes.json()
    if (dmData.ok) {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          channel: dmData.channel.id,
          text: `✅ *Fichaje guardado*\n• ${depto?.nombre ?? 'Servicio'} · ${tiempoFmt} · ${fechaFmt}\n• _${descripcion}_`,
        }),
      })
    }
  } catch (e) {
    console.error('[slack/interactions] DM error:', e)
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  if (!verifySlackSignature(req, body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const params = new URLSearchParams(body)
  const payloadRaw = params.get('payload')
  if (!payloadRaw) return new NextResponse('', { status: 200 })

  const payload = JSON.parse(payloadRaw) as Record<string, unknown>

  if (payload.type !== 'view_submission' || (payload.view as Record<string, unknown>)?.callback_id !== 'fichar_modal') {
    return new NextResponse('', { status: 200 })
  }

  // Responder inmediatamente para cerrar el modal (Slack requiere respuesta en <3s)
  // El resto del trabajo se hace en background
  waitUntil(procesarFichaje(payload))

  return new NextResponse('', { status: 200 })
}

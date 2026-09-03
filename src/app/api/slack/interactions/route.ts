import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { verifySlackSignature, slackEmailDeUsuario } from '@/lib/slack'

function parseMinutos(s: string): number | null {
  const cleaned = s.trim().toLowerCase().replace(',', '.')
  const hMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*h/)
  const mMatch = cleaned.match(/(\d+)\s*m(?!in)/)
  if (!hMatch && !mMatch) {
    // Try bare number as hours (e.g. "2" → 120m)
    const bare = parseFloat(cleaned)
    if (!isNaN(bare) && bare > 0) return Math.round(bare * 60)
    return null
  }
  const total = Math.round((parseFloat(hMatch?.[1] ?? '0') * 60) + parseInt(mMatch?.[1] ?? '0'))
  return total > 0 ? total : null
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  if (!verifySlackSignature(req, body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const params = new URLSearchParams(body)
  const payloadRaw = params.get('payload')
  if (!payloadRaw) return new NextResponse('', { status: 200 })

  const payload = JSON.parse(payloadRaw)

  if (payload.type !== 'view_submission' || payload.view?.callback_id !== 'fichar_modal') {
    return new NextResponse('', { status: 200 })
  }

  const values = payload.view.state.values as Record<
    string,
    Record<string, { selected_option?: { value: string }; value?: string; selected_date?: string }>
  >
  const slackUserId = payload.user?.id as string

  const clienteId = values?.blk_cliente?.cliente?.selected_option?.value ?? null
  const svcId = values?.blk_servicio?.servicio?.selected_option?.value ?? null
  const fecha = values?.blk_fecha?.fecha?.selected_date ?? new Date().toISOString().split('T')[0]
  const tiempoStr = values?.blk_tiempo?.tiempo?.value ?? ''
  const descripcion = (values?.blk_descripcion?.descripcion?.value ?? '').trim()

  // Validate inputs
  const errors: Record<string, string> = {}

  const minutos = parseMinutos(tiempoStr)
  if (!minutos) errors.blk_tiempo = 'Formato no válido. Usa: 45m · 1h30m · 2h · 0.5h'

  if (!svcId) errors.blk_servicio = 'Selecciona un servicio.'

  if (!descripcion) errors.blk_descripcion = 'La descripción es obligatoria.'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ response_action: 'errors', errors })
  }

  const email = await slackEmailDeUsuario(slackUserId)
  if (!email) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { blk_servicio: 'No encontré tu usuario en Ceosiana. Pide al administrador que vincule tu email de Slack.' },
    })
  }

  const admin = createAdminClient()

  const { data: emp } = await admin
    .from('empleados')
    .select('id, nombre')
    .eq('email', email)
    .maybeSingle()

  if (!emp) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { blk_servicio: `Email ${email} no registrado en Ceosiana.` },
    })
  }

  // Get servicio details (to resolve id_departamento)
  const { data: svc } = await admin
    .from('servicios')
    .select('nombre, id_departamento')
    .eq('id', svcId)
    .maybeSingle()

  const { error: insertError } = await admin.from('time_logs').insert({
    id_empleado: emp.id,
    id_cliente: clienteId,
    id_servicio: svcId,
    id_departamento: svc?.id_departamento ?? null,
    descripcion,
    fecha,
    minutos: minutos!,
  })

  if (insertError) {
    console.error('[slack/interactions] insert error:', insertError)
    return NextResponse.json({
      response_action: 'errors',
      errors: { blk_tiempo: 'Error guardando el fichaje. Intenta de nuevo.' },
    })
  }

  // DM confirmation
  const h = Math.floor(minutos! / 60)
  const m = minutos! % 60
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
          text: `✅ *Fichaje guardado*\n• ${svc?.nombre ?? 'Servicio'} · ${tiempoFmt} · ${fechaFmt}\n• _${descripcion}_`,
        }),
      })
    }
  } catch (e) {
    console.error('[slack/interactions] DM error:', e)
  }

  // Close modal
  return new NextResponse('', { status: 200 })
}

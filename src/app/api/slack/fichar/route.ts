import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { verifySlackSignature } from '@/lib/slack'

type Cliente = { id: string; nombre: string }
type Servicio = { id: string; nombre: string; id_cliente: string | null }

function buildFicharModal(clientes: Cliente[], servicios: Servicio[]) {
  const today = new Date().toISOString().split('T')[0]

  const clienteOptions = clientes
    .filter(c => c.id && c.nombre)
    .map(c => ({
      text: { type: 'plain_text', text: (c.nombre ?? '').slice(0, 75) },
      value: c.id,
    }))

  const servicioOptions = servicios
    .filter(s => s.id && s.nombre)
    .map(s => ({
      text: { type: 'plain_text', text: (s.nombre ?? '').slice(0, 75) },
      value: s.id,
    }))

  return {
    type: 'modal',
    callback_id: 'fichar_modal',
    title: { type: 'plain_text', text: 'Fichar horas' },
    submit: { type: 'plain_text', text: 'Guardar' },
    close: { type: 'plain_text', text: 'Cancelar' },
    blocks: [
      {
        type: 'input',
        block_id: 'blk_cliente',
        label: { type: 'plain_text', text: 'Cliente' },
        element: {
          type: 'static_select',
          action_id: 'cliente',
          placeholder: { type: 'plain_text', text: 'Selecciona cliente...' },
          options: clienteOptions,
        },
      },
      {
        type: 'input',
        block_id: 'blk_servicio',
        label: { type: 'plain_text', text: 'Servicio' },
        element: {
          type: 'static_select',
          action_id: 'servicio',
          placeholder: { type: 'plain_text', text: 'Selecciona servicio...' },
          options: servicioOptions,
        },
      },
      {
        type: 'input',
        block_id: 'blk_fecha',
        label: { type: 'plain_text', text: 'Fecha' },
        element: {
          type: 'datepicker',
          action_id: 'fecha',
          initial_date: today,
        },
      },
      {
        type: 'input',
        block_id: 'blk_tiempo',
        label: { type: 'plain_text', text: 'Tiempo' },
        hint: { type: 'plain_text', text: 'Ejemplos: 45m · 1h30m · 2h · 0.5h' },
        element: {
          type: 'plain_text_input',
          action_id: 'tiempo',
          placeholder: { type: 'plain_text', text: 'ej: 1h30m' },
        },
      },
      {
        type: 'input',
        block_id: 'blk_descripcion',
        label: { type: 'plain_text', text: 'Descripción' },
        element: {
          type: 'plain_text_input',
          action_id: 'descripcion',
          placeholder: { type: 'plain_text', text: 'Qué has hecho' },
          multiline: true,
        },
      },
    ],
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  if (!verifySlackSignature(req, body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const params = new URLSearchParams(body)
  const triggerId = params.get('trigger_id')
  if (!triggerId) return new NextResponse('', { status: 200 })

  const tok = process.env.SLACK_BOT_TOKEN ?? ''

  try {
    const admin = createAdminClient()

    const [{ data: clientes, error: eC }, { data: servicios, error: eS }] = await Promise.all([
      admin.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
      admin.from('servicios').select('id, nombre, id_cliente').eq('activo', true).order('nombre'),
    ])

    if (eC) console.error('[slack/fichar] clientes error:', eC)
    if (eS) console.error('[slack/fichar] servicios error:', eS)

    const modal = buildFicharModal(clientes ?? [], servicios ?? [])

    const res = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ trigger_id: triggerId, view: modal }),
    })
    const data = await res.json()
    if (!data.ok) console.error('[slack/fichar] views.open error:', data.error, JSON.stringify(data))
  } catch (e) {
    console.error('[slack/fichar] handler error:', e)
  }

  return new NextResponse('', { status: 200 })
}

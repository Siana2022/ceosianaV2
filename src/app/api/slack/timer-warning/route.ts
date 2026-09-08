import { NextRequest, NextResponse } from 'next/server'
import { sendSlackDM } from '@/lib/slack'

const NOTIFY_EMAILS = ['juanjo@sianadigital.com', 'anaissoriagarrido@gmail.com']

export async function POST(req: NextRequest) {
  try {
    const { empNombre, elapsedMins, descripcion } = await req.json() as {
      empNombre: string
      elapsedMins: number
      descripcion: string
    }
    const h = Math.floor(elapsedMins / 60)
    const m = elapsedMins % 60
    const label = h > 0 ? `${h}h ${m}m` : `${m}m`
    const msg = `⚠️ Timer sin cerrar — *${empNombre}* lleva *${label}* fichando en _"${descripcion}"_. Es posible que se haya olvidado de pararlo.`
    await Promise.all(NOTIFY_EMAILS.map(email => sendSlackDM(email, msg)))
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[timer-warning]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

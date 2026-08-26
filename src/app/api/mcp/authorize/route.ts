import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const redirectUri = searchParams.get('redirect_uri') ?? ''
  const state = searchParams.get('state') ?? ''
  const clientId = searchParams.get('client_id') ?? ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ceosiana — Autorizar acceso</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e5e5e5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 40px 32px; max-width: 400px; width: 100%; text-align: center }
    .logo { font-size: 32px; font-weight: 700; letter-spacing: -1px; margin-bottom: 8px; color: #fff }
    .subtitle { color: #888; font-size: 14px; margin-bottom: 32px }
    .desc { font-size: 14px; color: #bbb; margin-bottom: 28px; line-height: 1.5 }
    .scopes { background: #111; border-radius: 8px; padding: 16px; margin-bottom: 28px; text-align: left }
    .scope { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #ccc; padding: 4px 0 }
    .scope::before { content: "✓"; color: #4ade80; font-weight: 600 }
    .btn { width: 100%; padding: 12px; background: #fff; color: #000; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer }
    .btn:hover { background: #e5e5e5 }
    .client { font-size: 12px; color: #555; margin-top: 16px }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Ceosiana</div>
    <div class="subtitle">Siana Digital</div>
    <div class="desc">Claude quiere acceder a tu información de Ceosiana para responder preguntas sobre tareas, clientes y rentabilidad.</div>
    <div class="scopes">
      <div class="scope">Ver tus tareas pendientes</div>
      <div class="scope">Ver clientes y empleados</div>
      <div class="scope">Consultar rentabilidad</div>
      <div class="scope">Buscar tareas</div>
    </div>
    <form method="POST" action="/api/mcp/authorize">
      <input type="hidden" name="redirect_uri" value="${redirectUri}">
      <input type="hidden" name="state" value="${state}">
      <input type="hidden" name="client_id" value="${clientId}">
      <button type="submit" class="btn">Permitir acceso</button>
    </form>
    <div class="client">Solo visible para miembros de Siana Digital</div>
  </div>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const redirectUri = body.get('redirect_uri') as string ?? ''
  const state = body.get('state') as string ?? ''

  const code = crypto.randomBytes(16).toString('hex')

  const url = new URL(redirectUri)
  url.searchParams.set('code', code)
  if (state) url.searchParams.set('state', state)

  return NextResponse.redirect(url.toString(), { status: 302 })
}

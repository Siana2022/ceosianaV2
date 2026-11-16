import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getPerfil } from '@/lib/server/perfil'
import {
  metadata,
  registrarCliente,
  crearPkce,
  estadoAleatorio,
  urlAutorizacion,
} from '@/lib/server/mcpGoogle'

// GET /api/hub/mcp/connect — inicia el OAuth contra el servidor MCP de Google Ads
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin

  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') {
    return NextResponse.redirect(`${origin}/hub?google=sin_permiso`)
  }

  const redirectUri = `${origin}/api/hub/mcp/callback`

  try {
    const meta = await metadata()
    // Si hay un client_id previamente registrado en el servidor MCP, se usa ese
    // (el servidor puede tener una lista de clientes permitidos).
    const clientIdFijo = process.env.GOOGLE_ADS_MCP_CLIENT_ID
    const clientId = clientIdFijo || await registrarCliente(redirectUri)
    const { verifier, challenge } = crearPkce()
    const state = estadoAleatorio()

    const cookieStore = await cookies()
    cookieStore.set(
      'mcp_oauth',
      JSON.stringify({
        clientId,
        verifier,
        state,
        redirectUri,
        tokenEndpoint: meta.token_endpoint,
        authorizationEndpoint: meta.authorization_endpoint,
      }),
      {
        httpOnly: true,
        path: '/',
        maxAge: 600,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    )

    return NextResponse.redirect(
      urlAutorizacion({
        authorizationEndpoint: meta.authorization_endpoint,
        clientId,
        redirectUri,
        state,
        challenge,
      }),
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al iniciar la conexión'
    return NextResponse.redirect(`${origin}/hub?google=error&msg=${encodeURIComponent(msg)}`)
  }
}

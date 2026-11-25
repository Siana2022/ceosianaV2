import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPerfil } from '@/lib/server/perfil'
import { urlAutorizacion } from '@/lib/server/ga4'

// GET /api/hub/ga4/connect — inicia la autorización con Google Analytics
export async function GET(req: NextRequest) {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') {
    return NextResponse.redirect(new URL('/hub', req.url))
  }

  const origin = new URL(req.url).origin
  const redirectUri = `${origin}/api/hub/ga4/callback`
  const state = crypto.randomBytes(12).toString('hex')

  const res = NextResponse.redirect(urlAutorizacion(redirectUri, state))
  res.cookies.set('ga4_state', state, { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), maxAge: 600, path: '/' })
  return res
}

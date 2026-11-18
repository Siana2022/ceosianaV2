import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

// Solo estos dominios: imágenes de creatividades de Google y miniaturas de YouTube.
const PERMITIDOS = new Set([
  'tpc.googlesyndication.com',
  'lh3.googleusercontent.com',
  'i.ytimg.com',
  'img.youtube.com',
])

// GET /api/hub/imagen?url=<encoded> — proxy para que el artefacto pueda leer
// las imágenes de Google sin problemas de CORS. Solo usuarios con sesión.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('No autorizado', { status: 401 })

  const raw = new URL(req.url).searchParams.get('url')
  if (!raw) return new NextResponse('url requerida', { status: 400 })

  let destino: URL
  try {
    destino = new URL(raw)
  } catch {
    return new NextResponse('url inválida', { status: 400 })
  }

  if (destino.protocol !== 'https:' || !PERMITIDOS.has(destino.hostname)) {
    return new NextResponse('dominio no permitido', { status: 403 })
  }

  try {
    const res = await fetch(destino.toString(), {
      headers: { 'User-Agent': 'ceosiana-hub/1.0', Accept: 'image/*' },
      cache: 'no-store',
    })
    if (!res.ok) return new NextResponse(`origen ${res.status}`, { status: 502 })

    const tipo = res.headers.get('content-type') ?? 'image/jpeg'
    if (!tipo.startsWith('image/')) return new NextResponse('no es una imagen', { status: 415 })

    const datos = await res.arrayBuffer()
    return new NextResponse(datos, {
      status: 200,
      headers: {
        'Content-Type': tipo,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Content-Length': String(datos.byteLength),
      },
    })
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : 'error', { status: 502 })
  }
}

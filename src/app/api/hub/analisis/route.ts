import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

// Modelos por nivel. Se pueden sobrescribir por entorno sin tocar código.
const MODELO_DEFECTO = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'
const MODELO_HAIKU = process.env.ANTHROPIC_MODEL_HAIKU || 'claude-haiku-4-5'
const MODELO_OPUS = process.env.ANTHROPIC_MODEL_OPUS || 'claude-opus-4-1'

const MAX_IMAGENES = 8
const MAX_BYTES_TOTAL = 8 * 1024 * 1024

function elegirModelo(tier: string | null | undefined): string {
  const t = (tier ?? '').toLowerCase()
  if (t.includes('haiku')) return MODELO_HAIKU
  if (t.includes('opus')) return MODELO_OPUS
  return MODELO_DEFECTO
}

interface ImagenEntrada {
  media_type?: string
  data?: string
}

// Extrae el primer objeto/array JSON del texto, aunque venga con ```json
function parsearJson(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(limpio)
  } catch {
    const inicio = Math.min(
      ...[limpio.indexOf('{'), limpio.indexOf('[')].filter(i => i >= 0),
    )
    if (!Number.isFinite(inicio)) throw new Error('La respuesta no contiene JSON')
    const cierre = limpio.lastIndexOf(limpio[inicio] === '{' ? '}' : ']')
    if (cierre <= inicio) throw new Error('JSON incompleto en la respuesta')
    return JSON.parse(limpio.slice(inicio, cierre + 1))
  }
}

// POST /api/hub/analisis — puerta única de IA del hub
// Body: { prompt: string, images?: [{media_type, data}], modelTier?: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Falta configurar ANTHROPIC_API_KEY en el servidor' },
      { status: 500 },
    )
  }

  let body: { prompt?: string; images?: ImagenEntrada[]; modelTier?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const prompt = (body.prompt ?? '').trim()
  if (!prompt) return NextResponse.json({ error: 'El prompt es obligatorio' }, { status: 400 })

  const imagenes = (body.images ?? []).slice(0, MAX_IMAGENES)
  let bytes = 0
  for (const img of imagenes) {
    if (!img?.data) return NextResponse.json({ error: 'Imagen sin datos' }, { status: 400 })
    bytes += Math.floor((img.data.length * 3) / 4)
  }
  if (bytes > MAX_BYTES_TOTAL) {
    return NextResponse.json({ error: 'Las imágenes superan el tamaño máximo' }, { status: 413 })
  }

  const contenido: unknown[] = imagenes.map(img => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.media_type || 'image/jpeg',
      data: img.data,
    },
  }))
  contenido.push({ type: 'text', text: prompt })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: elegirModelo(body.modelTier),
        max_tokens: 3000,
        system: 'Devuelve siempre JSON válido, sin texto adicional ni bloques de código. Sigue exactamente el esquema que pida el usuario.',
        messages: [{ role: 'user', content: contenido }],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      const msg = (data as { error?: { message?: string } })?.error?.message ?? `Error ${res.status}`
      return NextResponse.json({ error: `Anthropic: ${msg}` }, { status: 502 })
    }

    const texto = (data as { content?: { type: string; text?: string }[] })?.content
      ?.filter(c => c.type === 'text')
      .map(c => c.text ?? '')
      .join('\n') ?? ''

    if (!texto.trim()) return NextResponse.json({ error: 'Respuesta vacía del modelo' }, { status: 502 })

    return NextResponse.json({ result: parsearJson(texto) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al llamar al modelo' },
      { status: 500 },
    )
  }
}

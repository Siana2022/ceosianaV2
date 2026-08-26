import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'

// ── Auth ──────────────────────────────────────────────────────────────────────
function checkAuth(req: NextRequest): boolean {
  const key = process.env.CEOSIANA_MCP_KEY
  if (!key) return true // no key configured = open (dev only)
  const authHeader = req.headers.get('authorization') ?? ''
  const queryKey = new URL(req.url).searchParams.get('key') ?? ''
  return authHeader === `Bearer ${key}` || queryKey === key
}

// ── CORS headers ──────────────────────────────────────────────────────────────
function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id')
  return res
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

// ── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'get_mis_tareas',
    description: 'Obtiene las tareas pendientes de un empleado de Ceosiana. Útil para responder "¿qué tareas tengo?" o "¿qué tareas tiene [nombre]?"',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email del empleado, ej: juanjo@sianadigital.com' },
      },
      required: ['email'],
    },
  },
  {
    name: 'get_clientes',
    description: 'Lista todos los clientes de Ceosiana con su información básica',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_empleados',
    description: 'Lista todos los empleados de Ceosiana con su email y departamento',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'buscar_tarea',
    description: 'Busca tareas en Ceosiana por nombre o palabras clave',
    inputSchema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Texto a buscar en el nombre de la tarea' },
        solo_pendientes: { type: 'boolean', description: 'Si true, solo devuelve tareas no terminadas. Default: true' },
      },
      required: ['texto'],
    },
  },
  {
    name: 'get_rentabilidad',
    description: 'Obtiene la facturación por cliente de Ceosiana para un año concreto',
    inputSchema: {
      type: 'object',
      properties: {
        anio: { type: 'number', description: 'Año a consultar, ej: 2025' },
      },
      required: ['anio'],
    },
  },
]

// ── Tool handlers ─────────────────────────────────────────────────────────────
async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const admin = createAdminClient()

  if (name === 'get_mis_tareas') {
    const email = args.email as string
    const { data: emp } = await admin.from('empleados').select('id, nombre').eq('email', email).maybeSingle()
    if (!emp) return `No se encontró ningún empleado con email ${email}`

    const { data: tareas } = await admin
      .from('tareas')
      .select('id, nombre, estado, fecha_limite, id_cliente, descripcion')
      .contains('ids_responsables', [emp.id])
      .neq('estado', 'terminado')
      .order('fecha_limite', { ascending: true })

    if (!tareas?.length) return `${emp.nombre} no tiene tareas pendientes.`

    const clienteIds = [...new Set(tareas.map(t => t.id_cliente).filter(Boolean))]
    const { data: clientes } = await admin.from('clientes').select('id, nombre').in('id', clienteIds)
    const clienteMap = Object.fromEntries((clientes ?? []).map(c => [c.id, c.nombre]))

    const fmt = (t: typeof tareas[0]) => {
      const cliente = t.id_cliente ? ` [${clienteMap[t.id_cliente] ?? ''}]` : ''
      const fecha = t.fecha_limite ? ` — vence ${new Date(t.fecha_limite).toLocaleDateString('es-ES')}` : ''
      const desc = t.descripcion?.trim() ? `\n   ${t.descripcion.trim()}` : ''
      return `• ${t.nombre}${cliente}${fecha}${desc}`
    }

    const bloqueadas = tareas.filter(t => t.estado === 'bloqueada')
    const resto = tareas.filter(t => t.estado !== 'bloqueada')
    const lines: string[] = [`Tareas de ${emp.nombre}:`]
    if (bloqueadas.length) { lines.push(`\n🔴 Bloqueadas (${bloqueadas.length})`); bloqueadas.forEach(t => lines.push(fmt(t))) }
    if (resto.length) { lines.push(`\n📋 Pendientes (${resto.length})`); resto.forEach(t => lines.push(fmt(t))) }
    return lines.join('\n')
  }

  if (name === 'get_clientes') {
    const { data } = await admin.from('clientes').select('nombre, sector, slack_canal').order('nombre')
    if (!data?.length) return 'No hay clientes.'
    const lines = data.map(c => `• ${c.nombre}${c.sector ? ` (${c.sector})` : ''}${c.slack_canal ? ` — Slack: #${c.slack_canal}` : ''}`)
    return `Clientes (${data.length}):\n${lines.join('\n')}`
  }

  if (name === 'get_empleados') {
    const { data } = await admin
      .from('empleados')
      .select('nombre, email, departamentos(nombre)')
      .order('nombre')
    if (!data?.length) return 'No hay empleados.'
    type EmpRow = { nombre: string; email: string; departamentos: unknown }
    const lines = (data as unknown as EmpRow[]).map(e => {
      const dep = (e.departamentos as { nombre: string } | null)?.nombre ?? '—'
      return `• ${e.nombre} <${e.email}> — ${dep}`
    })
    return `Empleados (${data.length}):\n${lines.join('\n')}`
  }

  if (name === 'buscar_tarea') {
    const texto = args.texto as string
    const soloPendientes = args.solo_pendientes !== false

    let query = admin
      .from('tareas')
      .select('nombre, estado, fecha_limite, id_cliente, ids_responsables')
      .ilike('nombre', `%${texto}%`)
      .order('fecha_limite', { ascending: true })
      .limit(20)
    if (soloPendientes) query = query.neq('estado', 'terminado')

    const { data: tareas } = await query
    if (!tareas?.length) return `No se encontraron tareas con "${texto}"`

    const clienteIds = [...new Set(tareas.map(t => t.id_cliente).filter(Boolean))]
    const { data: clientes } = await admin.from('clientes').select('id, nombre').in('id', clienteIds)
    const clienteMap = Object.fromEntries((clientes ?? []).map(c => [c.id, c.nombre]))

    const respIds = [...new Set(tareas.flatMap(t => (t.ids_responsables as string[]) ?? []))]
    const { data: emps } = await admin.from('empleados').select('id, nombre').in('id', respIds)
    const empMap = Object.fromEntries((emps ?? []).map(e => [e.id, e.nombre]))

    const lines = tareas.map(t => {
      const cliente = t.id_cliente ? ` [${clienteMap[t.id_cliente] ?? ''}]` : ''
      const fecha = t.fecha_limite ? ` — ${new Date(t.fecha_limite).toLocaleDateString('es-ES')}` : ''
      const resp = ((t.ids_responsables as string[]) ?? []).map(id => empMap[id] ?? id).join(', ')
      const estado = t.estado === 'bloqueada' ? ' 🔴' : t.estado === 'terminado' ? ' ✅' : ''
      return `• ${t.nombre}${cliente}${fecha}${estado}${resp ? ` (${resp})` : ''}`
    })
    return `Resultados para "${texto}" (${tareas.length}):\n${lines.join('\n')}`
  }

  if (name === 'get_rentabilidad') {
    const anio = args.anio as number
    const { data: facturas } = await admin
      .from('facturas')
      .select('id_cliente, importe, clientes(nombre)')
      .gte('fecha', `${anio}-01-01`)
      .lte('fecha', `${anio}-12-31`)

    if (!facturas?.length) return `No hay facturas en ${anio}`

    const porCliente: Record<string, number> = {}
    type FactRow = { id_cliente: string; importe: number; clientes: { nombre: string } | null }
    for (const f of facturas as unknown as FactRow[]) {
      const nombre = f.clientes?.nombre ?? f.id_cliente
      porCliente[nombre] = (porCliente[nombre] ?? 0) + (f.importe ?? 0)
    }

    const total = Object.values(porCliente).reduce((a, b) => a + b, 0)
    const sorted = Object.entries(porCliente).sort((a, b) => b[1] - a[1])
    const lines = sorted.map(([nombre, importe]) =>
      `• ${nombre}: ${importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
    )
    return `Facturación ${anio}:\n${lines.join('\n')}\n\nTotal: ${total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
  }

  return `Tool "${name}" not implemented`
}

// ── JSON-RPC handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await req.json() as { jsonrpc: string; method: string; params?: Record<string, unknown>; id?: number | string }
  const { method, params, id } = body

  const ok = (result: unknown) => cors(NextResponse.json({ jsonrpc: '2.0', result, id }))
  const err = (code: number, message: string) => cors(NextResponse.json({ jsonrpc: '2.0', error: { code, message }, id }))

  if (method === 'initialize') {
    return ok({
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'ceosiana', version: '1.0.0' },
    })
  }

  if (method === 'notifications/initialized') {
    return cors(new NextResponse(null, { status: 204 }))
  }

  if (method === 'tools/list') {
    return ok({ tools: TOOLS })
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params as { name: string; arguments: Record<string, unknown> }
    try {
      const text = await callTool(name, toolArgs ?? {})
      return ok({ content: [{ type: 'text', text }] })
    } catch (e) {
      return err(-32603, String(e))
    }
  }

  return err(-32601, `Method not found: ${method}`)
}

export async function GET() {
  return cors(NextResponse.json({ name: 'ceosiana-mcp', version: '1.0.0', status: 'ok' }))
}

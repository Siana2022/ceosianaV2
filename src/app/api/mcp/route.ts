import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getDedicacionCalculada } from '@/lib/server/dedicacionCalculada'

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
  {
    name: 'get_fichajes',
    description: 'Consulta los fichajes (time logs) de un empleado o de todo el equipo en un rango de fechas. Útil para ver cuánto tiempo se ha trabajado en qué.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email del empleado (opcional; si no se indica, devuelve todos)' },
        desde: { type: 'string', description: 'Fecha inicio en formato YYYY-MM-DD' },
        hasta: { type: 'string', description: 'Fecha fin en formato YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_procesos',
    description: 'Lista los procesos activos de Ceosiana con sus fases y estado',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_dedicacion',
    description: 'Muestra el % de dedicación de cada empleado por departamento, calculado a partir de los fichajes',
    inputSchema: {
      type: 'object',
      properties: {
        anio: { type: 'number', description: 'Año, ej: 2026' },
        mes: { type: 'number', description: 'Mes (1-12). Si no se indica, devuelve el año completo acumulado' },
      },
      required: ['anio'],
    },
  },
  {
    name: 'get_comercial',
    description: 'Muestra el pipeline comercial: captaciones de clientes, quién captó a quién y quién lo mantiene',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_costes',
    description: 'Muestra los costes de la empresa: sueldos, gastos fijos y costes directos por cliente para un año',
    inputSchema: {
      type: 'object',
      properties: {
        anio: { type: 'number', description: 'Año a consultar, ej: 2026' },
      },
      required: ['anio'],
    },
  },
  {
    name: 'get_equipo_resumen',
    description: 'Resumen del equipo: empleados activos, sus departamentos, horas fichadas este mes y tareas pendientes',
    inputSchema: { type: 'object', properties: {} },
  },
]

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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
    const { data: ingresos } = await admin
      .from('ingresos')
      .select('id_cliente, valor, clientes(nombre)')
      .eq('anio', anio)

    if (!ingresos?.length) return `No hay ingresos registrados en ${anio}`

    const porCliente: Record<string, number> = {}
    type IngRow = { id_cliente: string; valor: number; clientes: { nombre: string } | null }
    for (const r of ingresos as unknown as IngRow[]) {
      const nombre = r.clientes?.nombre ?? r.id_cliente
      porCliente[nombre] = (porCliente[nombre] ?? 0) + (r.valor ?? 0)
    }

    const total = Object.values(porCliente).reduce((a, b) => a + b, 0)
    const sorted = Object.entries(porCliente).sort((a, b) => b[1] - a[1])
    const lines = sorted.map(([nombre, valor]) =>
      `• ${nombre}: ${valor.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
    )
    return `Ingresos ${anio}:\n${lines.join('\n')}\n\nTotal: ${total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
  }

  if (name === 'get_fichajes') {
    const desde = args.desde as string | undefined
    const hasta = args.hasta as string | undefined
    const email = args.email as string | undefined

    let empId: string | null = null
    let empNombre = 'Todo el equipo'
    if (email) {
      const { data: emp } = await admin.from('empleados').select('id, nombre').eq('email', email).maybeSingle()
      if (!emp) return `No se encontró empleado con email ${email}`
      empId = emp.id
      empNombre = emp.nombre
    }

    let query = admin
      .from('time_logs')
      .select('id_empleado, id_cliente, id_departamento, descripcion, fecha, hora_inicio, hora_fin, minutos, empleado:id_empleado(nombre), cliente:id_cliente(nombre), departamento:id_departamento(nombre)')
      .order('fecha', { ascending: false })
      .limit(100)

    if (empId) query = query.eq('id_empleado', empId)
    if (desde) query = query.gte('fecha', desde)
    if (hasta) query = query.lte('fecha', hasta)

    const { data: logs } = await query
    if (!logs?.length) return `Sin fichajes para ${empNombre}${desde ? ` desde ${desde}` : ''}`

    type LogRow = { id_empleado: string; descripcion: string | null; fecha: string; minutos: number | null; empleado: { nombre: string } | null; cliente: { nombre: string } | null; departamento: { nombre: string } | null }
    const totalMin = (logs as unknown as LogRow[]).reduce((s, l) => s + (l.minutos ?? 0), 0)
    const lines = (logs as unknown as LogRow[]).map(l => {
      const h = Math.floor((l.minutos ?? 0) / 60)
      const m = (l.minutos ?? 0) % 60
      const duracion = `${h}h${m > 0 ? `${m}m` : ''}`
      const cliente = l.cliente?.nombre ? ` [${l.cliente.nombre}]` : ''
      const dep = l.departamento?.nombre ? ` (${l.departamento.nombre})` : ''
      const quien = email ? '' : ` — ${l.empleado?.nombre ?? ''}`
      return `• ${l.fecha}${quien}${cliente}${dep}: ${l.descripcion ?? '—'} (${duracion})`
    })
    const totalH = Math.floor(totalMin / 60)
    const totalM = totalMin % 60
    return `Fichajes de ${empNombre}:\nTotal: ${totalH}h${totalM > 0 ? `${totalM}m` : ''}\n\n${lines.join('\n')}`
  }

  if (name === 'get_procesos') {
    const { data: procesos } = await admin
      .from('procesos')
      .select('id, nombre, estado, id_cliente, descripcion, clientes(nombre)')
      .order('created_at', { ascending: false })

    if (!procesos?.length) return 'No hay procesos.'
    type ProcRow = { nombre: string; estado: string; descripcion: string | null; clientes: { nombre: string } | null }
    const lines = (procesos as unknown as ProcRow[]).map(p => {
      const cliente = p.clientes?.nombre ? ` [${p.clientes.nombre}]` : ''
      const desc = p.descripcion?.trim() ? `\n   ${p.descripcion.trim()}` : ''
      return `• ${p.nombre}${cliente} — ${p.estado}${desc}`
    })
    return `Procesos (${procesos.length}):\n${lines.join('\n')}`
  }

  if (name === 'get_dedicacion') {
    const anio = args.anio as number
    const mes = args.mes as number | undefined
    const rows = await getDedicacionCalculada(admin, { anio, mes })

    if (!rows.length) return `Sin datos de dedicación para ${mes ? `${mes}/${anio}` : anio}`

    const empIds = [...new Set(rows.map(r => r.id_empleado))]
    const depIds = [...new Set(rows.map(r => r.id_departamento))]
    const { data: emps } = await admin.from('empleados').select('id, nombre').in('id', empIds)
    const { data: deps } = await admin.from('departamentos').select('id, nombre').in('id', depIds)
    const empMap = Object.fromEntries((emps ?? []).map(e => [e.id, e.nombre]))
    const depMap = Object.fromEntries((deps ?? []).map(d => [d.id, d.nombre]))

    const porEmp: Record<string, string[]> = {}
    for (const r of rows) {
      const emp = empMap[r.id_empleado] ?? r.id_empleado
      const dep = depMap[r.id_departamento] ?? r.id_departamento
      if (!porEmp[emp]) porEmp[emp] = []
      porEmp[emp].push(`  ${dep}: ${r.porcentaje.toFixed(1)}%`)
    }

    const lines = Object.entries(porEmp).map(([emp, deps]) => `${emp}:\n${deps.join('\n')}`)
    return `Dedicación ${mes ? `${mes}/${anio}` : anio}:\n\n${lines.join('\n\n')}`
  }

  if (name === 'get_comercial') {
    const { data } = await admin
      .from('captacion_clientes')
      .select('*, captador:id_captador(nombre), mantenedor:id_mantenedor(nombre), cliente:id_cliente(nombre)')
      .order('fecha_captacion', { ascending: false })

    if (!data?.length) return 'Sin datos comerciales.'
    type CapRow = { captador: { nombre: string } | null; mantenedor: { nombre: string } | null; cliente: { nombre: string } | null; fecha_captacion: string | null; estado: string | null; importe_captacion: number | null }
    const lines = (data as unknown as CapRow[]).map(r => {
      const captador = r.captador?.nombre ?? '—'
      const mantenedor = r.mantenedor?.nombre ?? '—'
      const cliente = r.cliente?.nombre ?? '—'
      const fecha = r.fecha_captacion ? ` (${r.fecha_captacion.slice(0, 7)})` : ''
      const importe = r.importe_captacion ? ` — ${r.importe_captacion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` : ''
      return `• ${cliente}${fecha}: captado por ${captador}, mantiene ${mantenedor}${importe}`
    })
    return `Pipeline comercial (${data.length} clientes):\n${lines.join('\n')}`
  }

  if (name === 'get_costes') {
    const anio = args.anio as number

    const [{ data: sueldos }, { data: gastos }] = await Promise.all([
      admin.from('sueldos').select('id_empleado, coste_total, mes, anio').eq('anio', anio),
      admin.from('gastos_fijos').select('concepto, importe, mes, anio, cliente:id_cliente(nombre)').eq('anio', anio),
    ])

    const totalSueldos = (sueldos ?? []).reduce((s, r) => s + (r.coste_total ?? 0), 0)
    const totalGastos = (gastos ?? []).reduce((s, r: { importe: number }) => s + (r.importe ?? 0), 0)

    const lines: string[] = [`Costes ${anio}:`]
    lines.push(`\n💰 Sueldos totales: ${totalSueldos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`)
    lines.push(`🏢 Gastos fijos totales: ${totalGastos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`)
    lines.push(`📊 Total costes: ${(totalSueldos + totalGastos).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`)

    if (gastos?.length) {
      type GastoRow = { concepto: string | null; importe: number; cliente: { nombre: string } | null }
      const gastosLineas = (gastos as unknown as GastoRow[])
        .map(g => `  • ${g.concepto ?? '—'}${g.cliente?.nombre ? ` [${g.cliente.nombre}]` : ''}: ${g.importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`)
      lines.push(`\nDetalle gastos fijos:\n${gastosLineas.join('\n')}`)
    }

    return lines.join('\n')
  }

  if (name === 'get_equipo_resumen') {
    const hoy = new Date()
    const mesActual = hoy.getMonth() + 1
    const anioActual = hoy.getFullYear()
    const desde = `${anioActual}-${String(mesActual).padStart(2, '0')}-01`

    const [{ data: emps }, { data: logs }, { data: tareas }] = await Promise.all([
      admin.from('empleados').select('id, nombre, email, departamentos(nombre)').order('nombre'),
      admin.from('time_logs').select('id_empleado, minutos').gte('fecha', desde),
      admin.from('tareas').select('ids_responsables, estado').neq('estado', 'terminado'),
    ])

    if (!emps?.length) return 'Sin empleados.'

    const minutosPorEmp: Record<string, number> = {}
    for (const l of logs ?? []) {
      minutosPorEmp[l.id_empleado] = (minutosPorEmp[l.id_empleado] ?? 0) + (l.minutos ?? 0)
    }
    const tareasPorEmp: Record<string, number> = {}
    for (const t of tareas ?? []) {
      for (const id of (t.ids_responsables as string[]) ?? []) {
        tareasPorEmp[id] = (tareasPorEmp[id] ?? 0) + 1
      }
    }

    type EmpRow = { id: string; nombre: string; email: string; departamentos: { nombre: string } | null }
    const lines = (emps as unknown as EmpRow[]).map(e => {
      const dep = e.departamentos?.nombre ?? '—'
      const min = minutosPorEmp[e.id] ?? 0
      const h = Math.floor(min / 60)
      const m = min % 60
      const horas = min > 0 ? ` | ${h}h${m > 0 ? `${m}m` : ''} este mes` : ''
      const numTareas = tareasPorEmp[e.id] ?? 0
      const tareasStr = numTareas > 0 ? ` | ${numTareas} tareas pendientes` : ''
      return `• ${e.nombre} (${dep})${horas}${tareasStr}`
    })

    return `Equipo — ${MESES[mesActual - 1]} ${anioActual}:\n${lines.join('\n')}`
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

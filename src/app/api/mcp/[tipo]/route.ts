import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { verificarLlave, type LlaveMCP, type TipoLlave } from '@/lib/server/mcpAuth'
import { llamarHerramienta } from '@/lib/server/mcpGoogle'

export const dynamic = 'force-dynamic'

interface Peticion {
  jsonrpc: '2.0'
  id?: number | string | null
  method: string
  params?: Record<string, unknown>
}

const HERRAMIENTAS = [
  {
    name: 'mis_tareas',
    description: 'Tareas abiertas asignadas a mí, ordenadas por fecha límite.',
    nivel: 2,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tareas_cliente',
    description: 'Tareas de un cliente, con estado y fecha límite. id_cliente acepta el identificador o el nombre.',
    nivel: 1,
    inputSchema: {
      type: 'object',
      properties: { id_cliente: { type: 'string' } },
      required: ['id_cliente'],
    },
  },
  {
    name: 'cambiar_estado_tarea',
    description: 'Cambia el estado de una tarea: espera, proceso, bloqueada o terminado.',
    nivel: 2,
    inputSchema: {
      type: 'object',
      properties: {
        id_tarea: { type: 'string' },
        estado: { type: 'string', enum: ['espera', 'proceso', 'bloqueada', 'terminado'] },
      },
      required: ['id_tarea', 'estado'],
    },
  },
  {
    name: 'fichar',
    description: 'Registra tiempo trabajado en una tarea.',
    nivel: 2,
    inputSchema: {
      type: 'object',
      properties: {
        id_tarea: { type: 'string' },
        minutos: { type: 'number' },
        descripcion: { type: 'string' },
      },
      required: ['id_tarea', 'minutos'],
    },
  },
  {
    name: 'resumen_cliente',
    description: 'Resumen de un cliente: tareas abiertas, servicios y procesos. id_cliente acepta id o nombre.',
    nivel: 1,
    inputSchema: {
      type: 'object',
      properties: { id_cliente: { type: 'string' } },
      required: ['id_cliente'],
    },
  },
  {
    name: 'hub_cliente',
    description: 'Contenido del hub de un cliente: servicios, cuentas, procesos y conocimiento. id_cliente acepta id o nombre.',
    nivel: 1,
    inputSchema: {
      type: 'object',
      properties: { id_cliente: { type: 'string' } },
      required: ['id_cliente'],
    },
  },
  {
    name: 'creatividades_cliente',
    description: 'Creatividades de Google Ads de un cliente con sus métricas e imagen, para analizarlas o evaluarlas.',
    nivel: 1,
    inputSchema: {
      type: 'object',
      properties: {
        id_cliente: { type: 'string', description: 'Identificador o nombre del cliente' },
        desde: { type: 'string', description: 'Fecha inicial AAAA-MM-DD (por defecto, hace 30 días)' },
        hasta: { type: 'string', description: 'Fecha final AAAA-MM-DD (por defecto, hoy)' },
        limite: { type: 'number', description: 'Máximo de creatividades (por defecto 40)' },
      },
      required: ['id_cliente'],
    },
  },
  {
    name: 'guardar_evaluacion',
    description: 'Guarda en la biblioteca la evaluación de una pieza para un cliente.',
    nivel: 1,
    inputSchema: {
      type: 'object',
      properties: {
        id_cliente: { type: 'string', description: 'Identificador o nombre del cliente' },
        nombre_pieza: { type: 'string' },
        puntuacion: { type: 'number', description: 'De 0 a 10' },
        fortalezas: { type: 'array', items: { type: 'string' } },
        riesgos: { type: 'array', items: { type: 'string' } },
        notas: { type: 'string' },
        imagen_url: { type: 'string' },
        plataforma: { type: 'string', enum: ['google_ads', 'meta_ads'] },
      },
      required: ['id_cliente', 'nombre_pieza'],
    },
  },
  {
    name: 'biblioteca',
    description: 'Contenido guardado del Creative Lab de un cliente: análisis, evaluaciones, hipótesis y conocimiento.',
    nivel: 1,
    inputSchema: {
      type: 'object',
      properties: {
        id_cliente: { type: 'string' },
        coleccion: { type: 'string', description: 'Opcional: analisis, evaluaciones, hipotesis, variaciones, conocimiento' },
      },
      required: ['id_cliente'],
    },
  },
  {
    name: 'listar_clientes',
    description: 'Lista de clientes activos con su identificador. Úsalo para resolver un nombre.',
    nivel: 2,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listar_empleados',
    description: 'Lista del equipo con identificador y nombre.',
    nivel: 3,
    inputSchema: { type: 'object', properties: {} },
  },
] as const

const NIVEL: Record<TipoLlave, number> = { externo: 1, operativo: 2, admin: 3 }

const PALABRAS: Record<string, string> = {
  espera: 'En espera',
  proceso: 'En proceso',
  bloqueada: 'Bloqueada',
  terminado: 'Terminada',
}

async function resolverCliente(valor: string): Promise<string> {
  const db = createAdminClient()
  const v = String(valor ?? '').trim()
  if (!v) throw new Error('Falta el cliente')

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v)) return v

  const { data } = await db.from('clientes').select('id, nombre').ilike('nombre', `%${v}%`).limit(2)
  if (!data || data.length === 0) throw new Error(`No encuentro el cliente "${v}"`)
  return String(data[0].id)
}

function texto(datos: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(datos) }] }
}

async function ejecutar(nombre: string, args: Record<string, unknown>, llave: LlaveMCP) {
  const db = createAdminClient()
  const hoy = new Date().toISOString().slice(0, 10)

  switch (nombre) {
    case 'mis_tareas': {
      if (!llave.idEmpleado) return texto({ tareas: [], motivo: 'La llave no está asociada a un empleado' })
      const { data } = await db
        .from('tareas')
        .select('id, nombre, estado, fecha_limite, id_cliente, cliente:id_cliente(nombre)')
        .contains('ids_responsables', [llave.idEmpleado])
        .neq('estado', 'terminado')
        .order('fecha_limite', { ascending: true })
        .limit(50)
      return texto({ tareas: data ?? [] })
    }

    case 'tareas_cliente': {
      const { data } = await db
        .from('tareas')
        .select('id, nombre, estado, fecha_limite, ids_responsables')
        .eq('id_cliente', String(args.id_cliente ?? ''))
        .neq('estado', 'terminado')
        .order('fecha_limite', { ascending: true })
        .limit(100)
      return texto({ tareas: data ?? [] })
    }

    case 'cambiar_estado_tarea': {
      const estado = String(args.estado ?? '')
      if (!PALABRAS[estado]) throw new Error('Estado no válido')
      const { error } = await db.from('tareas').update({ estado }).eq('id', String(args.id_tarea ?? ''))
      if (error) throw new Error(error.message)
      return texto({ ok: true, id_tarea: args.id_tarea, estado, etiqueta: PALABRAS[estado] })
    }

    case 'fichar': {
      const idTarea = String(args.id_tarea ?? '')
      const minutos = Number(args.minutos ?? 0)
      if (!idTarea || !minutos || minutos <= 0) throw new Error('Tarea y minutos son obligatorios')
      if (!llave.idEmpleado) throw new Error('La llave no está asociada a un empleado')

      const { data: tarea } = await db
        .from('tareas')
        .select('id, nombre, id_cliente, id_servicio')
        .eq('id', idTarea)
        .maybeSingle()
      if (!tarea) throw new Error('Tarea no encontrada')

      const { error } = await db.from('time_logs').insert({
        id_empleado: llave.idEmpleado,
        id_cliente: tarea.id_cliente,
        id_servicio: tarea.id_servicio,
        id_tarea: idTarea,
        descripcion: String(args.descripcion ?? tarea.nombre ?? ''),
        fecha: hoy,
        minutos,
      })
      if (error) throw new Error(error.message)
      return texto({ ok: true, tarea: tarea.nombre, minutos })
    }

    case 'resumen_cliente': {
      const id = llave.idCliente ?? await resolverCliente(String(args.id_cliente ?? ''))
      const [{ data: cliente }, { data: tareas }, { data: servicios }, { data: procesos }] = await Promise.all([
        db.from('clientes').select('id, nombre').eq('id', id).maybeSingle(),
        db.from('tareas').select('estado').eq('id_cliente', id),
        db.from('servicios').select('id, nombre, descripcion').eq('id_cliente', id),
        db.from('procesos').select('id, nombre, fases').eq('id_cliente', id),
      ])
      if (!cliente) throw new Error('Cliente no encontrado')

      const abiertas = (tareas ?? []).filter(t => t.estado !== 'terminado').length
      return texto({
        cliente: cliente.nombre,
        tareas_total: (tareas ?? []).length,
        tareas_abiertas: abiertas,
        servicios: (servicios ?? []).map(s => s.nombre),
        procesos: (procesos ?? []).map(p => ({
          nombre: p.nombre,
          fases: Array.isArray(p.fases) ? p.fases.length : 0,
          terminadas: Array.isArray(p.fases)
            ? (p.fases as { estado?: string }[]).filter(f => f.estado === 'terminado').length
            : 0,
        })),
      })
    }

    case 'hub_cliente': {
      const id = llave.idCliente ?? await resolverCliente(String(args.id_cliente ?? ''))
      const { data: servicios } = await db.from('servicios').select('id, nombre, descripcion').eq('id_cliente', id)
      const idsServicio = (servicios ?? []).map(s => s.id)

      const [{ data: cuentas }, { data: notas }, { data: procesos }] = await Promise.all([
        idsServicio.length
          ? db.from('cuenta_plataforma').select('id_servicio, plataforma, id_externo, nombre').in('id_servicio', idsServicio)
          : Promise.resolve({ data: [] }),
        db.from('notas_conocimiento').select('titulo, contenido, visibilidad, created_at').eq('id_cliente', id).order('created_at', { ascending: false }).limit(20),
        db.from('procesos').select('nombre, fases').eq('id_cliente', id),
      ])

      return texto({
        servicios: servicios ?? [],
        cuentas: cuentas ?? [],
        conocimiento: notas ?? [],
        procesos: procesos ?? [],
      })
    }

    case 'creatividades_cliente': {
      const idCliente = llave.idCliente ?? await resolverCliente(String(args.id_cliente ?? ''))
      const desde = String(args.desde ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      const hasta = String(args.hasta ?? new Date().toISOString().slice(0, 10))
      const limite = Math.min(Number(args.limite ?? 40), 200)

      const { data: servicios } = await db.from('servicios').select('id').eq('id_cliente', idCliente)
      const idsServicio = (servicios ?? []).map(s => s.id)
      if (idsServicio.length === 0) throw new Error('El cliente no tiene servicios')

      const { data: cuentas } = await db
        .from('cuenta_plataforma')
        .select('id_externo, nombre')
        .in('id_servicio', idsServicio)
        .eq('plataforma', 'google_ads')
        .eq('activa', true)

      if (!cuentas || cuentas.length === 0) {
        throw new Error('El cliente no tiene ninguna cuenta de Google Ads vinculada en el hub')
      }

      const { data: conexion } = await db
        .from('mcp_conexiones')
        .select('access_token')
        .eq('proveedor', 'google_ads')
        .maybeSingle()
      if (!conexion?.access_token) throw new Error('Google Ads no está conectado en ceosiana')

      const token = String(conexion.access_token)
      const piezas: Record<string, unknown>[] = []

      for (const cuenta of cuentas) {
        const texto = await llamarHerramienta(token, 'search_search', {
          customer_id: cuenta.id_externo,
          resource: 'asset_group_asset',
          fields: [
            'campaign.name',
            'asset.id',
            'asset.name',
            'asset.type',
            'asset.image_asset.full_size.url',
            'metrics.impressions',
            'metrics.clicks',
            'metrics.cost_micros',
            'metrics.conversions',
            'metrics.conversions_value',
          ],
          conditions: [
            `segments.date BETWEEN '${desde}' AND '${hasta}'`,
            "asset.type IN ('IMAGE','YOUTUBE_VIDEO')",
          ],
          orderings: ['metrics.impressions DESC'],
          login_customer_id: cuenta.id_externo,
          limit: limite,
        })

        const filas = JSON.parse(texto) as Record<string, unknown>[]
        for (const f of filas) {
          const coste = Number(f['metrics.cost_micros'] ?? 0) / 1e6
          const conv = Number(f['metrics.conversions'] ?? 0)
          piezas.push({
            cuenta: cuenta.nombre,
            campana: String(f['campaign.name'] ?? ''),
            id: String(f['asset.id'] ?? ''),
            nombre: String(f['asset.name'] ?? ''),
            tipo: String(f['asset.type'] ?? ''),
            imagen: String(f['asset.image_asset.full_size.url'] ?? ''),
            impresiones: Number(f['metrics.impressions'] ?? 0),
            clics: Number(f['metrics.clicks'] ?? 0),
            coste: Number(coste.toFixed(2)),
            conversiones: conv,
            valor: Number(Number(f['metrics.conversions_value'] ?? 0).toFixed(2)),
            cpa: conv >= 0.5 ? Number((coste / conv).toFixed(2)) : null,
          })
        }
      }

      piezas.sort((a, b) => Number(b.impresiones) - Number(a.impresiones))
      return texto({ periodo: { desde, hasta }, total: piezas.length, creatividades: piezas.slice(0, limite) })
    }

    case 'guardar_evaluacion': {
      const idCliente = llave.idCliente ?? await resolverCliente(String(args.id_cliente ?? ''))
      const nombrePieza = String(args.nombre_pieza ?? '').trim()
      if (!nombrePieza) throw new Error('Falta el nombre de la pieza')

      const id = crypto.randomUUID()
      const { error } = await db.from('lab_docs').insert({
        coleccion: 'evaluaciones',
        doc_id: id,
        id_cliente: idCliente,
        plataforma: args.plataforma === 'meta_ads' ? 'meta_ads' : 'google_ads',
        datos: {
          nombre: nombrePieza,
          puntuacion: args.puntuacion ?? null,
          fortalezas: Array.isArray(args.fortalezas) ? args.fortalezas : [],
          riesgos: Array.isArray(args.riesgos) ? args.riesgos : [],
          notas: args.notas ?? '',
          imagen_url: args.imagen_url ?? '',
          autor: llave.nombre,
          createdAt: new Date().toISOString(),
        },
      })
      if (error) throw new Error(error.message)
      return texto({ ok: true, id, guardado: nombrePieza })
    }

    case 'biblioteca': {
      const idCliente = llave.idCliente ?? await resolverCliente(String(args.id_cliente ?? ''))
      let q = db
        .from('lab_docs')
        .select('coleccion, doc_id, datos, created_at')
        .eq('id_cliente', idCliente)
        .order('created_at', { ascending: false })
        .limit(50)

      if (args.coleccion) q = q.eq('coleccion', String(args.coleccion))

      const { data } = await q
      return texto({
        documentos: (data ?? []).map(d => ({
          coleccion: d.coleccion,
          id: d.doc_id,
          fecha: d.created_at,
          datos: d.datos,
        })),
        total: (data ?? []).length,
      })
    }

    case 'listar_clientes': {
      const { data } = await db.from('clientes').select('id, nombre').eq('activo', true).order('nombre')
      return texto({ clientes: data ?? [] })
    }

    case 'listar_empleados': {
      const { data } = await db.from('empleados').select('id, nombre, email').order('nombre')
      return texto({ empleados: data ?? [] })
    }

    default:
      throw new Error(`Herramienta desconocida: ${nombre}`)
  }
}

async function atender(peticion: Peticion, llave: LlaveMCP) {
  switch (peticion.method) {
    case 'initialize':
      return {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'ceosiana', version: '1.0.0' },
      }

    case 'tools/list':
      return {
        tools: HERRAMIENTAS
          .filter(h => NIVEL[llave.tipo] >= h.nivel)
          .map(h => ({ name: h.name, description: h.description, inputSchema: h.inputSchema })),
      }

    case 'tools/call': {
      const params = (peticion.params ?? {}) as { name?: string; arguments?: Record<string, unknown> }
      const nombre = String(params.name ?? '')
      const herramienta = HERRAMIENTAS.find(h => h.name === nombre)
      if (!herramienta) throw new Error(`Herramienta desconocida: ${nombre}`)
      if (NIVEL[llave.tipo] < herramienta.nivel) {
        throw new Error(
          herramienta.nivel === 3
            ? 'Esta herramienta requiere una llave de administrador'
            : 'Esta herramienta requiere una llave operativa',
        )
      }
      return ejecutar(nombre, params.arguments ?? {}, llave)
    }

    default:
      throw new Error(`Método no soportado: ${peticion.method}`)
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params
  if (tipo !== 'operativo' && tipo !== 'admin' && tipo !== 'externo') {
    return NextResponse.json({ error: 'Ruta no válida' }, { status: 404 })
  }

  const llave = await verificarLlave(req)
  if (!llave) {
    return NextResponse.json(
      { error: 'Llave no válida' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="ceosiana"' } },
    )
  }

  if (NIVEL[llave.tipo] < NIVEL[tipo as TipoLlave]) {
    return NextResponse.json({ error: 'Esta llave no sirve para esta ruta' }, { status: 403 })
  }

  const cuerpo = (await req.json().catch(() => null)) as Peticion | Peticion[] | null
  if (!cuerpo) return NextResponse.json({ error: 'JSON no válido' }, { status: 400 })

  const esNotificacion = (p: Peticion) => p.id === undefined || p.id === null

  try {
    if (Array.isArray(cuerpo)) {
      const respuestas = []
      for (const p of cuerpo) {
        if (esNotificacion(p)) continue
        const result = await atender(p, llave)
        respuestas.push({ jsonrpc: '2.0', id: p.id, result })
      }
      return NextResponse.json(respuestas)
    }

    if (esNotificacion(cuerpo)) {
      return new NextResponse(null, { status: 202 })
    }

    try {
      const result = await atender(cuerpo, llave)
      return NextResponse.json({ jsonrpc: '2.0', id: cuerpo.id, result })
    } catch (e) {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: cuerpo.id,
        error: { code: -32603, message: e instanceof Error ? e.message : 'Error' },
      })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params
  return NextResponse.json({
    servidor: 'ceosiana',
    tipo,
    transporte: 'streamable-http (JSON)',
    autenticacion: 'Authorization: Bearer <llave>',
  })
}

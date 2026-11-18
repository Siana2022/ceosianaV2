import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { verificarLlave, type LlaveMCP, type TipoLlave } from '@/lib/server/mcpAuth'

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
    scope: 'operativo',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tareas_cliente',
    description: 'Tareas de un cliente, con estado y fecha límite.',
    scope: 'operativo',
    inputSchema: {
      type: 'object',
      properties: { id_cliente: { type: 'string' } },
      required: ['id_cliente'],
    },
  },
  {
    name: 'cambiar_estado_tarea',
    description: 'Cambia el estado de una tarea: espera, proceso, bloqueada o terminado.',
    scope: 'operativo',
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
    scope: 'operativo',
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
    description: 'Resumen de un cliente: tareas abiertas, servicios y procesos.',
    scope: 'operativo',
    inputSchema: {
      type: 'object',
      properties: { id_cliente: { type: 'string' } },
      required: ['id_cliente'],
    },
  },
  {
    name: 'hub_cliente',
    description: 'Contenido del hub de un cliente: servicios, cuentas, procesos y conocimiento.',
    scope: 'operativo',
    inputSchema: {
      type: 'object',
      properties: { id_cliente: { type: 'string' } },
      required: ['id_cliente'],
    },
  },
  {
    name: 'listar_clientes',
    description: 'Lista de clientes activos con su identificador.',
    scope: 'admin',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listar_empleados',
    description: 'Lista del equipo con identificador y nombre.',
    scope: 'admin',
    inputSchema: { type: 'object', properties: {} },
  },
] as const

const PALABRAS: Record<string, string> = {
  espera: 'En espera',
  proceso: 'En proceso',
  bloqueada: 'Bloqueada',
  terminado: 'Terminada',
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
      const id = String(args.id_cliente ?? '')
      const [{ data: cliente }, { data: tareas }, { data: servicios }, { data: procesos }] = await Promise.all([
        db.from('clientes').select('id, nombre').eq('id', id).maybeSingle(),
        db.from('tareas').select('estado').eq('id_cliente', id),
        db.from('servicios').select('id, nombre').eq('id_cliente', id),
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
      const id = String(args.id_cliente ?? '')
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
          .filter(h => llave.tipo === 'admin' || h.scope === 'operativo')
          .map(h => ({ name: h.name, description: h.description, inputSchema: h.inputSchema })),
      }

    case 'tools/call': {
      const params = (peticion.params ?? {}) as { name?: string; arguments?: Record<string, unknown> }
      const nombre = String(params.name ?? '')
      const herramienta = HERRAMIENTAS.find(h => h.name === nombre)
      if (!herramienta) throw new Error(`Herramienta desconocida: ${nombre}`)
      if (herramienta.scope === 'admin' && llave.tipo !== 'admin') {
        throw new Error('Esta herramienta requiere una llave de administrador')
      }
      return ejecutar(nombre, params.arguments ?? {}, llave)
    }

    default:
      throw new Error(`Método no soportado: ${peticion.method}`)
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params
  if (tipo !== 'operativo' && tipo !== 'admin') {
    return NextResponse.json({ error: 'Ruta no válida' }, { status: 404 })
  }

  const llave = await verificarLlave(req)
  if (!llave) {
    return NextResponse.json(
      { error: 'Llave no válida' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="ceosiana"' } },
    )
  }

  if (tipo === 'admin' && llave.tipo !== 'admin') {
    return NextResponse.json({ error: 'Llave operativa no válida para administración' }, { status: 403 })
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

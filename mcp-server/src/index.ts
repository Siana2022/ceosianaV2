import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { db, texto, resolverCliente, resolverServicio } from './supabase.js'

const server = new McpServer({
  name: 'ceosiana',
  version: '0.1.0',
})

// ── Clientes ────────────────────────────────────────────────────────────
server.tool(
  'listar_clientes',
  'Lista los clientes activos de la agencia con su id y nombre.',
  {},
  async () => {
    const { data, error } = await db
      .from('clientes')
      .select('id, nombre, activo')
      .or('activo.eq.true,activo.is.null')
      .order('nombre')
    if (error) return texto(`Error: ${error.message}`)
    return texto(data ?? [])
  },
)

server.tool(
  'resumen_cliente',
  'Resumen de un cliente: servicios, tareas abiertas, horas registradas y cuentas de plataforma.',
  { cliente: z.string().describe('Id o nombre del cliente') },
  async ({ cliente }) => {
    const c = await resolverCliente(cliente)
    if (!c) return texto(`No encuentro el cliente "${cliente}"`)

    const { data: servicios } = await db
      .from('servicios')
      .select('id, nombre, activo, tipo_servicio:id_tipo_servicio(nombre)')
      .eq('id_cliente', c.id)
      .or('activo.eq.true,activo.is.null')

    const ids = (servicios ?? []).map(s => s.id)

    const { data: tareas } = await db
      .from('tareas')
      .select('id, nombre, estado, fecha_limite')
      .eq('id_cliente', c.id)

    const abiertas = (tareas ?? []).filter(t => t.estado !== 'terminado')

    const { data: acciones } = ids.length
      ? await db.from('acciones').select('minutos, fecha').in('id_servicio', ids)
      : { data: [] as { minutos: number | null; fecha: string }[] }

    const minutos = (acciones ?? []).reduce((s, a) => s + Number(a.minutos ?? 0), 0)

    const { data: cuentas } = ids.length
      ? await db.from('cuenta_plataforma').select('plataforma, nombre, id_externo').in('id_servicio', ids)
      : { data: [] }

    return texto({
      cliente: c.nombre,
      servicios: (servicios ?? []).map(s => s.nombre),
      tareas_abiertas: abiertas.length,
      tareas_totales: (tareas ?? []).length,
      proximas_tareas: abiertas
        .sort((a, b) => String(a.fecha_limite ?? '').localeCompare(String(b.fecha_limite ?? '')))
        .slice(0, 10)
        .map(t => ({ nombre: t.nombre, estado: t.estado, fecha_limite: t.fecha_limite })),
      horas_registradas: Math.round((minutos / 60) * 10) / 10,
      cuentas: (cuentas ?? []).map(c2 => `${c2.plataforma}: ${c2.nombre} (${c2.id_externo})`),
    })
  },
)

server.tool(
  'tareas_de_cliente',
  'Lista las tareas de un cliente, ordenadas por urgencia (pendientes, bloqueadas y terminadas al final).',
  {
    cliente: z.string().describe('Id o nombre del cliente'),
    solo_abiertas: z.boolean().optional().describe('Si true, omite las terminadas'),
  },
  async ({ cliente, solo_abiertas }) => {
    const c = await resolverCliente(cliente)
    if (!c) return texto(`No encuentro el cliente "${cliente}"`)

    const { data, error } = await db
      .from('tareas')
      .select('id, nombre, estado, fecha_limite, id_servicio')
      .eq('id_cliente', c.id)
      .order('fecha_limite', { ascending: true })

    if (error) return texto(`Error: ${error.message}`)

    const prioridad = (e: string) => (e === 'terminado' ? 3 : e === 'bloqueada' ? 2 : 1)
    const lista = (data ?? [])
      .filter(t => !solo_abiertas || t.estado !== 'terminado')
      .sort((a, b) => prioridad(a.estado) - prioridad(b.estado))

    return texto(lista)
  },
)

// ── Trabajo ─────────────────────────────────────────────────────────────
server.tool(
  'registrar_trabajo',
  'Registra una acción de trabajo en un servicio y su fichaje correspondiente (minutos).',
  {
    servicio: z.string().describe('Id o nombre del servicio'),
    titulo: z.string().describe('Qué se ha hecho'),
    minutos: z.number().int().positive().describe('Minutos dedicados'),
    email_empleado: z.string().email().describe('Email del empleado que lo ha hecho'),
    fecha: z.string().optional().describe('Fecha YYYY-MM-DD (por defecto hoy)'),
  },
  async ({ servicio, titulo, minutos, email_empleado, fecha }) => {
    const s = await resolverServicio(servicio)
    if (!s) return texto(`No encuentro el servicio "${servicio}"`)

    const { data: emp } = await db
      .from('empleados')
      .select('id, nombre')
      .or(`email.eq.${email_empleado},slack_email.eq.${email_empleado}`)
      .maybeSingle()
    if (!emp) return texto(`No encuentro ningún empleado con el email ${email_empleado}`)

    const dia = fecha || new Date().toISOString().slice(0, 10)

    const { data: log, error: logError } = await db
      .from('time_logs')
      .insert({
        id_empleado: emp.id,
        id_servicio: s.id,
        id_cliente: s.id_cliente,
        descripcion: titulo,
        fecha: dia,
        minutos,
      })
      .select('id')
      .single()

    if (logError) return texto(`Error al crear el fichaje: ${logError.message}`)

    const { data: accion, error: accionError } = await db
      .from('acciones')
      .insert({
        id_servicio: s.id,
        id_empleado: emp.id,
        id_time_log: log.id,
        fecha: dia,
        tipo: 'optimizacion',
        titulo,
        minutos,
        visibilidad: 'interna',
      })
      .select()
      .single()

    if (accionError) {
      return texto(`El fichaje se guardó (${log.id}) pero la acción falló: ${accionError.message}`)
    }

    return texto({ ok: true, accion: accion.id, fichaje: log.id, servicio: s.nombre, empleado: emp.nombre })
  },
)

// ── Arranque ────────────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[ceosiana-mcp] listo (stdio)')

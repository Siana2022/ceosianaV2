import type { ReactNode } from 'react'
import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'
import TareasShell from './TareasShell'
import type { Cliente, Departamento, Empleado, Plantilla, Proceso, Servicio, Tarea } from './types'

const COLORES_DEPTO = ['blue', 'purple', 'pink', 'amber', 'green', 'red', 'teal', 'orange']

export default async function TareasLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const perfil = await getPerfil()
  const isAdmin = perfil?.rol === 'admin'

  const [
    { data: rawClientes, error: errClientes },
    { data: rawEmpleados, error: errEmpleados },
    { data: rawDepartamentos, error: errDepartamentos },
    { data: rawServicios, error: errServicios },
    { data: rawTareas, error: errTareas },
    { data: rawProcesos, error: errProcesos },
    { data: rawPlantillas, error: errPlantillas },
  ] = await Promise.all([
    supabase.from('clientes').select('id, nombre, slack_canal').eq('activo', true).order('nombre'),
    supabase.from('empleados').select('id, nombre, email, avatar_url').eq('activo', true).order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase
      .from('servicios')
      .select('id, nombre, id_cliente, tipo_servicio:id_tipo_servicio(nombre)')
      .eq('activo', true)
      .order('nombre'),
    supabase.from('tareas').select('*').order('created_at', { ascending: false }),
    supabase.from('procesos').select('*').order('created_at', { ascending: true }),
    supabase.from('plantillas').select('*').order('created_at', { ascending: true }),
  ])

  const errs = { clientes: errClientes, empleados: errEmpleados, departamentos: errDepartamentos, servicios: errServicios, tareas: errTareas, procesos: errProcesos, plantillas: errPlantillas }
  Object.entries(errs).forEach(([k, e]) => { if (e) console.error(`[tareas/layout] Error loading ${k}:`, e.message) })

  const clientes: Cliente[] = (rawClientes ?? []).map(c => ({ id: String(c.id), nombre: c.nombre }))
  const slackClienteInit: Record<string, string> = {}
  ;(rawClientes ?? []).forEach(c => {
    if (c.slack_canal) slackClienteInit[String(c.id)] = c.slack_canal as string
  })
  const empleados: Empleado[] = (rawEmpleados ?? []).map(e => ({
    id: String(e.id),
    nombre: e.nombre,
    email: (e.email as string | null) ?? '',
    avatarUrl: (e.avatar_url as string | null) ?? null,
  }))
  const departamentos: Departamento[] = (rawDepartamentos ?? []).map((d, i) => ({
    id: String(d.id),
    nombre: d.nombre,
    color: COLORES_DEPTO[i % COLORES_DEPTO.length],
  }))
  const servicios: Servicio[] = (rawServicios ?? []).map(s => ({
    id: String(s.id),
    idCliente: (s as { id_cliente: unknown }).id_cliente != null
      ? String((s as { id_cliente: unknown }).id_cliente)
      : '',
    nombre: s.nombre,
    tipoServicio: ((s.tipo_servicio as unknown as { nombre: string } | null)?.nombre) ?? '',
  }))

  const tareas: Tarea[] = (rawTareas ?? []).map(r => ({
    id: String(r.id),
    nombre: (r.nombre as string) ?? '',
    tipo: (r.tipo as Tarea['tipo']) ?? 'tarea',
    idCliente: r.id_cliente ? String(r.id_cliente) : null,
    idServicio: r.id_servicio ? String(r.id_servicio) : null,
    idDepartamento: r.id_departamento ? String(r.id_departamento) : null,
    idsResponsables: (r.ids_responsables as string[]) ?? [],
    fechaLimite: (r.fecha_limite as string) ?? new Date().toISOString().slice(0, 10),
    hora: (r.hora as string | null) ?? null,
    lugar: (r.lugar as string | null) ?? null,
    estado: (r.estado as Tarea['estado']) ?? 'espera',
    explicacionBloqueo: (r.explicacion_bloqueo as string | null) ?? null,
    enlaceInfo: (r.enlace_info as string) ?? '',
    descripcion: (r.descripcion as string) ?? '',
    recurrencia: (r.recurrencia as Tarea['recurrencia']) ?? 'ninguna',
    minutosAcumulados: (r.minutos_acumulados as number) ?? 0,
    timerActivo: false,
    chat: (r.chat as Tarea['chat']) ?? [],
    checklist: (r.checklist as Tarea['checklist']) ?? [],
    adjuntos: (r.adjuntos as Tarea['adjuntos']) ?? [],
    imagenes: (r.imagenes as Tarea['imagenes']) ?? [],
    syncCalendar: (r.sync_calendar as boolean) ?? false,
  }))

  const procesos: Proceso[] = (rawProcesos ?? []).map(r => ({
    id: String(r.id),
    idCliente: String(r.id_cliente),
    idServicio: r.id_servicio ? String(r.id_servicio) : null,
    idPlantilla: (r.id_plantilla as string) ?? '',
    nombre: (r.nombre as string) ?? '',
    fases: (r.fases as Proceso['fases']) ?? [],
  }))

  const plantillas: Plantilla[] = (rawPlantillas ?? []).map(r => ({
    id: String(r.id),
    nombre: (r.nombre as string) ?? '',
    descripcion: (r.descripcion as string) ?? '',
    tipoServicio: (r.tipo_servicio as string | null) ?? null,
    activo: (r.activo as boolean) ?? true,
    fases: (r.fases as Plantilla['fases']) ?? [],
  }))

  return (
    <TareasShell
      initialClientes={clientes}
      initialEmpleados={empleados}
      initialDepartamentos={departamentos}
      initialServicios={servicios}
      initialTareas={tareas}
      initialProcesos={procesos}
      initialPlantillas={plantillas}
      initialSlackCliente={slackClienteInit}
      isAdmin={isAdmin}
      idEmpleadoActual={perfil?.id_empleado ? String(perfil.id_empleado) : null}
    >
      {children}
    </TareasShell>
  )
}

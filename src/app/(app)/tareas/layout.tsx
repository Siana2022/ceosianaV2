import type { ReactNode } from 'react'
import { createClient } from '@/lib/server/supabase'
import TareasShell from './TareasShell'
import type { Cliente, Departamento, Empleado, Plantilla, Proceso, Servicio, Tarea } from './types'

const COLORES_DEPTO = ['blue', 'purple', 'pink', 'amber', 'green', 'red', 'teal', 'orange']

export default async function TareasLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()

  const [
    { data: rawClientes },
    { data: rawEmpleados },
    { data: rawDepartamentos },
    { data: rawServicios },
    { data: rawTareas },
    { data: rawProcesos },
    { data: rawPlantillas },
  ] = await Promise.all([
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('empleados').select('id, nombre, email').eq('activo', true).order('nombre'),
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

  const clientes: Cliente[] = (rawClientes ?? []).map(c => ({ id: String(c.id), nombre: c.nombre }))
  const empleados: Empleado[] = (rawEmpleados ?? []).map(e => ({
    id: String(e.id),
    nombre: e.nombre,
    email: (e.email as string | null) ?? '',
  }))
  const departamentos: Departamento[] = (rawDepartamentos ?? []).map((d, i) => ({
    id: String(d.id),
    nombre: d.nombre,
    color: COLORES_DEPTO[i % COLORES_DEPTO.length],
  }))
  const servicios: Servicio[] = (rawServicios ?? []).map(s => ({
    id: String(s.id),
    idCliente: String((s as { id_cliente: unknown }).id_cliente),
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
    adjuntos: (r.adjuntos as Tarea['adjuntos']) ?? [],
    imagenes: [],
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
    >
      {children}
    </TareasShell>
  )
}

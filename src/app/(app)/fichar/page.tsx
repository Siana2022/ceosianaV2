import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import { redirect } from 'next/navigation'
import FicharClient from './FicharClient'

export default async function FicharPage() {
  const perfilData = await getPerfil()
  // If no profile row exists, treat as admin (backward compat for existing users)
  const perfil = perfilData ?? { id: '', id_empleado: null, rol: 'empleado' as const }

  const supabase = await createClient()

  // Fetch all services with client + department info for the selector
  const { data: servicios } = await supabase
    .from('servicios')
    .select('id, nombre, notas, id_departamento, departamento:id_departamento(id, nombre), cliente:id_cliente(id, nombre)')
    .eq('activo', true)
    .order('nombre')

  // Fetch all active departments
  const { data: departamentos } = await supabase
    .from('departamentos')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  // Clientes activos + prospectos abiertos (se distinguen por el estado)
  const [{ data: clientesBase }, { data: prospectos }] = await Promise.all([
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase
      .from('pipeline_prospectos')
      .select('id, nombre, estado')
      .eq('activo', true)
      .in('estado', ['descubrimiento', 'propuesta', 'negociacion'])
      .order('nombre'),
  ])

  const ETIQUETA_PROSPECTO: Record<string, string> = {
    descubrimiento: 'Descubrimiento',
    propuesta: 'Propuesta',
    negociacion: 'Negociación',
  }

  const clientes = [
    ...(clientesBase ?? []),
    ...((prospectos ?? []) as { id: string; nombre: string; estado: string }[]).map(p => ({
      id: p.id,
      nombre: `${p.nombre} · ${ETIQUETA_PROSPECTO[p.estado] ?? p.estado}`,
    })),
  ].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'))

  // Fetch employee info if linked; if not, try to resolve by email
  let empleadoNombre = 'Usuario'
  let perfilConEmpleado = { ...perfil }
  if (perfil.id_empleado) {
    const { data: emp } = await supabase
      .from('empleados')
      .select('nombre')
      .eq('id', perfil.id_empleado)
      .single()
    if (emp) empleadoNombre = emp.nombre
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      const { data: emp } = await supabase
        .from('empleados')
        .select('id, nombre')
        .eq('email', user.email)
        .maybeSingle()
      if (emp) {
        empleadoNombre = emp.nombre
        perfilConEmpleado = { ...perfil, id_empleado: emp.id }
      }
    }
  }

  // Admin: fetch all employees for the team view
  let empleados: { id: string; nombre: string }[] = []
  if (perfil.rol === 'admin') {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
    empleados = data ?? []
  }

  // Fetch active tareas for linking fichajes
  const { data: tareas } = await supabase
    .from('tareas')
    .select('id, nombre, id_cliente, id_departamento, estado, minutos_acumulados')
    .in('estado', ['espera', 'proceso', 'bloqueada'])
    .order('nombre')

  // Pipeline prospects — visible to all employees as extra "clients" in selector.
  // activo puede ser NULL en filas antiguas, así que no basta con eq(true).
  const { data: pips } = await createAdminClient()
    .from('pipeline_prospectos')
    .select('id, nombre')
    .or('activo.eq.true,activo.is.null')
    .order('nombre')
  const pipelineProspectos = (pips ?? []).map(p => ({ id: String(p.id), nombre: `${p.nombre} (Pipeline)` }))

  return (
    <FicharClient
      perfil={perfilConEmpleado}
      empleadoNombre={empleadoNombre}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      servicios={(servicios ?? []) as any[]}
      departamentos={departamentos ?? []}
      clientes={clientes ?? []}
      pipelineProspectos={pipelineProspectos}
      empleados={empleados}
      tareas={(tareas ?? []).map(t => ({ id: String(t.id), nombre: t.nombre as string, idCliente: t.id_cliente ? String(t.id_cliente) : null, idDepartamento: t.id_departamento ? String(t.id_departamento) : null, minutosAcumulados: (t.minutos_acumulados as number) ?? 0, estado: (t.estado as string) ?? 'espera' }))}
    />
  )
}

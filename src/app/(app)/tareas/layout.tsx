import type { ReactNode } from 'react'
import { createClient } from '@/lib/server/supabase'
import TareasShell from './TareasShell'
import type { Cliente, Departamento, Empleado, Servicio } from './types'

const COLORES_DEPTO = ['blue', 'purple', 'pink', 'amber', 'green', 'red', 'teal', 'orange']

export default async function TareasLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()

  const [
    { data: rawClientes },
    { data: rawEmpleados },
    { data: rawDepartamentos },
    { data: rawServicios },
  ] = await Promise.all([
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('empleados').select('id, nombre, email').eq('activo', true).order('nombre'),
    supabase.from('departamentos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase
      .from('servicios')
      .select('id, nombre, id_cliente, tipo_servicio:id_tipo_servicio(nombre)')
      .eq('activo', true)
      .order('nombre'),
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

  return (
    <TareasShell
      initialClientes={clientes}
      initialEmpleados={empleados}
      initialDepartamentos={departamentos}
      initialServicios={servicios}
    >
      {children}
    </TareasShell>
  )
}

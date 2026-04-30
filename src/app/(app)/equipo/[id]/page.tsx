import { createClient } from '@/lib/server/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SueldosClient from './SueldosClient'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export default async function EmpleadoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: empleado }, { data: sueldos }, { data: dedicacion }] = await Promise.all([
    supabase.from('empleados').select('id, nombre, email, activo, fecha_alta, fecha_baja').eq('id', id).single(),
    supabase
      .from('sueldos')
      .select('id, id_empleado, coste_total, mes, anio')
      .eq('id_empleado', id)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false }),
    supabase
      .from('empleado_dedicacion')
      .select('id, id_departamento, porcentaje, mes, anio')
      .eq('id_empleado', id)
      .eq('anio', new Date().getFullYear()),
  ])

  if (!empleado) notFound()

  return (
    <div className="p-6 space-y-8">
      {/* Back link */}
      <Link
        href="/equipo"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        ← Volver al equipo
      </Link>

      {/* Employee header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{empleado.nombre}</h2>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  empleado.activo
                    ? 'bg-green-900/50 text-green-400 border border-green-800'
                    : 'bg-red-900/50 text-red-400 border border-red-800'
                }`}
              >
                {empleado.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            {empleado.email && (
              <p className="text-gray-400 text-sm mt-1">{empleado.email}</p>
            )}
          </div>
          <div className="text-sm text-gray-500 space-y-1 text-right">
            <div>Alta: <span className="text-gray-300">{fmtDate(empleado.fecha_alta)}</span></div>
            {empleado.fecha_baja && (
              <div>Baja: <span className="text-gray-300">{fmtDate(empleado.fecha_baja)}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Sueldos section */}
      <SueldosClient empleadoId={id} sueldos={sueldos ?? []} />

      {/* Dedicación section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Dedicación</h3>
          <Link
            href={`/dedicacion?empleado=${id}`}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Gestionar dedicación →
          </Link>
        </div>
        {dedicacion && dedicacion.length > 0 ? (
          <p className="text-gray-400 text-sm">
            {dedicacion.length} asignación(es) este año. Haz clic en "Gestionar dedicación" para ver el detalle y editar.
          </p>
        ) : (
          <p className="text-gray-500 text-sm">
            Sin asignaciones de dedicación para este año.{' '}
            <Link href={`/dedicacion?empleado=${id}`} className="text-blue-400 hover:text-blue-300">
              Añadir dedicación
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

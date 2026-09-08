import type { SupabaseClient } from '@supabase/supabase-js'

// Sustituye a la tabla `empleado_dedicacion` (input manual mes a mes): la dedicación de un
// empleado a un departamento se calcula a partir de lo que ha fichado ese mes en `time_logs`,
// no de un porcentaje introducido a mano. Los fichajes sin departamento asignado cuentan en el
// total del empleado (reducen el % del resto) pero no se atribuyen a ningún departamento.
export interface DedicacionCalculadaRow {
  id_empleado: string
  id_departamento: string
  mes: number
  anio: number
  porcentaje: number
}

interface Opciones {
  anio?: number
  mes?: number
  idDepartamento?: string
  idEmpleado?: string
}

export async function getDedicacionCalculada(
  supabase: SupabaseClient,
  { anio, mes, idDepartamento, idEmpleado }: Opciones = {}
): Promise<DedicacionCalculadaRow[]> {
  let query = supabase
    .from('time_logs')
    .select('id_empleado, id_departamento, id_servicio, minutos, fecha, servicios(id_departamento)')

  if (anio) {
    query = query.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`)
  }
  if (anio && mes) {
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
    const ultimoDia = new Date(anio, mes, 0).getDate()
    const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
    query = query.gte('fecha', desde).lte('fecha', hasta)
  }
  if (idEmpleado) query = query.eq('id_empleado', idEmpleado)
  if (idDepartamento) query = query.eq('id_departamento', idDepartamento)

  const PAGE = 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allData: any[] = []
  let from = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: page, error } = await query.range(from, from + PAGE - 1)
    if (error) throw error
    const rows = page ?? []
    allData.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }
  const data = allData

  // Minutos totales fichados por el empleado ese mes/año (el "100%"), incluyendo fichajes sin depto.
  const totalPorEmpleadoMes = new Map<string, number>()
  // Minutos fichados por (empleado, departamento, mes, año).
  const minutosPorCombo = new Map<string, { idEmpleado: string; idDepartamento: string; mes: number; anio: number; minutos: number }>()

  for (const row of data ?? []) {
    const anioFila = parseInt(row.fecha.slice(0, 4), 10)
    const mesFila = parseInt(row.fecha.slice(5, 7), 10)
    const keyTotal = `${row.id_empleado}_${anioFila}_${mesFila}`
    totalPorEmpleadoMes.set(keyTotal, (totalPorEmpleadoMes.get(keyTotal) ?? 0) + (row.minutos ?? 0))

    // Resolve effective department: direct assignment takes priority, then fall back
    // to the department of the associated service (if any).
    // Supabase may type the joined relation as an array; normalise to a single record.
    const servicioRaw = row.servicios as unknown
    const servicio = Array.isArray(servicioRaw) ? (servicioRaw[0] as { id_departamento: string | null } | undefined) : (servicioRaw as { id_departamento: string | null } | null)
    const idDept: string | null = row.id_departamento ?? servicio?.id_departamento ?? null
    if (!idDept) continue
    const keyCombo = `${row.id_empleado}_${idDept}_${anioFila}_${mesFila}`
    const actual = minutosPorCombo.get(keyCombo)
    if (actual) {
      actual.minutos += row.minutos ?? 0
    } else {
      minutosPorCombo.set(keyCombo, { idEmpleado: row.id_empleado, idDepartamento: idDept, mes: mesFila, anio: anioFila, minutos: row.minutos ?? 0 })
    }
  }

  const resultado: DedicacionCalculadaRow[] = []
  for (const { idEmpleado: emp, idDepartamento: dep, mes: mesFila, anio: anioFila, minutos } of minutosPorCombo.values()) {
    const total = totalPorEmpleadoMes.get(`${emp}_${anioFila}_${mesFila}`) ?? 0
    if (total === 0) continue
    resultado.push({
      id_empleado: emp,
      id_departamento: dep,
      mes: mesFila,
      anio: anioFila,
      porcentaje: Math.round((minutos / total) * 1000) / 10,
    })
  }
  return resultado
}

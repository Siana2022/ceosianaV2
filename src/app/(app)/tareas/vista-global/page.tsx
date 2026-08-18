'use client'

import { useState } from 'react'
import { useTareas } from '../store'
import type { TipoTarea } from '../types'
import TareaDetailModal from '../components/TareaDetailModal'
import ClienteInfoBlock from '../components/ClienteInfoBlock'
import SlackClienteBlock from '../components/SlackClienteBlock'
import ImportarPlantillaModal from '../components/ImportarPlantillaModal'
import CrearClienteModal from '../components/CrearClienteModal'
import GanttChart from '../components/GanttChart'
import GanttLegend from '../components/GanttLegend'
import CollapsibleSection from '../components/CollapsibleSection'
import RangoFechasSelector from '../components/RangoFechasSelector'
import WorkloadPieChart from '../components/WorkloadPieChart'
import ProcesosTareasBloque, { type VistaTareas } from '../components/ProcesosTareasBloque'
import { filasGanttCliente, filasGanttDepartamento, filasGanttEmpleado } from '../ganttData'
import { detectarConflictos } from '../conflictos'
import { finMes, hoyISO, inicioMes } from '../dateUtils'
import { workloadClientePorEmpleado, workloadDepartamentoPorEmpleado, workloadEmpleadoPorCliente } from '../workloadData'

const inputCls = 'bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

type Tab = 'cliente' | 'empleado' | 'departamento'
type Visualizacion = 'kanban' | 'gantt' | 'quesos'
type Metrica = 'horas' | 'tareas'

export default function VistaGlobalPage() {
  const { state, actions } = useTareas()
  const [tab, setTab] = useState<Tab>('cliente')
  const [visualizacion, setVisualizacion] = useState<Visualizacion>('kanban')
  const [vistaTareas, setVistaTareas] = useState<VistaTareas>('tarjeta')
  const [metrica, setMetrica] = useState<Metrica>('horas')
  const [rango, setRango] = useState(() => ({ desde: inicioMes(hoyISO()), hasta: finMes(hoyISO()) }))
  const [idCliente, setIdCliente] = useState(state.clientes[0]?.id ?? '')
  const [idEmpleado, setIdEmpleado] = useState(state.empleados[0]?.id ?? '')
  const [idDepartamento, setIdDepartamento] = useState(state.departamentos[0]?.id ?? '')
  const [tareaAbiertaId, setTareaAbiertaId] = useState<string | null>(null)
  const [mostrarImportar, setMostrarImportar] = useState(false)
  const [mostrarCrearCliente, setMostrarCrearCliente] = useState(false)

  const tareaAbierta = state.tareas.find(t => t.id === tareaAbiertaId) ?? null

  const nuevaTarea = (preset: {
    idCliente?: string | null
    idDepartamento?: string | null
    idsResponsables?: string[]
    tipo?: TipoTarea
  }) => {
    const id = actions.crearTarea({
      nombre: preset.tipo === 'reunion' ? 'Nueva reunión' : preset.tipo === 'visita' ? 'Nueva visita' : 'Nueva tarea',
      tipo: preset.tipo ?? 'tarea',
      idCliente: preset.idCliente ?? null,
      idServicio: null,
      idDepartamento: preset.idDepartamento ?? null,
      idsResponsables: preset.idsResponsables ?? [],
      fechaLimite: new Date().toISOString().slice(0, 10),
      hora: null,
      lugar: null,
      estado: 'espera',
      explicacionBloqueo: null,
      enlaceInfo: '',
      descripcion: '',
      recurrencia: 'ninguna',
      adjuntos: [],
      imagenes: [],
    })
    setTareaAbiertaId(id)
  }

  const visualizacionToggle = (
    <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit flex-shrink-0">
      {([
        { key: 'kanban', label: '🗂️ Kanban' },
        { key: 'gantt', label: '📅 Gantt' },
        { key: 'quesos', label: '🥧 Quesos' },
      ] as const).map(v => (
        <button
          key={v.key}
          onClick={() => setVisualizacion(v.key)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${visualizacion === v.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          {v.label}
        </button>
      ))}
    </div>
  )

  const quesosControles = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <RangoFechasSelector desde={rango.desde} hasta={rango.hasta} onChange={(desde, hasta) => setRango({ desde, hasta })} />
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
        {([{ key: 'horas', label: 'Horas' }, { key: 'tareas', label: 'N.º tareas' }] as const).map(m => (
          <button
            key={m.key}
            onClick={() => setMetrica(m.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${metrica === m.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )

  // ── Por cliente ──────────────────────────────────────────────────────────
  const procesosCliente = state.procesos.filter(p => p.idCliente === idCliente)
  const tareasCliente = state.tareas.filter(t => t.idCliente === idCliente && t.tipo === 'tarea')
  const tareasActivasCliente = tareasCliente.filter(t => t.estado !== 'terminado')
  const tareasTerminadasCliente = tareasCliente.filter(t => t.estado === 'terminado')
  const reunionesVisitasCliente = state.tareas.filter(t => t.idCliente === idCliente && t.tipo !== 'tarea')

  // ── Por persona ──────────────────────────────────────────────────────────
  const procesosPersona = state.procesos.filter(p => p.fases.some(f => f.idsResponsables.includes(idEmpleado)))
  const tareasPersona = state.tareas.filter(t => t.idsResponsables.includes(idEmpleado) && t.tipo === 'tarea')
  const tareasActivasPersona = tareasPersona.filter(t => t.estado !== 'terminado')
  const tareasTerminadasPersona = tareasPersona.filter(t => t.estado === 'terminado')
  const reunionesVisitasPersona = state.tareas.filter(t => t.idsResponsables.includes(idEmpleado) && t.tipo !== 'tarea')

  // ── Por departamento ─────────────────────────────────────────────────────
  const procesosDepartamento = state.procesos.filter(p => p.fases.some(f => f.idDepartamento === idDepartamento))
  const tareasDepartamento = state.tareas.filter(t => t.idDepartamento === idDepartamento && t.tipo === 'tarea')
  const tareasActivasDepartamento = tareasDepartamento.filter(t => t.estado !== 'terminado')
  const tareasTerminadasDepartamento = tareasDepartamento.filter(t => t.estado === 'terminado')
  const reunionesVisitasDepartamento = state.tareas.filter(t => t.idDepartamento === idDepartamento && t.tipo !== 'tarea')

  const filasEmpleadoGantt = detectarConflictos(
    filasGanttEmpleado(state.procesos, state.tareas, idEmpleado, actions.nombreCliente),
    state.conflictosResueltos
  )
  const empleadoTieneConflicto = filasEmpleadoGantt.some(f => f.conflicto)
  const empleadosConConflicto = state.empleados
    .filter(e => e.id !== idEmpleado)
    .filter(e => detectarConflictos(filasGanttEmpleado(state.procesos, state.tareas, e.id, actions.nombreCliente), state.conflictosResueltos).some(f => f.conflicto))

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
        {([
          { key: 'cliente', label: '🏢 Por cliente' },
          { key: 'empleado', label: '🧑 Por persona' },
          { key: 'departamento', label: '🗂️ Por departamento' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cliente' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select value={idCliente} onChange={e => setIdCliente(e.target.value)} className={inputCls}>
                {state.clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button
                onClick={() => setMostrarCrearCliente(true)}
                className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm font-medium"
              >
                + Nuevo cliente
              </button>
            </div>
            {visualizacionToggle}
          </div>

          {visualizacion === 'gantt' && (
            <>
              <GanttChart filas={filasGanttCliente(state.procesos, state.tareas, idCliente)} />
              <GanttLegend />
            </>
          )}

          {visualizacion === 'quesos' && (
            <>
              {quesosControles}
              <WorkloadPieChart
                data={workloadClientePorEmpleado(state.procesos, state.tareas, idCliente, actions.nombreEmpleado, rango.desde, rango.hasta)}
                metrica={metrica}
              />
            </>
          )}

          {visualizacion === 'kanban' && (
            <div className="space-y-3">
              <CollapsibleSection title="Información del cliente" defaultOpen={false}>
                <ClienteInfoBlock idCliente={idCliente} />
              </CollapsibleSection>

              <ProcesosTareasBloque
                procesos={procesosCliente}
                procesosVacioTexto='Este cliente no tiene procesos importados. Usa "Importar plantilla" para añadir uno.'
                tareasActivas={tareasActivasCliente}
                tareasTerminadas={tareasTerminadasCliente}
                reunionesVisitas={reunionesVisitasCliente}
                vistaTareas={vistaTareas}
                onVistaTareasChange={setVistaTareas}
                onAbrirTarea={setTareaAbiertaId}
                onNuevaTarea={() => nuevaTarea({ idCliente })}
                onNuevaReunionVisita={() => nuevaTarea({ idCliente, tipo: 'reunion' })}
                onImportarPlantilla={() => setMostrarImportar(true)}
              />
            </div>
          )}

          <SlackClienteBlock idCliente={idCliente} />
        </div>
      )}

      {tab === 'empleado' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select value={idEmpleado} onChange={e => setIdEmpleado(e.target.value)} className={inputCls}>
              {state.empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            {visualizacionToggle}
          </div>

          {visualizacion === 'gantt' && (
            <>
              {!empleadoTieneConflicto && empleadosConConflicto.length > 0 && (
                <p className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  💡 {idEmpleado ? `${actions.nombreEmpleado(idEmpleado)} no tiene conflictos de carga ahora mismo, pero` : 'Se'} sí hay en:{' '}
                  {empleadosConConflicto.map((e, i) => (
                    <span key={e.id}>
                      <button onClick={() => setIdEmpleado(e.id)} className="underline hover:text-amber-300 font-medium">{e.nombre}</button>
                      {i < empleadosConConflicto.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                  .
                </p>
              )}
              <GanttChart filas={filasEmpleadoGantt} onConflictoClick={actions.toggleConflictoResuelto} />
              <GanttLegend mostrarConflictos />
            </>
          )}

          {visualizacion === 'quesos' && (
            <>
              {quesosControles}
              <WorkloadPieChart
                data={workloadEmpleadoPorCliente(state.procesos, state.tareas, idEmpleado, actions.nombreCliente, rango.desde, rango.hasta)}
                metrica={metrica}
              />
            </>
          )}

          {visualizacion === 'kanban' && (
            <ProcesosTareasBloque
              procesos={procesosPersona}
              procesosVacioTexto="Esta persona no participa en ningún proceso activo."
              tareasActivas={tareasActivasPersona}
              tareasTerminadas={tareasTerminadasPersona}
              reunionesVisitas={reunionesVisitasPersona}
              vistaTareas={vistaTareas}
              onVistaTareasChange={setVistaTareas}
              onAbrirTarea={setTareaAbiertaId}
              onNuevaTarea={() => nuevaTarea({ idsResponsables: [idEmpleado] })}
              onNuevaReunionVisita={() => nuevaTarea({ idsResponsables: [idEmpleado], tipo: 'reunion' })}
            />
          )}
        </div>
      )}

      {tab === 'departamento' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select value={idDepartamento} onChange={e => setIdDepartamento(e.target.value)} className={inputCls}>
              {state.departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            {visualizacionToggle}
          </div>

          {visualizacion === 'gantt' && (
            <>
              <GanttChart filas={filasGanttDepartamento(state.procesos, state.tareas, idDepartamento, actions.nombreCliente)} />
              <GanttLegend />
            </>
          )}

          {visualizacion === 'quesos' && (
            <>
              {quesosControles}
              <WorkloadPieChart
                data={workloadDepartamentoPorEmpleado(state.procesos, state.tareas, idDepartamento, actions.nombreEmpleado, rango.desde, rango.hasta)}
                metrica={metrica}
              />
            </>
          )}

          {visualizacion === 'kanban' && (
            <ProcesosTareasBloque
              procesos={procesosDepartamento}
              procesosVacioTexto="Este departamento no tiene procesos activos."
              tareasActivas={tareasActivasDepartamento}
              tareasTerminadas={tareasTerminadasDepartamento}
              reunionesVisitas={reunionesVisitasDepartamento}
              vistaTareas={vistaTareas}
              onVistaTareasChange={setVistaTareas}
              onAbrirTarea={setTareaAbiertaId}
              onNuevaTarea={() => nuevaTarea({ idDepartamento })}
              onNuevaReunionVisita={() => nuevaTarea({ idDepartamento, tipo: 'reunion' })}
            />
          )}
        </div>
      )}

      {mostrarImportar && <ImportarPlantillaModal idCliente={idCliente} onClose={() => setMostrarImportar(false)} />}
      {mostrarCrearCliente && (
        <CrearClienteModal
          onClose={() => setMostrarCrearCliente(false)}
          onCreado={idNuevoCliente => { setIdCliente(idNuevoCliente); setMostrarCrearCliente(false) }}
        />
      )}
      {tareaAbierta && <TareaDetailModal tarea={tareaAbierta} onClose={() => setTareaAbiertaId(null)} />}
    </div>
  )
}

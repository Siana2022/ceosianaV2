export default function GanttLegend({ mostrarConflictos = false }: { mostrarConflictos?: boolean }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
      <span><span className="inline-block w-3 h-3 rounded bg-gray-500 mr-1" />A la espera (tarea) / Bloqueada (fase)</span>
      <span><span className="inline-block w-3 h-3 rounded bg-blue-500 mr-1" />En proceso</span>
      <span><span className="inline-block w-3 h-3 rounded bg-green-500 mr-1" />Terminado</span>
      <span><span className="inline-block w-3 h-3 rounded bg-red-500 mr-1" />Bloqueada (tarea)</span>
      <span><span className="inline-block w-3 h-3 rounded-full bg-gray-400 mr-1" />Tarea suelta (marcador en su fecha límite)</span>
      <span><span className="inline-block w-0.5 h-3 bg-blue-500 mr-1.5 align-middle" />Hoy</span>
      {mostrarConflictos && (
        <span>
          <span className="inline-block w-3 h-3 rounded bg-amber-500 border-2 border-dashed border-red-400 mr-1" />
          Conflicto de carga (clic para marcar resuelto)
        </span>
      )}
    </div>
  )
}

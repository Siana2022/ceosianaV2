'use client'

import { useState } from 'react'
import { useTareas } from '../store'
import type { Plantilla, PlantillaFase } from '../types'

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

function NuevaPlantillaModal({ onClose }: { onClose: () => void }) {
  const { actions } = useTareas()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipoServicio, setTipoServicio] = useState('')

  const guardar = () => {
    if (!nombre.trim()) return
    actions.crearPlantilla(nombre.trim(), descripcion.trim(), tipoServicio.trim() || null)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Nueva plantilla</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: Plantilla SEO" className={inputCls} autoFocus />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Tipo de servicio asociado</label>
            <input value={tipoServicio} onChange={e => setTipoServicio(e.target.value)} placeholder="ej: SEO" className={inputCls} />
            <p className="text-gray-600 text-xs mt-1">Se usará para sugerir esta plantilla al importar según los servicios contratados del cliente.</p>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Descripción</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={!nombre.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium">
              Crear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FilaFase({ idPlantilla, fase, esPrimera, esUltima }: { idPlantilla: string; fase: PlantillaFase; esPrimera: boolean; esUltima: boolean }) {
  const { state, actions } = useTareas()

  return (
    <div className="grid grid-cols-[auto_1.5fr_1fr_1fr_90px_auto] gap-2 items-center bg-gray-800/50 rounded-lg px-3 py-2">
      <div className="flex flex-col gap-0.5 text-gray-500">
        <button onClick={() => actions.moverFasePlantilla(idPlantilla, fase.id, -1)} disabled={esPrimera} className="disabled:opacity-20 hover:text-white leading-none">▲</button>
        <button onClick={() => actions.moverFasePlantilla(idPlantilla, fase.id, 1)} disabled={esUltima} className="disabled:opacity-20 hover:text-white leading-none">▼</button>
      </div>
      <input
        value={fase.nombre}
        onChange={e => actions.actualizarFasePlantilla(idPlantilla, fase.id, { nombre: e.target.value })}
        className={`${inputCls} py-1.5`}
      />
      <select
        value={fase.idDepartamentoDefault ?? ''}
        onChange={e => actions.actualizarFasePlantilla(idPlantilla, fase.id, { idDepartamentoDefault: e.target.value || null })}
        className={`${inputCls} py-1.5`}
      >
        <option value="">Sin depto.</option>
        {state.departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
      </select>
      <select
        value={fase.idResponsableDefault ?? ''}
        onChange={e => actions.actualizarFasePlantilla(idPlantilla, fase.id, { idResponsableDefault: e.target.value || null })}
        className={`${inputCls} py-1.5`}
      >
        <option value="">Sin resp.</option>
        {state.empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
      </select>
      <input
        type="number"
        min={0}
        value={fase.duracionDias}
        onChange={e => actions.actualizarFasePlantilla(idPlantilla, fase.id, { duracionDias: parseInt(e.target.value) || 0 })}
        className={`${inputCls} py-1.5 text-center`}
        title="Duración estimada en días"
      />
      <button onClick={() => actions.eliminarFasePlantilla(idPlantilla, fase.id)} className="text-gray-500 hover:text-red-400 text-xs px-2">
        Quitar
      </button>
    </div>
  )
}

function NombrePlantillaEditable({ plantilla }: { plantilla: Plantilla }) {
  const { actions } = useTareas()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(plantilla.nombre)

  const guardar = () => {
    const trimmed = nombre.trim()
    if (trimmed && trimmed !== plantilla.nombre) actions.renombrarPlantilla(plantilla.id, trimmed)
    else setNombre(plantilla.nombre)
    setEditando(false)
  }

  if (editando) {
    return (
      <input
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        onBlur={guardar}
        onKeyDown={e => {
          if (e.key === 'Enter') guardar()
          if (e.key === 'Escape') { setNombre(plantilla.nombre); setEditando(false) }
        }}
        className="bg-gray-800 border border-blue-500 rounded px-2 py-0.5 text-white font-medium text-sm focus:outline-none"
        autoFocus
        onClick={e => e.stopPropagation()}
      />
    )
  }

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      <h3 className="text-white font-medium">{plantilla.nombre}</h3>
      <button
        onClick={() => setEditando(true)}
        className="text-gray-600 hover:text-gray-400 text-xs px-1"
        title="Renombrar plantilla"
      >
        ✏️
      </button>
    </div>
  )
}

function EditorFases({ idPlantilla }: { idPlantilla: string }) {
  const { state, actions } = useTareas()
  const plantilla = state.plantillas.find(p => p.id === idPlantilla)
  const [nombreFase, setNombreFase] = useState('')

  if (!plantilla) return null
  const fases = [...plantilla.fases].sort((a, b) => a.orden - b.orden)

  const addFase = () => {
    if (!nombreFase.trim()) return
    actions.agregarFasePlantilla(idPlantilla, {
      nombre: nombreFase.trim(),
      idDepartamentoDefault: null,
      idResponsableDefault: null,
      duracionDias: 3,
    })
    setNombreFase('')
  }

  return (
    <div className="border-t border-gray-800 mt-3 pt-3 space-y-2">
      {fases.length === 0 && <p className="text-gray-600 text-xs">Sin fases todavía. Añade la primera abajo.</p>}
      {fases.length > 0 && (
        <div className="grid grid-cols-[auto_1.5fr_1fr_1fr_90px_auto] gap-2 px-3 text-[11px] text-gray-500 uppercase tracking-wide">
          <span></span>
          <span>Fase</span>
          <span>Departamento</span>
          <span>Responsable</span>
          <span>Días</span>
          <span></span>
        </div>
      )}
      {fases.map((f, idx) => (
        <FilaFase key={f.id} idPlantilla={idPlantilla} fase={f} esPrimera={idx === 0} esUltima={idx === fases.length - 1} />
      ))}
      <div className="flex gap-2 pt-1">
        <input
          value={nombreFase}
          onChange={e => setNombreFase(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addFase()}
          placeholder="Nombre de la nueva fase..."
          className={inputCls}
        />
        <button onClick={addFase} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm flex-shrink-0">+ Añadir fase</button>
      </div>
    </div>
  )
}

export default function PlantillasPage() {
  const { state, actions } = useTareas()
  const [expandidaId, setExpandidaId] = useState<string | null>(state.plantillas[0]?.id ?? null)
  const [mostrarNueva, setMostrarNueva] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">Define los procesos estándar que luego se importan en cada cliente.</p>
        <button onClick={() => setMostrarNueva(true)} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium">
          + Nueva plantilla
        </button>
      </div>

      <div className="space-y-3">
        {state.plantillas.map(p => {
          const expandida = expandidaId === p.id
          return (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => setExpandidaId(expandida ? null : p.id)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">{expandida ? '▾' : '▸'}</span>
                    <NombrePlantillaEditable plantilla={p} />
                    {p.tipoServicio && (
                      <span className="bg-purple-500/20 text-purple-300 text-[11px] px-2 py-0.5 rounded-full">{p.tipoServicio}</span>
                    )}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${p.activo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {p.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  {p.descripcion && <p className="text-gray-500 text-xs mt-1 ml-5">{p.descripcion}</p>}
                  <p className="text-gray-600 text-xs mt-1 ml-5">{p.fases.length} fase(s)</p>
                </button>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => actions.toggleActivaPlantilla(p.id)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => actions.eliminarPlantilla(p.id)} className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-gray-700">
                    Eliminar
                  </button>
                </div>
              </div>
              {expandida && <EditorFases idPlantilla={p.id} />}
            </div>
          )
        })}
      </div>

      {mostrarNueva && <NuevaPlantillaModal onClose={() => setMostrarNueva(false)} />}
    </div>
  )
}

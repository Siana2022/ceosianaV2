'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  MOCK_CLIENTES,
  MOCK_DEPARTAMENTOS,
  MOCK_EMPLEADOS,
  MOCK_ENLACES_CLIENTE,
  MOCK_PLANTILLAS,
  MOCK_SERVICIOS,
  MOCK_SLACK_CLIENTE,
  RECURRENCIA_DIAS,
  generarFasesDesdeplantilla,
  nombrePorId,
} from './mockData'
import { addDays, diffDias, formatFecha } from './dateUtils'
import type {
  Adjunto,
  ChatMensaje,
  Cliente,
  Departamento,
  Empleado,
  EstadoFase,
  EstadoTarea,
  ImagenAdjunta,
  Plantilla,
  PlantillaFase,
  Proceso,
  ProcesoFase,
  Servicio,
  Tarea,
} from './types'

interface TareasState {
  clientes: Cliente[]
  empleados: Empleado[]
  departamentos: Departamento[]
  servicios: Servicio[]
  plantillas: Plantilla[]
  procesos: Proceso[]
  tareas: Tarea[]
  enlacesCliente: Record<string, Adjunto[]>
  slackCliente: Record<string, string>
  conflictosResueltos: Set<string>
}

interface TareasActions {
  // Clientes
  crearCliente: (nombre: string, tiposServicio: string[]) => string

  // Plantillas
  crearPlantilla: (nombre: string, descripcion: string, tipoServicio: string | null) => void
  eliminarPlantilla: (idPlantilla: string) => void
  toggleActivaPlantilla: (idPlantilla: string) => void
  agregarFasePlantilla: (idPlantilla: string, fase: Omit<PlantillaFase, 'id' | 'orden'>) => void
  actualizarFasePlantilla: (idPlantilla: string, idFase: string, cambios: Partial<PlantillaFase>) => void
  eliminarFasePlantilla: (idPlantilla: string, idFase: string) => void
  moverFasePlantilla: (idPlantilla: string, idFase: string, direccion: -1 | 1) => void

  // Procesos (kanban por cliente)
  importarPlantilla: (idCliente: string, idServicio: string | null, idPlantilla: string) => void
  agregarFaseProceso: (idProceso: string, fase: {
    nombre: string
    idDepartamento: string | null
    idsResponsables: string[]
    fechaInicioPrevista: string
    fechaFinPrevista: string
  }) => void
  actualizarFaseProceso: (idProceso: string, idFase: string, cambios: Partial<ProcesoFase>) => void
  moverFaseProceso: (idProceso: string, idFase: string, direccion: -1 | 1) => void
  marcarFaseTerminada: (idProceso: string, idFase: string) => void
  volverFaseAnterior: (idProceso: string, idFase: string) => void
  addAdjuntoFase: (idProceso: string, idFase: string, adjunto: Omit<Adjunto, 'id'>) => void
  eliminarAdjuntoFase: (idProceso: string, idFase: string, idAdjunto: string) => void
  toggleTimerFase: (idProceso: string, idFase: string) => void
  setMinutosFase: (idProceso: string, idFase: string, minutos: number) => void
  addChatMensajeFase: (idProceso: string, idFase: string, texto: string, mencionesIds: string[]) => void

  // Tareas sueltas
  crearTarea: (tarea: Omit<Tarea, 'id' | 'chat' | 'minutosAcumulados' | 'timerActivo'>) => string
  actualizarTarea: (idTarea: string, cambios: Partial<Tarea>) => void
  notificarBloqueoTarea: (idTarea: string, explicacion: string) => void
  toggleTimerTarea: (idTarea: string) => void
  setMinutosTarea: (idTarea: string, minutos: number) => void
  addChatMensajeTarea: (idTarea: string, texto: string, mencionesIds: string[]) => void
  addAdjuntoTarea: (idTarea: string, adjunto: Omit<Adjunto, 'id'>) => void
  eliminarAdjuntoTarea: (idTarea: string, idAdjunto: string) => void
  addImagenTarea: (idTarea: string, imagen: Omit<ImagenAdjunta, 'id'>) => void
  eliminarImagenTarea: (idTarea: string, idImagen: string) => void
  eliminarTarea: (idTarea: string) => void

  // Información general del cliente (enlaces manuales tipo Drive/Looker Studio)
  addEnlaceCliente: (idCliente: string, adjunto: Omit<Adjunto, 'id'>) => void
  eliminarEnlaceCliente: (idCliente: string, idAdjunto: string) => void
  setSlackCliente: (idCliente: string, url: string) => void

  // Conflictos de carga de trabajo en el Gantt por empleado
  toggleConflictoResuelto: (clave: string) => void

  nombreEmpleado: (id: string | null) => string
  nombreDepartamento: (id: string | null) => string
  nombreCliente: (id: string | null) => string
  nombresEmpleados: (ids: string[]) => string
}

interface ToastItem {
  id: string
  mensaje: string
}

interface TareasContextValue {
  state: TareasState
  actions: TareasActions
  toasts: ToastItem[]
}

const TareasContext = createContext<TareasContextValue | null>(null)

let idCounter = 0
function nextId(prefix: string) {
  idCounter += 1
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`
}

// Fire-and-forget helpers para persistir cambios en la BD sin bloquear la UI.
function dbPost(url: string, body: object) {
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(e => console.error('[procesos] POST error', url, e))
}

function dbPatch(url: string, body: object) {
  fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(e => console.error('[procesos] PATCH error', url, e))
}

interface TareasProviderProps {
  children: ReactNode
  initialClientes?: Cliente[]
  initialEmpleados?: Empleado[]
  initialDepartamentos?: Departamento[]
  initialServicios?: Servicio[]
  initialTareas?: Tarea[]
  initialProcesos?: Proceso[]
  initialPlantillas?: Plantilla[]
}

export function TareasProvider({
  children,
  initialClientes,
  initialEmpleados,
  initialDepartamentos,
  initialServicios,
  initialTareas,
  initialProcesos,
  initialPlantillas,
}: TareasProviderProps) {
  const [clientes, setClientes] = useState<Cliente[]>(initialClientes ?? MOCK_CLIENTES)
  const [empleados] = useState<Empleado[]>(initialEmpleados ?? MOCK_EMPLEADOS)
  const [departamentos] = useState<Departamento[]>(initialDepartamentos ?? MOCK_DEPARTAMENTOS)
  const [servicios, setServicios] = useState<Servicio[]>(initialServicios ?? MOCK_SERVICIOS)
  const [plantillas, setPlantillas] = useState<Plantilla[]>(initialPlantillas ?? [])
  const [procesos, setProcesos] = useState<Proceso[]>(initialProcesos ?? [])
  const [tareas, setTareas] = useState<Tarea[]>(initialTareas ?? [])
  const [enlacesCliente, setEnlacesCliente] = useState<Record<string, Adjunto[]>>(MOCK_ENLACES_CLIENTE)
  const [slackCliente, setSlackClienteState] = useState<Record<string, string>>(MOCK_SLACK_CLIENTE)
  const [conflictosResueltos, setConflictosResueltos] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Restaurar timerActivo desde localStorage al montar (no se persiste en DB)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ceosiana_timer_v2')
      if (!saved) return
      const { tareaId } = JSON.parse(saved)
      if (!tareaId) return
      setTareas(prev => prev.map(t => t.id === tareaId ? { ...t, timerActivo: true } : t))
    } catch {}
  }, [])
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const pushToast = useCallback((mensaje: string) => {
    const id = nextId('toast')
    setToasts(prev => [...prev, { id, mensaje }])
    toastTimers.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      delete toastTimers.current[id]
    }, 4000)
  }, [])

  const nombreEmpleado = useCallback((id: string | null) => nombrePorId(empleados, id), [empleados])
  const nombreDepartamento = useCallback((id: string | null) => nombrePorId(departamentos, id), [departamentos])
  const nombreCliente = useCallback((id: string | null) => nombrePorId(clientes, id), [clientes])
  const nombresEmpleados = useCallback((ids: string[]) => (
    ids.length === 0 ? 'Sin asignar' : ids.map(id => nombrePorId(empleados, id)).join(', ')
  ), [empleados])

  // ── Clientes ─────────────────────────────────────────────────────────────
  const crearCliente = useCallback((nombre: string, tiposServicio: string[]) => {
    const idCliente = nextId('cli')
    setClientes(prev => [...prev, { id: idCliente, nombre }])
    if (tiposServicio.length > 0) {
      setServicios(prev => [
        ...prev,
        ...tiposServicio.map(t => ({ id: nextId('srv'), idCliente, nombre: t, tipoServicio: t })),
      ])
    }
    pushToast(`Cliente "${nombre}" creado${tiposServicio.length > 0 ? ` con ${tiposServicio.length} servicio(s) contratado(s)` : ''}.`)
    return idCliente
  }, [pushToast])

  // ── Plantillas ──────────────────────────────────────────────────────────
  const crearPlantilla = useCallback((nombre: string, descripcion: string, tipoServicio: string | null) => {
    const id = crypto.randomUUID()
    setPlantillas(prev => [...prev, { id, nombre, descripcion, tipoServicio, activo: true, fases: [] }])
    dbPost('/api/plantillas', { id, nombre, descripcion, tipoServicio, activo: true, fases: [] })
  }, [])

  const eliminarPlantilla = useCallback((idPlantilla: string) => {
    setPlantillas(prev => prev.filter(p => p.id !== idPlantilla))
    fetch(`/api/plantillas?id=${idPlantilla}`, { method: 'DELETE' }).catch(e => console.error('[plantillas] DELETE error', e))
  }, [])

  const toggleActivaPlantilla = useCallback((idPlantilla: string) => {
    setPlantillas(prev => prev.map(p => {
      if (p.id !== idPlantilla) return p
      const updated = { ...p, activo: !p.activo }
      dbPatch(`/api/plantillas?id=${idPlantilla}`, { activo: updated.activo })
      return updated
    }))
  }, [])

  const agregarFasePlantilla = useCallback((idPlantilla: string, fase: Omit<PlantillaFase, 'id' | 'orden'>) => {
    const plantilla = plantillas.find(p => p.id === idPlantilla)
    if (!plantilla) return
    const nuevaFase: PlantillaFase = { ...fase, id: crypto.randomUUID(), orden: plantilla.fases.length + 1 }
    const nuevasFases = [...plantilla.fases, nuevaFase]
    setPlantillas(prev => prev.map(p => p.id !== idPlantilla ? p : { ...p, fases: nuevasFases }))
    dbPatch(`/api/plantillas?id=${idPlantilla}`, { fases: nuevasFases })
  }, [plantillas])

  const actualizarFasePlantilla = useCallback((idPlantilla: string, idFase: string, cambios: Partial<PlantillaFase>) => {
    const plantilla = plantillas.find(p => p.id === idPlantilla)
    if (!plantilla) return
    const nuevasFases = plantilla.fases.map(f => f.id === idFase ? { ...f, ...cambios } : f)
    setPlantillas(prev => prev.map(p => p.id !== idPlantilla ? p : { ...p, fases: nuevasFases }))
    dbPatch(`/api/plantillas?id=${idPlantilla}`, { fases: nuevasFases })
  }, [plantillas])

  const eliminarFasePlantilla = useCallback((idPlantilla: string, idFase: string) => {
    const plantilla = plantillas.find(p => p.id === idPlantilla)
    if (!plantilla) return
    const nuevasFases = plantilla.fases
      .filter(f => f.id !== idFase)
      .sort((a, b) => a.orden - b.orden)
      .map((f, idx) => ({ ...f, orden: idx + 1 }))
    setPlantillas(prev => prev.map(p => p.id !== idPlantilla ? p : { ...p, fases: nuevasFases }))
    dbPatch(`/api/plantillas?id=${idPlantilla}`, { fases: nuevasFases })
  }, [plantillas])

  const moverFasePlantilla = useCallback((idPlantilla: string, idFase: string, direccion: -1 | 1) => {
    const plantilla = plantillas.find(p => p.id === idPlantilla)
    if (!plantilla) return
    const ordenadas = [...plantilla.fases].sort((a, b) => a.orden - b.orden)
    const idx = ordenadas.findIndex(f => f.id === idFase)
    const destino = idx + direccion
    if (idx === -1 || destino < 0 || destino >= ordenadas.length) return
    const tmp = ordenadas[idx].orden
    ordenadas[idx].orden = ordenadas[destino].orden
    ordenadas[destino].orden = tmp
    setPlantillas(prev => prev.map(p => p.id !== idPlantilla ? p : { ...p, fases: ordenadas }))
    dbPatch(`/api/plantillas?id=${idPlantilla}`, { fases: ordenadas })
  }, [plantillas])

  // ── Procesos (kanban) ───────────────────────────────────────────────────
  const importarPlantilla = useCallback((idCliente: string, idServicio: string | null, idPlantilla: string) => {
    const plantilla = plantillas.find(p => p.id === idPlantilla)
    if (!plantilla) return
    const hoy = new Date().toISOString().slice(0, 10)
    const fases = generarFasesDesdeplantilla(plantilla, hoy)
    const nuevo: Proceso = {
      id: crypto.randomUUID(),
      idCliente,
      idServicio,
      idPlantilla: plantilla.id,
      nombre: plantilla.nombre.replace(/^Plantilla /, ''),
      fases,
    }
    setProcesos(prev => [...prev, nuevo])
    dbPost('/api/procesos', nuevo)
    pushToast(`Proceso "${nuevo.nombre}" importado. Primera fase asignada a ${nombresEmpleados(fases[0]?.idsResponsables ?? [])}.`)
  }, [plantillas, pushToast, nombresEmpleados])

  const agregarFaseProceso = useCallback((idProceso: string, fase: {
    nombre: string
    idDepartamento: string | null
    idsResponsables: string[]
    fechaInicioPrevista: string
    fechaFinPrevista: string
  }) => {
    let fasesDB: ProcesoFase[] | null = null
    setProcesos(prev => prev.map(p => {
      if (p.id !== idProceso) return p
      const orden = p.fases.length > 0 ? Math.max(...p.fases.map(f => f.orden)) + 1 : 1
      const estado: EstadoFase = p.fases.length === 0 ? 'proceso' : 'espera'
      const nueva: ProcesoFase = {
        id: nextId('procfase'),
        nombre: fase.nombre,
        orden,
        idDepartamento: fase.idDepartamento,
        idsResponsables: fase.idsResponsables,
        fechaInicioPrevista: fase.fechaInicioPrevista,
        fechaFinPrevista: fase.fechaFinPrevista,
        estado,
        fechaCompletado: null,
        adjuntos: [],
        minutosAcumulados: 0,
        timerActivo: false,
        descripcion: '',
        chat: [],
      }
      const nuevasFases = [...p.fases, nueva]
      fasesDB = nuevasFases
      return { ...p, fases: nuevasFases }
    }))
    if (fasesDB) dbPatch(`/api/procesos?id=${idProceso}`, { fases: fasesDB })
  }, [])

  // Si se retrasa/adelanta la fecha fin prevista de una fase, desplaza en cadena el inicio (y fin) de las
  // fases siguientes por el mismo número de días, para mantener sus duraciones y evitar solapes.
  const actualizarFaseProceso = useCallback((idProceso: string, idFase: string, cambios: Partial<ProcesoFase>) => {
    let fasesDB: ProcesoFase[] | null = null
    setProcesos(prev => prev.map(p => {
      if (p.id !== idProceso) return p
      let nuevasFases: ProcesoFase[]
      if (cambios.fechaFinPrevista === undefined) {
        nuevasFases = p.fases.map(f => f.id === idFase ? { ...f, ...cambios } : f)
      } else {
        const ordenadas = [...p.fases].sort((a, b) => a.orden - b.orden)
        const idx = ordenadas.findIndex(f => f.id === idFase)
        if (idx === -1) return p
        const delta = diffDias(ordenadas[idx].fechaFinPrevista, cambios.fechaFinPrevista)
        nuevasFases = ordenadas.map((f, i) => {
          if (i === idx) return { ...f, ...cambios }
          if (i > idx && delta !== 0) {
            return { ...f, fechaInicioPrevista: addDays(f.fechaInicioPrevista, delta), fechaFinPrevista: addDays(f.fechaFinPrevista, delta) }
          }
          return f
        })
      }
      fasesDB = nuevasFases
      return { ...p, fases: nuevasFases }
    }))
    if (fasesDB) dbPatch(`/api/procesos?id=${idProceso}`, { fases: fasesDB })
  }, [])

  const moverFaseProceso = useCallback((idProceso: string, idFase: string, direccion: -1 | 1) => {
    let fasesDB: ProcesoFase[] | null = null
    setProcesos(prev => prev.map(p => {
      if (p.id !== idProceso) return p
      const ordenadas = [...p.fases].sort((a, b) => a.orden - b.orden)
      const idx = ordenadas.findIndex(f => f.id === idFase)
      const destino = idx + direccion
      if (idx === -1 || destino < 0 || destino >= ordenadas.length) return p
      const tmp = ordenadas[idx].orden
      ordenadas[idx].orden = ordenadas[destino].orden
      ordenadas[destino].orden = tmp
      fasesDB = ordenadas
      return { ...p, fases: ordenadas }
    }))
    if (fasesDB) dbPatch(`/api/procesos?id=${idProceso}`, { fases: fasesDB })
  }, [])

  const setMinutosFase = useCallback((idProceso: string, idFase: string, minutos: number) => {
    setProcesos(prev => prev.map(p => {
      if (p.id !== idProceso) return p
      return { ...p, fases: p.fases.map(f => f.id === idFase ? { ...f, minutosAcumulados: Math.max(0, minutos) } : f) }
    }))
  }, [])

  const marcarFaseTerminada = useCallback((idProceso: string, idFase: string) => {
    let siguienteResponsables: string[] | null = null
    let siguienteNombre = ''
    let clienteNombre = ''
    let fasesDB: ProcesoFase[] | null = null
    setProcesos(prev => prev.map(p => {
      if (p.id !== idProceso) return p
      const ordenadas = [...p.fases].sort((a, b) => a.orden - b.orden)
      const idx = ordenadas.findIndex(f => f.id === idFase)
      if (idx === -1) return p
      const hoy = new Date().toISOString().slice(0, 10)
      const nuevasFases = ordenadas.map((f, i) => {
        if (i === idx) return { ...f, estado: 'terminado' as EstadoFase, fechaCompletado: hoy }
        if (i === idx + 1 && f.estado === 'espera') {
          siguienteResponsables = f.idsResponsables
          siguienteNombre = f.nombre
          return { ...f, estado: 'proceso' as EstadoFase }
        }
        return f
      })
      clienteNombre = p.nombre
      fasesDB = nuevasFases
      return { ...p, fases: nuevasFases }
    }))
    if (fasesDB) dbPatch(`/api/procesos?id=${idProceso}`, { fases: fasesDB })
    if (siguienteResponsables) {
      pushToast(`🔔 Notificación simulada (Slack + email) a ${nombresEmpleados(siguienteResponsables)}: puede empezar "${siguienteNombre}" en ${clienteNombre}.`)
    } else {
      pushToast(`Fase completada. Era la última fase de "${clienteNombre}".`)
    }
  }, [pushToast, nombresEmpleados])

  const volverFaseAnterior = useCallback((idProceso: string, idFase: string) => {
    let anteriorResponsables: string[] | null = null
    let anteriorNombre = ''
    let clienteNombre = ''
    let fasesDB: ProcesoFase[] | null = null
    setProcesos(prev => prev.map(p => {
      if (p.id !== idProceso) return p
      const ordenadas = [...p.fases].sort((a, b) => a.orden - b.orden)
      const idx = ordenadas.findIndex(f => f.id === idFase)
      if (idx <= 0) return p
      const nuevasFases = ordenadas.map((f, i) => {
        if (i === idx) return { ...f, estado: 'espera' as EstadoFase, fechaCompletado: null }
        if (i === idx - 1) {
          anteriorResponsables = f.idsResponsables
          anteriorNombre = f.nombre
          return { ...f, estado: 'proceso' as EstadoFase, fechaCompletado: null }
        }
        return f
      })
      clienteNombre = p.nombre
      fasesDB = nuevasFases
      return { ...p, fases: nuevasFases }
    }))
    if (fasesDB) dbPatch(`/api/procesos?id=${idProceso}`, { fases: fasesDB })
    if (anteriorNombre) {
      pushToast(`🔔 Notificación simulada (Slack + email) a ${nombresEmpleados(anteriorResponsables ?? [])}: hay que retomar "${anteriorNombre}" en ${clienteNombre}.`)
    }
  }, [pushToast, nombresEmpleados])

  const addAdjuntoFase = useCallback((idProceso: string, idFase: string, adjunto: Omit<Adjunto, 'id'>) => {
    let fasesDB: ProcesoFase[] | null = null
    setProcesos(prev => prev.map(p => {
      if (p.id !== idProceso) return p
      const nuevasFases = p.fases.map(f => f.id === idFase ? { ...f, adjuntos: [...f.adjuntos, { ...adjunto, id: nextId('adj') }] } : f)
      fasesDB = nuevasFases
      return { ...p, fases: nuevasFases }
    }))
    if (fasesDB) dbPatch(`/api/procesos?id=${idProceso}`, { fases: fasesDB })
  }, [])

  const eliminarAdjuntoFase = useCallback((idProceso: string, idFase: string, idAdjunto: string) => {
    let fasesDB: ProcesoFase[] | null = null
    setProcesos(prev => prev.map(p => {
      if (p.id !== idProceso) return p
      const nuevasFases = p.fases.map(f => f.id === idFase ? { ...f, adjuntos: f.adjuntos.filter(a => a.id !== idAdjunto) } : f)
      fasesDB = nuevasFases
      return { ...p, fases: nuevasFases }
    }))
    if (fasesDB) dbPatch(`/api/procesos?id=${idProceso}`, { fases: fasesDB })
  }, [])

  const toggleTimerFase = useCallback((idProceso: string, idFase: string) => {
    let activado = false
    setProcesos(prev => prev.map(p => {
      if (p.id !== idProceso) return p
      return {
        ...p,
        fases: p.fases.map(f => {
          if (f.id !== idFase) return f
          activado = !f.timerActivo
          return { ...f, timerActivo: !f.timerActivo, minutosAcumulados: f.timerActivo ? f.minutosAcumulados + 1 : f.minutosAcumulados }
        }),
      }
    }))
    pushToast(activado ? '⏱️ Fichaje iniciado para esta tarjeta (simulado, se vincularía con /fichar).' : '⏱️ Fichaje pausado.')
  }, [pushToast])

  const addChatMensajeFase = useCallback((idProceso: string, idFase: string, texto: string, mencionesIds: string[]) => {
    const msg: ChatMensaje = { id: nextId('chat'), autorId: 'emp-1', texto, mencionesIds, fecha: new Date().toISOString().slice(0, 10) }
    let fasesDB: ProcesoFase[] | null = null
    setProcesos(prev => prev.map(p => {
      if (p.id !== idProceso) return p
      const nuevasFases = p.fases.map(f => f.id === idFase ? { ...f, chat: [...f.chat, msg] } : f)
      fasesDB = nuevasFases
      return { ...p, fases: nuevasFases }
    }))
    if (fasesDB) dbPatch(`/api/procesos?id=${idProceso}`, { fases: fasesDB })
    if (mencionesIds.length > 0) {
      pushToast(`🔔 Notificación Slack simulada enviada a ${mencionesIds.map(id => nombreEmpleado(id)).join(', ')}.`)
    }
  }, [pushToast, nombreEmpleado])

  // ── Tareas sueltas ──────────────────────────────────────────────────────
  const crearTarea = useCallback((tarea: Omit<Tarea, 'id' | 'chat' | 'minutosAcumulados' | 'timerActivo'>) => {
    const id = crypto.randomUUID()
    const nueva: Tarea = { ...tarea, id, chat: [], minutosAcumulados: 0, timerActivo: false }
    setTareas(prev => [...prev, nueva])
    const { imagenes: _img, ...toPost } = nueva as Tarea & { imagenes?: unknown }
    dbPost('/api/tareas', toPost)
    return id
  }, [])

  const actualizarTarea = useCallback((idTarea: string, cambios: Partial<Tarea>) => {
    const original = tareas.find(t => t.id === idTarea)
    const seCompletaAhora = cambios.estado === 'terminado' && original?.estado !== 'terminado'
    const debeRegenerar = Boolean(seCompletaAhora && original && original.recurrencia !== 'ninguna')

    const nuevaTareaRecurrente: Tarea | null = debeRegenerar && original ? {
      ...original,
      id: crypto.randomUUID(),
      fechaLimite: addDays(original.fechaLimite, RECURRENCIA_DIAS[original.recurrencia]),
      estado: 'espera',
      explicacionBloqueo: null,
      chat: [],
      imagenes: [],
      minutosAcumulados: 0,
      timerActivo: false,
    } : null

    setTareas(prev => {
      const actualizadas = prev.map(t => t.id === idTarea ? { ...t, ...cambios } : t)
      if (!nuevaTareaRecurrente) return actualizadas
      return [...actualizadas, nuevaTareaRecurrente]
    })

    // Persist to DB: skip timer state (ephemeral) and imagenes (base64, too large)
    const SKIP = new Set(['timerActivo', 'imagenes'])
    const persistibles = Object.fromEntries(Object.entries(cambios).filter(([k]) => !SKIP.has(k)))
    if (Object.keys(persistibles).length > 0) {
      dbPatch(`/api/tareas?id=${idTarea}`, persistibles)
    }
    if (nuevaTareaRecurrente) {
      const r = nuevaTareaRecurrente as unknown as Record<string, unknown>
      const { timerActivo: _ta, imagenes: _img, ...toPost } = r
      dbPost('/api/tareas', toPost)
    }

    if (cambios.estado === 'bloqueada') {
      pushToast(`🔔 Notificación simulada al responsable del proyecto: "${original?.nombre ?? 'Tarea'}" se ha bloqueado.`)
    }
    if (debeRegenerar && original) {
      const proxima = addDays(original.fechaLimite, RECURRENCIA_DIAS[original.recurrencia])
      pushToast(`🔁 Tarea recurrente: se generó una nueva "${original.nombre}" con fecha límite ${formatFecha(proxima)}.`)
    }
  }, [tareas, pushToast])

  const notificarBloqueoTarea = useCallback((idTarea: string, explicacion: string) => {
    setTareas(prev => prev.map(t => t.id === idTarea ? { ...t, explicacionBloqueo: explicacion } : t))
    dbPatch(`/api/tareas?id=${idTarea}`, { explicacionBloqueo: explicacion })
    const t = tareas.find(x => x.id === idTarea)
    pushToast(`🔔 Notificación simulada (Slack + email) al responsable del proyecto: "${t?.nombre ?? 'Tarea'}" está bloqueada — ${explicacion.trim() || 'sin detalle todavía'}.`)
  }, [tareas, pushToast])

  const toggleTimerTarea = useCallback((idTarea: string) => {
    let activado = false
    setTareas(prev => prev.map(t => {
      if (t.id !== idTarea) return t
      activado = !t.timerActivo
      return { ...t, timerActivo: !t.timerActivo, minutosAcumulados: t.timerActivo ? t.minutosAcumulados + 1 : t.minutosAcumulados }
    }))
    pushToast(activado ? '⏱️ Fichaje iniciado para esta tarea (simulado, se vincularía con /fichar).' : '⏱️ Fichaje pausado.')
  }, [pushToast])

  const setMinutosTarea = useCallback((idTarea: string, minutos: number) => {
    const validMinutos = Math.max(0, minutos)
    setTareas(prev => prev.map(t => t.id === idTarea ? { ...t, minutosAcumulados: validMinutos } : t))
    dbPatch(`/api/tareas?id=${idTarea}`, { minutosAcumulados: validMinutos })
  }, [])

  const addChatMensajeTarea = useCallback((idTarea: string, texto: string, mencionesIds: string[]) => {
    const msg: ChatMensaje = { id: nextId('chat'), autorId: 'emp-1', texto, mencionesIds, fecha: new Date().toISOString().slice(0, 10) }
    setTareas(prev => prev.map(t => t.id === idTarea ? { ...t, chat: [...t.chat, msg] } : t))
    dbPatch(`/api/tareas?id=${idTarea}`, { chat: [...(tareas.find(t => t.id === idTarea)?.chat ?? []), msg] })
    if (mencionesIds.length > 0) {
      pushToast(`🔔 Notificación Slack simulada enviada a ${mencionesIds.map(id => nombreEmpleado(id)).join(', ')}.`)
    }
  }, [pushToast, nombreEmpleado, tareas])

  const addAdjuntoTarea = useCallback((idTarea: string, adjunto: Omit<Adjunto, 'id'>) => {
    const nuevo = { ...adjunto, id: nextId('adj') }
    setTareas(prev => prev.map(t => t.id === idTarea ? { ...t, adjuntos: [...t.adjuntos, nuevo] } : t))
    const tarea = tareas.find(t => t.id === idTarea)
    if (tarea) dbPatch(`/api/tareas?id=${idTarea}`, { adjuntos: [...tarea.adjuntos, nuevo] })
  }, [tareas])

  const eliminarAdjuntoTarea = useCallback((idTarea: string, idAdjunto: string) => {
    setTareas(prev => prev.map(t => t.id === idTarea ? { ...t, adjuntos: t.adjuntos.filter(a => a.id !== idAdjunto) } : t))
    const tarea = tareas.find(t => t.id === idTarea)
    if (tarea) dbPatch(`/api/tareas?id=${idTarea}`, { adjuntos: tarea.adjuntos.filter(a => a.id !== idAdjunto) })
  }, [tareas])

  const addImagenTarea = useCallback((idTarea: string, imagen: Omit<ImagenAdjunta, 'id'>) => {
    const newImg: ImagenAdjunta = { ...imagen, id: crypto.randomUUID() }
    const tarea = tareas.find(t => t.id === idTarea)
    const nuevasImagenes = tarea ? [...tarea.imagenes, newImg] : [newImg]
    setTareas(prev => prev.map(t => t.id !== idTarea ? t : { ...t, imagenes: nuevasImagenes }))
    dbPatch(`/api/tareas?id=${idTarea}`, { imagenes: nuevasImagenes })
  }, [tareas])

  const eliminarTarea = useCallback((idTarea: string) => {
    setTareas(prev => prev.filter(t => t.id !== idTarea))
    fetch(`/api/tareas?id=${idTarea}`, { method: 'DELETE' }).catch(console.error)
  }, [])

  const eliminarImagenTarea = useCallback((idTarea: string, idImagen: string) => {
    const tarea = tareas.find(t => t.id === idTarea)
    const imagen = tarea?.imagenes.find(i => i.id === idImagen)
    const nuevasImagenes = tarea ? tarea.imagenes.filter(i => i.id !== idImagen) : []
    setTareas(prev => prev.map(t => t.id !== idTarea ? t : { ...t, imagenes: nuevasImagenes }))
    dbPatch(`/api/tareas?id=${idTarea}`, { imagenes: nuevasImagenes })
    if (imagen?.url) {
      fetch(`/api/tareas/imagenes?url=${encodeURIComponent(imagen.url)}`, { method: 'DELETE' })
        .catch(e => console.error('[imagen] DELETE storage error', e))
    }
  }, [tareas])

  // ── Información general del cliente ────────────────────────────────────
  const addEnlaceCliente = useCallback((idCliente: string, adjunto: Omit<Adjunto, 'id'>) => {
    setEnlacesCliente(prev => ({ ...prev, [idCliente]: [...(prev[idCliente] ?? []), { ...adjunto, id: nextId('encl') }] }))
  }, [])

  const eliminarEnlaceCliente = useCallback((idCliente: string, idAdjunto: string) => {
    setEnlacesCliente(prev => ({ ...prev, [idCliente]: (prev[idCliente] ?? []).filter(a => a.id !== idAdjunto) }))
  }, [])

  const setSlackCliente = useCallback((idCliente: string, url: string) => {
    setSlackClienteState(prev => ({ ...prev, [idCliente]: url }))
  }, [])

  // ── Conflictos de carga de trabajo (Gantt por empleado) ────────────────
  const toggleConflictoResuelto = useCallback((clave: string) => {
    setConflictosResueltos(prev => {
      const next = new Set(prev)
      if (next.has(clave)) {
        next.delete(clave)
      } else {
        next.add(clave)
        pushToast('✅ Conflicto marcado como resuelto.')
      }
      return next
    })
  }, [pushToast])

  const value = useMemo<TareasContextValue>(() => ({
    state: {
      clientes,
      empleados,
      departamentos,
      servicios,
      plantillas,
      procesos,
      tareas,
      enlacesCliente,
      slackCliente,
      conflictosResueltos,
    },
    actions: {
      crearCliente,
      crearPlantilla,
      eliminarPlantilla,
      toggleActivaPlantilla,
      agregarFasePlantilla,
      actualizarFasePlantilla,
      eliminarFasePlantilla,
      moverFasePlantilla,
      importarPlantilla,
      agregarFaseProceso,
      actualizarFaseProceso,
      moverFaseProceso,
      marcarFaseTerminada,
      volverFaseAnterior,
      addAdjuntoFase,
      eliminarAdjuntoFase,
      toggleTimerFase,
      setMinutosFase,
      addChatMensajeFase,
      crearTarea,
      actualizarTarea,
      notificarBloqueoTarea,
      toggleTimerTarea,
      setMinutosTarea,
      addChatMensajeTarea,
      addAdjuntoTarea,
      eliminarAdjuntoTarea,
      addImagenTarea,
      eliminarImagenTarea,
      addEnlaceCliente,
      eliminarEnlaceCliente,
      setSlackCliente,
      toggleConflictoResuelto,
      nombreEmpleado,
      nombreDepartamento,
      nombreCliente,
      nombresEmpleados,
      eliminarTarea,
    },
    toasts,
  }), [
    clientes, empleados, departamentos, servicios, plantillas, procesos, tareas, toasts, enlacesCliente, slackCliente, conflictosResueltos,
    crearCliente,
    crearPlantilla, eliminarPlantilla, toggleActivaPlantilla, agregarFasePlantilla, actualizarFasePlantilla, eliminarFasePlantilla, moverFasePlantilla,
    importarPlantilla, agregarFaseProceso, actualizarFaseProceso, moverFaseProceso, marcarFaseTerminada, volverFaseAnterior, addAdjuntoFase, eliminarAdjuntoFase, toggleTimerFase, setMinutosFase, addChatMensajeFase,
    crearTarea, actualizarTarea, notificarBloqueoTarea, toggleTimerTarea, setMinutosTarea, addChatMensajeTarea, addAdjuntoTarea, eliminarAdjuntoTarea, addImagenTarea, eliminarImagenTarea, eliminarTarea,
    addEnlaceCliente, eliminarEnlaceCliente, setSlackCliente, toggleConflictoResuelto, nombreEmpleado, nombreDepartamento, nombreCliente, nombresEmpleados,
  ])

  return <TareasContext.Provider value={value}>{children}</TareasContext.Provider>
}

export function useTareas() {
  const ctx = useContext(TareasContext)
  if (!ctx) throw new Error('useTareas debe usarse dentro de <TareasProvider>')
  return ctx
}

export type { EstadoFase, EstadoTarea }

// Tipos del prototipo visual "Procesos (demo)". Sin persistencia real: todo vive en memoria (ver store.tsx).
// Pensado como referencia para el desarrollo real (tablas Supabase + API routes).

export interface Empleado {
  id: string
  nombre: string
  email: string
}

export interface Departamento {
  id: string
  nombre: string
  color: string
}

export interface Cliente {
  id: string
  nombre: string
}

export interface Servicio {
  id: string
  idCliente: string
  nombre: string
  tipoServicio: string
}

export interface PlantillaFase {
  id: string
  nombre: string
  orden: number
  idDepartamentoDefault: string | null
  idResponsableDefault: string | null
  duracionDias: number
}

export interface Plantilla {
  id: string
  nombre: string
  descripcion: string
  tipoServicio: string | null
  activo: boolean
  fases: PlantillaFase[]
}

export type EstadoFase = 'espera' | 'proceso' | 'terminado'
export type EstadoTarea = 'espera' | 'proceso' | 'bloqueada' | 'terminado'

// 'ninguna' = tarea puntual. El resto marca cada cuánto se regenera al marcarla como terminada.
export type Recurrencia = 'ninguna' | 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'anual'

// Una reunión/visita es una tarea más (mismos campos, mismo flujo) con hora/lugar y un icono distinto.
export type TipoTarea = 'tarea' | 'reunion' | 'visita'

export interface Adjunto {
  id: string
  nombre: string
  url: string
}

export interface ImagenAdjunta {
  id: string
  nombre: string
  dataUrl: string
}

export interface ChatMensaje {
  id: string
  autorId: string
  texto: string
  mencionesIds: string[]
  fecha: string
}

export interface ProcesoFase {
  id: string
  nombre: string
  orden: number
  idDepartamento: string | null
  idsResponsables: string[]
  fechaInicioPrevista: string
  fechaFinPrevista: string
  estado: EstadoFase
  fechaCompletado: string | null
  adjuntos: Adjunto[]
  minutosAcumulados: number
  timerActivo: boolean
  descripcion: string
  chat: ChatMensaje[]
}

export interface Proceso {
  id: string
  idCliente: string
  idServicio: string | null
  idPlantilla: string
  nombre: string
  fases: ProcesoFase[]
}

export interface Tarea {
  id: string
  nombre: string
  tipo: TipoTarea
  idCliente: string | null
  idDepartamento: string | null
  idsResponsables: string[]
  fechaLimite: string
  hora: string | null
  lugar: string | null
  estado: EstadoTarea
  explicacionBloqueo: string | null
  enlaceInfo: string
  descripcion: string
  recurrencia: Recurrencia
  minutosAcumulados: number
  timerActivo: boolean
  chat: ChatMensaje[]
  adjuntos: Adjunto[]
  imagenes: ImagenAdjunta[]
}

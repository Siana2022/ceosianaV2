import { addDays, hoyISO } from './dateUtils'
import type {
  Adjunto,
  ChatMensaje,
  Cliente,
  Departamento,
  Empleado,
  EstadoFase,
  EstadoTarea,
  Plantilla,
  Proceso,
  ProcesoFase,
  Recurrencia,
  Servicio,
  Tarea,
  TipoTarea,
} from './types'

// ─── Catálogos base (mock) ───────────────────────────────────────────────────

export const MOCK_EMPLEADOS: Empleado[] = [
  { id: 'emp-1', nombre: 'Ana Soria', email: 'ana@sianadigital.com' },
  { id: 'emp-2', nombre: 'Marcos Ruiz', email: 'marcos@sianadigital.com' },
  { id: 'emp-3', nombre: 'Laura Gómez', email: 'laura@sianadigital.com' },
  { id: 'emp-4', nombre: 'Diego Pérez', email: 'diego@sianadigital.com' },
]

export const MOCK_DEPARTAMENTOS: Departamento[] = [
  { id: 'dep-1', nombre: 'Diseño', color: 'purple' },
  { id: 'dep-2', nombre: 'Desarrollo', color: 'blue' },
  { id: 'dep-3', nombre: 'Marketing', color: 'pink' },
  { id: 'dep-4', nombre: 'Cuentas', color: 'amber' },
]

export const MOCK_CLIENTES: Cliente[] = [
  { id: 'cli-1', nombre: 'Bodegas Alto Duero' },
  { id: 'cli-2', nombre: 'Clínica Dental Marín' },
  { id: 'cli-3', nombre: 'Ferretería Los Pinos' },
]

export const MOCK_SERVICIOS: Servicio[] = [
  { id: 'srv-1', idCliente: 'cli-1', nombre: 'Meta Ads Bodegas', tipoServicio: 'Meta Ads' },
  { id: 'srv-2', idCliente: 'cli-1', nombre: 'Web captación leads', tipoServicio: 'Web captación leads' },
  { id: 'srv-3', idCliente: 'cli-2', nombre: 'Onboarding cliente', tipoServicio: 'Onboarding cliente' },
  { id: 'srv-4', idCliente: 'cli-3', nombre: 'Meta Ads Ferretería', tipoServicio: 'Meta Ads' },
]

// ─── Plantillas ───────────────────────────────────────────────────────────────

export const MOCK_PLANTILLAS: Plantilla[] = [
  {
    id: 'pla-1',
    nombre: 'Plantilla Onboarding Cliente',
    descripcion: 'Proceso estándar al dar de alta un cliente nuevo.',
    tipoServicio: 'Onboarding cliente',
    activo: true,
    fases: [
      { id: 'pf-1-1', nombre: 'Reunión de bienvenida', orden: 1, idDepartamentoDefault: 'dep-4', idResponsableDefault: 'emp-1', duracionDias: 2 },
      { id: 'pf-1-2', nombre: 'Recopilación de accesos', orden: 2, idDepartamentoDefault: 'dep-4', idResponsableDefault: 'emp-2', duracionDias: 3 },
      { id: 'pf-1-3', nombre: 'Configuración inicial', orden: 3, idDepartamentoDefault: 'dep-2', idResponsableDefault: 'emp-4', duracionDias: 4 },
      { id: 'pf-1-4', nombre: 'Kick-off con el equipo', orden: 4, idDepartamentoDefault: 'dep-4', idResponsableDefault: 'emp-1', duracionDias: 1 },
    ],
  },
  {
    id: 'pla-2',
    nombre: 'Plantilla Web Captación de Leads',
    descripcion: 'Diseño y desarrollo de landing/web orientada a captación.',
    tipoServicio: 'Web captación leads',
    activo: true,
    fases: [
      { id: 'pf-2-1', nombre: 'Briefing y estructura', orden: 1, idDepartamentoDefault: 'dep-4', idResponsableDefault: 'emp-1', duracionDias: 3 },
      { id: 'pf-2-2', nombre: 'Diseño UI', orden: 2, idDepartamentoDefault: 'dep-1', idResponsableDefault: 'emp-3', duracionDias: 5 },
      { id: 'pf-2-3', nombre: 'Desarrollo', orden: 3, idDepartamentoDefault: 'dep-2', idResponsableDefault: 'emp-4', duracionDias: 7 },
      { id: 'pf-2-4', nombre: 'QA y revisión', orden: 4, idDepartamentoDefault: 'dep-2', idResponsableDefault: 'emp-4', duracionDias: 2 },
      { id: 'pf-2-5', nombre: 'Publicación', orden: 5, idDepartamentoDefault: 'dep-2', idResponsableDefault: 'emp-2', duracionDias: 1 },
    ],
  },
  {
    id: 'pla-3',
    nombre: 'Plantilla Meta Ads',
    descripcion: 'Lanzamiento de campañas de Meta Ads para un cliente.',
    tipoServicio: 'Meta Ads',
    activo: true,
    fases: [
      { id: 'pf-3-1', nombre: 'Estrategia y objetivos', orden: 1, idDepartamentoDefault: 'dep-3', idResponsableDefault: 'emp-2', duracionDias: 2 },
      { id: 'pf-3-2', nombre: 'Creatividades', orden: 2, idDepartamentoDefault: 'dep-1', idResponsableDefault: 'emp-3', duracionDias: 4 },
      { id: 'pf-3-3', nombre: 'Configuración de campañas', orden: 3, idDepartamentoDefault: 'dep-3', idResponsableDefault: 'emp-2', duracionDias: 2 },
      { id: 'pf-3-4', nombre: 'Optimización primera semana', orden: 4, idDepartamentoDefault: 'dep-3', idResponsableDefault: 'emp-2', duracionDias: 7 },
    ],
  },
]

// ─── Helpers para los datos de ejemplo ────────────────────────────────────────

const HOY = hoyISO()

function chatEjemplo(autorId: string, texto: string, mencionesIds: string[] = []): ChatMensaje {
  return { id: `chat-${Math.random().toString(36).slice(2, 9)}`, autorId, texto, mencionesIds, fecha: HOY }
}

function adjunto(nombre: string, url: string): Adjunto {
  return { id: `adj-${Math.random().toString(36).slice(2, 9)}`, nombre, url }
}

// Construye las fases de un proceso a partir de una plantilla, encadenando fechas desde `desde`.
export function generarFasesDesdeplantilla(plantilla: Plantilla, desde: string): ProcesoFase[] {
  let cursor = desde
  return plantilla.fases
    .sort((a, b) => a.orden - b.orden)
    .map((f, idx) => {
      const inicio = cursor
      const fin = addDays(inicio, f.duracionDias)
      cursor = fin
      return {
        id: `procfase-${plantilla.id}-${f.id}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: f.nombre,
        orden: f.orden,
        idDepartamento: f.idDepartamentoDefault,
        idsResponsables: f.idResponsableDefault ? [f.idResponsableDefault] : [],
        fechaInicioPrevista: inicio,
        fechaFinPrevista: fin,
        estado: (idx === 0 ? 'proceso' : 'espera') as EstadoFase,
        fechaCompletado: null,
        adjuntos: [],
        minutosAcumulados: 0,
        timerActivo: false,
        descripcion: '',
        chat: [],
      }
    })
}

// ─── Proceso ya importado de ejemplo (Bodegas Alto Duero · Meta Ads) ────────

const fasesMetaAdsEjemplo = generarFasesDesdeplantilla(MOCK_PLANTILLAS[2], addDays(HOY, -10))
fasesMetaAdsEjemplo[0].estado = 'terminado'
fasesMetaAdsEjemplo[0].fechaCompletado = addDays(HOY, -8)
fasesMetaAdsEjemplo[1].estado = 'proceso'
fasesMetaAdsEjemplo[1].adjuntos = [adjunto('Brief de creatividades', 'https://drive.google.com/drive/folders/brief-creatividades')]
fasesMetaAdsEjemplo[1].minutosAcumulados = 95
fasesMetaAdsEjemplo[1].chat = [
  chatEjemplo('emp-2', 'He dejado el brief en la carpeta de Drive, @Laura Gómez cuando puedas revísalo 🙌', ['emp-3']),
]

// Segundo proceso (otro cliente) con fechas que se solapan a propósito con las del primero
// para el mismo empleado (emp-2) — sirve para probar la detección de conflictos en el Gantt.
const fasesFerreteriaEjemplo = generarFasesDesdeplantilla(MOCK_PLANTILLAS[2], addDays(HOY, -6))
fasesFerreteriaEjemplo[0].estado = 'terminado'
fasesFerreteriaEjemplo[0].fechaCompletado = addDays(HOY, -4)
fasesFerreteriaEjemplo[1].estado = 'proceso'
fasesFerreteriaEjemplo[1].minutosAcumulados = 50

export const MOCK_PROCESOS: Proceso[] = [
  {
    id: 'proc-1',
    idCliente: 'cli-1',
    idServicio: 'srv-1',
    idPlantilla: 'pla-3',
    nombre: 'Meta Ads Bodegas Alto Duero',
    fases: fasesMetaAdsEjemplo,
  },
  {
    id: 'proc-2',
    idCliente: 'cli-3',
    idServicio: 'srv-4',
    idPlantilla: 'pla-3',
    nombre: 'Meta Ads Ferretería Los Pinos',
    fases: fasesFerreteriaEjemplo,
  },
]

// ─── Tareas sueltas / recurrentes de ejemplo ─────────────────────────────────

export const MOCK_TAREAS: Tarea[] = [
  {
    id: 'tar-1',
    nombre: 'Enviar informe mensual de resultados',
    tipo: 'tarea',
    idCliente: 'cli-1',
    idServicio: null,
    idDepartamento: 'dep-3',
    idsResponsables: ['emp-2'],
    fechaLimite: addDays(HOY, 3),
    hora: null,
    lugar: null,
    estado: 'proceso',
    explicacionBloqueo: null,
    enlaceInfo: 'https://drive.google.com/drive/folders/informes-bodegas',
    descripcion: 'Informe con métricas de Meta Ads del mes en curso.',
    recurrencia: 'mensual',
    minutosAcumulados: 40,
    timerActivo: false,
    chat: [chatEjemplo('emp-1', '@Marcos Ruiz recuerda incluir el comparativo con el mes anterior', ['emp-2'])],
    adjuntos: [adjunto('Plantilla del informe', 'https://drive.google.com/drive/folders/plantilla-informe')],
    imagenes: [],
    checklist: [],
    syncCalendar: false,
  },
  {
    id: 'tar-2',
    nombre: 'Actualizar contenidos de la web',
    tipo: 'tarea',
    idCliente: 'cli-3',
    idServicio: null,
    idDepartamento: 'dep-2',
    idsResponsables: ['emp-4'],
    fechaLimite: addDays(HOY, -1),
    hora: null,
    lugar: null,
    estado: 'bloqueada',
    explicacionBloqueo: 'Esperando que el cliente envíe las fotos nuevas del catálogo.',
    enlaceInfo: '',
    descripcion: '',
    recurrencia: 'ninguna',
    minutosAcumulados: 15,
    timerActivo: false,
    chat: [],
    adjuntos: [],
    imagenes: [],
    checklist: [],
    syncCalendar: false,
  },
  {
    id: 'tar-3',
    nombre: 'Revisión trimestral de cuenta',
    tipo: 'tarea',
    idCliente: 'cli-2',
    idServicio: null,
    idDepartamento: 'dep-4',
    idsResponsables: ['emp-1'],
    fechaLimite: addDays(HOY, 10),
    hora: null,
    lugar: null,
    estado: 'espera',
    explicacionBloqueo: null,
    enlaceInfo: '',
    descripcion: '',
    recurrencia: 'trimestral',
    minutosAcumulados: 0,
    timerActivo: false,
    chat: [],
    adjuntos: [],
    imagenes: [],
    checklist: [],
    syncCalendar: false,
  },
  {
    id: 'tar-4',
    nombre: 'Diseñar nuevo folleto de servicios',
    tipo: 'tarea',
    idCliente: 'cli-2',
    idServicio: null,
    idDepartamento: 'dep-1',
    idsResponsables: ['emp-3'],
    fechaLimite: addDays(HOY, 2),
    hora: null,
    lugar: null,
    estado: 'proceso',
    explicacionBloqueo: null,
    enlaceInfo: '',
    descripcion: '',
    recurrencia: 'ninguna',
    minutosAcumulados: 25,
    timerActivo: false,
    chat: [],
    adjuntos: [],
    imagenes: [],
    checklist: [],
    syncCalendar: false,
  },
  {
    id: 'tar-5',
    nombre: 'Actualizar catálogo de productos',
    tipo: 'tarea',
    idCliente: 'cli-3',
    idServicio: null,
    idDepartamento: 'dep-2',
    idsResponsables: ['emp-4'],
    fechaLimite: addDays(HOY, 7),
    hora: null,
    lugar: null,
    estado: 'espera',
    explicacionBloqueo: null,
    enlaceInfo: '',
    descripcion: '',
    recurrencia: 'semanal',
    minutosAcumulados: 0,
    timerActivo: false,
    chat: [],
    adjuntos: [],
    imagenes: [],
    checklist: [],
    syncCalendar: false,
  },
  {
    id: 'tar-6',
    nombre: 'Preparar propuesta de ampliación de presupuesto',
    tipo: 'tarea',
    idCliente: 'cli-1',
    idServicio: null,
    idDepartamento: 'dep-4',
    idsResponsables: ['emp-1'],
    fechaLimite: addDays(HOY, 4),
    hora: null,
    lugar: null,
    estado: 'proceso',
    explicacionBloqueo: null,
    enlaceInfo: '',
    descripcion: '',
    recurrencia: 'ninguna',
    minutosAcumulados: 60,
    timerActivo: false,
    chat: [],
    adjuntos: [],
    imagenes: [],
    checklist: [],
    syncCalendar: false,
  },
  {
    id: 'tar-7',
    nombre: 'Sesión de fotos en la tienda del cliente',
    tipo: 'visita',
    idCliente: 'cli-2',
    idServicio: null,
    idDepartamento: 'dep-3',
    idsResponsables: ['emp-2', 'emp-3'],
    fechaLimite: addDays(HOY, 3),
    hora: '11:00',
    lugar: 'Clínica Dental Marín — C/ Mayor 12',
    estado: 'proceso',
    explicacionBloqueo: null,
    enlaceInfo: '',
    descripcion: '',
    recurrencia: 'ninguna',
    minutosAcumulados: 10,
    timerActivo: false,
    chat: [],
    adjuntos: [],
    imagenes: [],
    checklist: [],
    syncCalendar: false,
  },
  {
    id: 'tar-8',
    nombre: 'Reunión de seguimiento mensual',
    tipo: 'reunion',
    idCliente: 'cli-1',
    idServicio: null,
    idDepartamento: 'dep-4',
    idsResponsables: ['emp-1', 'emp-2'],
    fechaLimite: addDays(HOY, 1),
    hora: '10:30',
    lugar: 'Google Meet',
    estado: 'espera',
    explicacionBloqueo: null,
    enlaceInfo: '',
    descripcion: 'Repaso mensual de resultados y próximos pasos con el cliente.',
    recurrencia: 'mensual',
    minutosAcumulados: 0,
    timerActivo: false,
    chat: [],
    adjuntos: [],
    imagenes: [],
    checklist: [],
    syncCalendar: false,
  },
]

// ─── Enlaces generales de cliente (Drive, Looker Studio...) de ejemplo ───────

export const MOCK_ENLACES_CLIENTE: Record<string, Adjunto[]> = {
  'cli-1': [
    adjunto('Looker Studio — Rendimiento Ads', 'https://lookerstudio.google.com/reporting/bodegas-alto-duero'),
    adjunto('Carpeta Drive del cliente', 'https://drive.google.com/drive/folders/bodegas-alto-duero'),
  ],
}

// ─── Chat de Slack por cliente (solo enlace, sin integración real) ───────────

export const MOCK_SLACK_CLIENTE: Record<string, string> = {
  'cli-1': 'https://app.slack.com/client/T00000000/C00000001',
}

export function nombrePorId(lista: { id: string; nombre: string }[], id: string | null): string {
  if (!id) return '—'
  return lista.find(x => x.id === id)?.nombre ?? '—'
}

// 'espera' se etiqueta como "Bloqueada": en la práctica está bloqueada por la fase anterior
// (de otra persona) hasta que esa fase se marca como terminada.
export const ESTADO_FASE_LABEL: Record<EstadoFase, string> = {
  espera: 'Bloqueada',
  proceso: 'En proceso',
  terminado: 'Terminado',
}

export const ESTADO_TAREA_LABEL: Record<EstadoTarea, string> = {
  espera: 'A la espera',
  proceso: 'En proceso',
  bloqueada: 'Bloqueada',
  terminado: 'Terminado',
}

export const TIPO_TAREA_LABEL: Record<TipoTarea, string> = {
  tarea: 'Tarea',
  reunion: 'Reunión',
  visita: 'Visita',
}

export const TIPO_TAREA_ICONO: Record<TipoTarea, string> = {
  tarea: '📋',
  reunion: '🤝',
  visita: '📍',
}

export const RECURRENCIA_LABEL: Record<Recurrencia, string> = {
  ninguna: 'No se repite',
  diaria: 'Diaria',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  anual: 'Anual',
}

// Días aproximados que se suman a la fecha límite al regenerar una tarea recurrente terminada.
export const RECURRENCIA_DIAS: Record<Recurrencia, number> = {
  ninguna: 0,
  diaria: 1,
  semanal: 7,
  quincenal: 14,
  mensual: 30,
  trimestral: 91,
  anual: 365,
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

interface Empleado { id: string; nombre: string }
interface TipoServicio { id: string; nombre: string; activo: boolean }

interface Servicio {
  id: string
  nombre: string
  tipo: 'recurrente' | 'oneshot'
  precio_base: number | null
  activo: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  notas: string | null
  cliente: { id: string; nombre: string } | null
  departamento: { id: string; nombre: string } | null
  tipo_servicio: { id: string; nombre: string } | null
  responsables: Empleado[]
}

interface Props {
  servicios: Servicio[]
  tiposServicio: TipoServicio[]
  clientes: { id: string; nombre: string }[]
  departamentos: { id: string; nombre: string }[]
  empleados: Empleado[]
  empleadosPorDepartamento: Record<string, Empleado[]>
}

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

// ─── Catálogo tab ────────────────────────────────────────────────────────────
function CatalogoTab({ tipos }: { tipos: TipoServicio[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<TipoServicio | null>(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)

  const openNew = () => { setEditing(null); setNombre(''); setShowModal(true) }
  const openEdit = (t: TipoServicio) => { setEditing(t); setNombre(t.nombre); setShowModal(true) }

  const handleSave = async () => {
    if (!nombre.trim()) return
    setSaving(true)
    if (editing) {
      await fetch('/api/tipos-servicio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, nombre: nombre.trim() }),
      })
    } else {
      await fetch('/api/tipos-servicio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() }),
      })
    }
    setSaving(false)
    setShowModal(false)
    router.refresh()
  }

  const handleToggle = async (t: TipoServicio) => {
    await fetch('/api/tipos-servicio', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, activo: !t.activo }),
    })
    router.refresh()
  }

  const handleDelete = async (t: TipoServicio) => {
    if (!window.confirm(`¿Eliminar "${t.nombre}"? Los servicios ya asignados a clientes no se verán afectados.`)) return
    await fetch(`/api/tipos-servicio?id=${t.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Define los tipos de servicio que ofrece la agencia. Luego asígnalos a cada cliente con su precio específico.
        </p>
        <button onClick={openNew} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex-shrink-0 ml-4">
          + Nuevo tipo
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <th className="text-left text-gray-400 font-medium py-3 px-6">Nombre</th>
              <th className="text-center text-gray-400 font-medium py-3 px-4">Estado</th>
              <th className="text-right text-gray-400 font-medium py-3 px-6">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tipos.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-gray-600 py-10">
                  Sin tipos de servicio. Crea el primero.
                </td>
              </tr>
            )}
            {tipos.map(t => (
              <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-3 px-6 text-white font-medium">{t.nombre}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${t.activo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {t.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-3 px-6 text-right space-x-2">
                  <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">Editar</button>
                  <button onClick={() => handleToggle(t)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">
                    {t.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(t)} className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-gray-700">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">{editing ? 'Editar tipo' : 'Nuevo tipo de servicio'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">Nombre *</label>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="ej: SEO, Social Media, Diseño Web..."
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <button onClick={() => setShowModal(false)} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm">Cancelar</button>
                <button onClick={handleSave} disabled={saving || !nombre.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Servicios tab ───────────────────────────────────────────────────────────
function ServiciosTab({
  servicios, tiposServicio, clientes, departamentos, empleados, empleadosPorDepartamento,
}: Omit<Props, 'tiposServicio'> & { tiposServicio: TipoServicio[] }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Servicio | null>(null)
  const [form, setForm] = useState({
    id_cliente: '', id_tipo_servicio: '', tipo: 'recurrente' as 'recurrente' | 'oneshot',
    precio_base: '', id_departamento: '', fecha_inicio: '', notas: '',
  })
  const [selectedResponsables, setSelectedResponsables] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'inactivos'>('activos')

  const empleadosDisponibles =
    form.id_departamento && empleadosPorDepartamento[form.id_departamento]?.length
      ? empleadosPorDepartamento[form.id_departamento]
      : empleados

  const openNew = () => {
    setEditing(null)
    setForm({ id_cliente: '', id_tipo_servicio: '', tipo: 'recurrente', precio_base: '', id_departamento: '', fecha_inicio: '', notas: '' })
    setSelectedResponsables([])
    setShowModal(true)
  }

  const openEdit = (s: Servicio) => {
    setEditing(s)
    setForm({
      id_cliente: s.cliente?.id ?? '',
      id_tipo_servicio: s.tipo_servicio?.id ?? '',
      tipo: s.tipo,
      precio_base: s.precio_base?.toString() ?? '',
      id_departamento: s.departamento?.id ?? '',
      fecha_inicio: s.fecha_inicio ?? '',
      notas: s.notas ?? '',
    })
    setSelectedResponsables(s.responsables.map(r => r.id))
    setShowModal(true)
  }

  const handleDeptChange = (id_departamento: string) => {
    setForm(f => ({ ...f, id_departamento }))
    if (id_departamento && empleadosPorDepartamento[id_departamento]) {
      const deptIds = empleadosPorDepartamento[id_departamento].map(e => e.id)
      setSelectedResponsables(prev => prev.filter(id => deptIds.includes(id)))
    }
  }

  const toggleResponsable = (id: string) =>
    setSelectedResponsables(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  const handleSave = async () => {
    if (!form.id_tipo_servicio && !editing) return
    setSaving(true)
    const tipoNombre = tiposServicio.find(t => t.id === form.id_tipo_servicio)?.nombre ?? editing?.nombre ?? ''
    const body = {
      ...(editing ? { id: editing.id } : {}),
      id_cliente: form.id_cliente || null,
      id_tipo_servicio: form.id_tipo_servicio || null,
      nombre: tipoNombre,
      tipo: form.tipo,
      precio_base: form.precio_base ? parseFloat(form.precio_base) : null,
      id_departamento: form.id_departamento || null,
      fecha_inicio: form.fecha_inicio || null,
      notas: form.notas || null,
    }
    const res = await fetch('/api/servicios', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const saved = await res.json()
      const servicioId = saved.id ?? editing?.id
      await fetch('/api/servicio-responsables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_servicio: servicioId, mes: 0, anio: 0,
          asignaciones: selectedResponsables.map(id => ({
            id_empleado: id,
            porcentaje: selectedResponsables.length > 0 ? Math.round(100 / selectedResponsables.length) : 100,
          })),
        }),
      })
    }
    setSaving(false)
    setShowModal(false)
    router.refresh()
  }

  const toggleActivo = async (s: Servicio) => {
    await fetch('/api/servicios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, activo: !s.activo }) })
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este servicio?')) return
    await fetch(`/api/servicios?id=${id}`, { method: 'DELETE' })
    router.refresh()
  }

  const filtered = servicios.filter(s =>
    filtro === 'todos' ? true : filtro === 'activos' ? s.activo : !s.activo
  )
  const totalMRR = servicios.filter(s => s.activo && s.tipo === 'recurrente').reduce((sum, s) => sum + (s.precio_base ?? 0), 0)
  const tiposActivos = tiposServicio.filter(t => t.activo)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          MRR estimado: <span className="text-green-400 font-semibold">{fmt(totalMRR)}</span>
        </p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(['activos', 'todos', 'inactivos'] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filtro === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={openNew} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            + Nuevo servicio
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <th className="text-left text-gray-400 font-medium py-3 px-4">Tipo de servicio</th>
              <th className="text-left text-gray-400 font-medium py-3 px-4">Cliente</th>
              <th className="text-left text-gray-400 font-medium py-3 px-4">Modalidad</th>
              <th className="text-left text-gray-400 font-medium py-3 px-4">Departamento</th>
              <th className="text-left text-gray-400 font-medium py-3 px-4">Responsables</th>
              <th className="text-right text-gray-400 font-medium py-3 px-4">Precio/mes</th>
              <th className="text-center text-gray-400 font-medium py-3 px-4">Estado</th>
              <th className="text-right text-gray-400 font-medium py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-600 py-8">Sin servicios</td></tr>
            )}
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{s.tipo_servicio?.nombre ?? s.nombre}</p>
                  {!s.tipo_servicio && s.nombre && (
                    <p className="text-gray-600 text-xs mt-0.5">sin tipo asignado</p>
                  )}
                </td>
                <td className="py-3 px-4">
                  {s.cliente
                    ? <Link href={`/clientes/${s.cliente.id}`} className="text-blue-400 hover:text-blue-300">{s.cliente.nombre}</Link>
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-xs ${s.tipo === 'recurrente' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {s.tipo}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-300">{s.departamento?.nombre ?? <span className="text-gray-600">—</span>}</td>
                <td className="py-3 px-4">
                  {s.responsables.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {s.responsables.map(r => (
                        <span key={r.id} className="inline-flex items-center gap-1 bg-purple-900/30 border border-purple-800/40 text-purple-300 text-xs px-2 py-0.5 rounded-full">
                          <span className="w-3.5 h-3.5 rounded-full bg-purple-700/60 text-[9px] flex items-center justify-center font-bold">{r.nombre.charAt(0)}</span>
                          {r.nombre.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  ) : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-3 px-4 text-right text-gray-300">{s.precio_base ? fmt(s.precio_base) : <span className="text-gray-600">—</span>}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${s.activo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {s.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">Editar</button>
                    <button onClick={() => toggleActivo(s)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">{s.activo ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-gray-700">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <h3 className="text-white font-semibold">{editing ? 'Editar servicio' : 'Nuevo servicio'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Tipo de servicio */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Tipo de servicio *</label>
                <select value={form.id_tipo_servicio} onChange={e => setForm(f => ({ ...f, id_tipo_servicio: e.target.value }))} className={inputCls}>
                  <option value="">Selecciona un tipo...</option>
                  {tiposActivos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
                {tiposActivos.length === 0 && (
                  <p className="text-yellow-500 text-xs mt-1">No hay tipos activos. Créalos en la pestaña Catálogo.</p>
                )}
              </div>
              {/* Cliente */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Cliente</label>
                <select value={form.id_cliente} onChange={e => setForm(f => ({ ...f, id_cliente: e.target.value }))} className={inputCls}>
                  <option value="">Selecciona cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              {/* Tipo + Precio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Modalidad</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'recurrente' | 'oneshot' }))} className={inputCls}>
                    <option value="recurrente">Recurrente</option>
                    <option value="oneshot">One-shot</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Precio para este cliente (€)</label>
                  <input type="number" value={form.precio_base} onChange={e => setForm(f => ({ ...f, precio_base: e.target.value }))} className={inputCls} placeholder="0" />
                </div>
              </div>
              {/* Departamento */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Departamento</label>
                <select value={form.id_departamento} onChange={e => handleDeptChange(e.target.value)} className={inputCls}>
                  <option value="">Sin departamento</option>
                  {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              {/* Responsables */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Responsables
                  <span className="ml-2 text-gray-600 text-xs">
                    ({selectedResponsables.length} seleccionados
                    {form.id_departamento && empleadosPorDepartamento[form.id_departamento]?.length ? ' · miembros del depto.' : ' · todos'})
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {empleadosDisponibles.map(emp => {
                    const checked = selectedResponsables.includes(emp.id)
                    return (
                      <button key={emp.id} type="button" onClick={() => toggleResponsable(emp.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-sm transition-colors ${checked ? 'bg-purple-600/20 border-purple-500/50 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${checked ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-600'}`}>
                          {checked ? '✓' : ''}
                        </div>
                        <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{emp.nombre.charAt(0)}</span>
                        <span className="truncate">{emp.nombre.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Fecha inicio + notas */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Fecha inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Notas</label>
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-800 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSave} disabled={saving || (!form.id_tipo_servicio && !editing)}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ServiciosClient(props: Props) {
  const [tab, setTab] = useState<'catalogo' | 'servicios'>('catalogo')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Servicios</h2>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {([
            { key: 'catalogo', label: '📋 Catálogo' },
            { key: 'servicios', label: '🔗 Asignados a clientes' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'catalogo'
        ? <CatalogoTab tipos={props.tiposServicio} />
        : <ServiciosTab {...props} />}
    </div>
  )
}

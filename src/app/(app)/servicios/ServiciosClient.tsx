'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

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
  responsable: { id: string; nombre: string } | null
}

interface Props {
  servicios: Servicio[]
  clientes: { id: string; nombre: string }[]
  departamentos: { id: string; nombre: string }[]
  empleados: { id: string; nombre: string }[]
}

const empty = { id_cliente: '', nombre: '', tipo: 'recurrente' as 'recurrente' | 'oneshot', precio_base: '', id_departamento: '', id_responsable: '', fecha_inicio: '', notas: '' }

export default function ServiciosClient({ servicios, clientes, departamentos, empleados }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Servicio | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'inactivos'>('activos')

  const openNew = () => { setEditing(null); setForm(empty); setShowModal(true) }
  const openEdit = (s: Servicio) => {
    setEditing(s)
    setForm({
      id_cliente: s.cliente?.id || '',
      nombre: s.nombre,
      tipo: s.tipo,
      precio_base: s.precio_base?.toString() || '',
      id_departamento: s.departamento?.id || '',
      id_responsable: s.responsable?.id || '',
      fecha_inicio: s.fecha_inicio || '',
      notas: s.notas || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const body = { ...form, precio_base: form.precio_base ? parseFloat(form.precio_base) : null }
    if (editing) {
      await fetch('/api/servicios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...body }) })
    } else {
      await fetch('/api/servicios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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

  const totalMRR = servicios.filter(s => s.activo && s.tipo === 'recurrente').reduce((sum, s) => sum + (s.precio_base || 0), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Servicios</h2>
          <p className="text-gray-400 text-sm mt-1">MRR estimado: <span className="text-green-400 font-semibold">{fmt(totalMRR)}</span></p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
          + Nuevo servicio
        </button>
      </div>

      {/* Filtro */}
      <div className="flex gap-2">
        {(['activos', 'todos', 'inactivos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filtro === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <th className="text-left text-gray-400 font-medium py-3 px-4">Servicio</th>
              <th className="text-left text-gray-400 font-medium py-3 px-4">Cliente</th>
              <th className="text-left text-gray-400 font-medium py-3 px-4">Tipo</th>
              <th className="text-left text-gray-400 font-medium py-3 px-4">Departamento</th>
              <th className="text-left text-gray-400 font-medium py-3 px-4">Responsable</th>
              <th className="text-right text-gray-400 font-medium py-3 px-4">Precio base</th>
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
                <td className="py-3 px-4 text-white font-medium">{s.nombre}</td>
                <td className="py-3 px-4">
                  {s.cliente ? (
                    <Link href={`/clientes/${s.cliente.id}`} className="text-blue-400 hover:text-blue-300">{s.cliente.nombre}</Link>
                  ) : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-xs ${s.tipo === 'recurrente' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                    {s.tipo}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-300">{s.departamento?.nombre || <span className="text-gray-600">—</span>}</td>
                <td className="py-3 px-4 text-gray-300">{s.responsable?.nombre || <span className="text-gray-600">—</span>}</td>
                <td className="py-3 px-4 text-right text-gray-300">{s.precio_base ? fmt(s.precio_base) : <span className="text-gray-600">—</span>}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${s.activo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {s.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">Editar</button>
                    <button onClick={() => toggleActivo(s)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">
                      {s.activo ? 'Desactivar' : 'Activar'}
                    </button>
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold">{editing ? 'Editar servicio' : 'Nuevo servicio'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Cliente</label>
                <select value={form.id_cliente} onChange={e => setForm(f => ({ ...f, id_cliente: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Selecciona cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Nombre del servicio</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="ej: SEO, Web, Mentoría Abril"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="recurrente">Recurrente</option>
                    <option value="oneshot">One-shot</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Precio base (€)</label>
                  <input type="number" value={form.precio_base} onChange={e => setForm(f => ({ ...f, precio_base: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Departamento</label>
                  <select value={form.id_departamento} onChange={e => setForm(f => ({ ...f, id_departamento: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin departamento</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Responsable</label>
                  <select value={form.id_responsable} onChange={e => setForm(f => ({ ...f, id_responsable: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin responsable</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Fecha inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Notas</label>
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancelar</button>
                <button onClick={handleSave} disabled={saving || !form.nombre || !form.id_cliente}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

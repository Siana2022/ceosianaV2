'use client'

import { useEffect, useState } from 'react'

interface Llave {
  id: string
  nombre: string
  tipo: string
  prefijo: string
  activo: boolean
  created_at: string
  empleado: { nombre: string } | { nombre: string }[] | null
  cliente: { nombre: string } | { nombre: string }[] | null
}

interface Empleado {
  id: string
  nombre: string
}

interface Cliente {
  id: string
  nombre: string
}

const input = 'w-full bg-white border border-[#d8d3c9] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none focus:border-[#3B63FB]'

function nombreEmpleado(l: Llave): string {
  if (!l.empleado) return '—'
  return Array.isArray(l.empleado) ? (l.empleado[0]?.nombre ?? '—') : l.empleado.nombre
}

export default function LlavesClient({ empleados, clientes }: { empleados: Empleado[]; clientes: Cliente[] }) {
  const [llaves, setLlaves] = useState<Llave[]>([])
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'operativo' | 'admin' | 'externo'>('operativo')
  const [cliente, setCliente] = useState('')
  const [empleado, setEmpleado] = useState('')
  const [creando, setCreando] = useState(false)
  const [nueva, setNueva] = useState<string | null>(null)
  const [error, setError] = useState('')

  const cargar = async () => {
    const res = await fetch('/api/mcp/llaves')
    const d = await res.json().catch(() => ({}))
    setLlaves((d as { llaves?: Llave[] }).llaves ?? [])
  }

  useEffect(() => { void cargar() }, [])

  const crear = async () => {
    if (!nombre.trim()) return
    setCreando(true)
    setError('')
    try {
      const res = await fetch('/api/mcp/llaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, tipo, id_empleado: empleado || null, id_cliente: cliente || null }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo crear')
      setNueva((d as { token: string }).token)
      setNombre('')
      setEmpleado('')
      setCliente('')
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCreando(false)
    }
  }

  const revocar = async (id: string) => {
    await fetch(`/api/mcp/llaves?id=${id}`, { method: 'DELETE' })
    await cargar()
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#dcd7cd] rounded-xl p-6">
        <h3 className="text-[#111] font-semibold text-lg mb-1">Nueva llave de acceso</h3>
        <p className="text-[#6f6a62] text-sm mb-4">
          La llave se muestra una sola vez. Se usa en Claude como cabecera
          <code className="mx-1 bg-[#f3f1ec] px-1.5 py-0.5 rounded text-[12px]">Authorization: Bearer …</code>
        </p>

        <div className="grid sm:grid-cols-3 gap-3">
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Para quién (ej: Anaís)" className={input} />
          {tipo === 'externo' ? (
            <select value={cliente} onChange={e => setCliente(e.target.value)} className={input}>
              <option value="">Cliente al que pertenece</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : (
            <select value={empleado} onChange={e => setEmpleado(e.target.value)} className={input}>
              <option value="">Sin empleado asociado</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          )}
          <select value={tipo} onChange={e => setTipo(e.target.value as 'operativo' | 'admin' | 'externo')} className={input}>
            <option value="operativo">Operativo (tareas, fichaje, hub)</option>
            <option value="admin">Administrador (todo)</option>
            <option value="externo">Externo (solo el hub, lectura)</option>
          </select>
        </div>

        <button
          onClick={crear}
          disabled={creando || !nombre.trim()}
          className="mt-3 bg-[#3B63FB] hover:bg-[#2f55e0] text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {creando ? '…' : 'Crear llave'}
        </button>

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

        {nueva && (
          <div className="mt-4 border border-[#3B63FB]/40 bg-[#3B63FB]/5 rounded-lg p-4">
            <p className="text-[#111] text-sm font-medium mb-1">Cópiala ahora, no se vuelve a mostrar:</p>
            <div className="flex gap-2">
              <input readOnly value={nueva} className={`${input} font-mono text-xs`} onFocus={e => e.currentTarget.select()} />
              <button onClick={() => void navigator.clipboard.writeText(nueva)} className="bg-[#111] text-white rounded-lg px-3 text-sm">
                Copiar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#dcd7cd] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f5f1] text-[#6f6a62] text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-left px-4 py-3">Empleado</th>
              <th className="text-left px-4 py-3">Prefijo</th>
              <th className="text-left px-4 py-3">Último uso</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {llaves.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[#8a847a]">Todavía no hay llaves.</td></tr>
            )}
            {llaves.map(l => (
              <tr key={l.id} className="border-t border-[#eeeae2]">
                <td className="px-4 py-3 text-[#111]">{l.nombre}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${l.tipo === 'admin' ? 'bg-purple-100 text-purple-700' : l.tipo === 'externo' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {l.tipo}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#55504a]">{l.tipo === 'externo' ? (Array.isArray(l.cliente) ? l.cliente[0]?.nombre : l.cliente?.nombre) ?? '—' : nombreEmpleado(l)}</td>
                <td className="px-4 py-3 font-mono text-xs text-[#55504a]">{l.prefijo}…</td>
                <td className="px-4 py-3 text-[#55504a]">
                  {l.activo ? (l.created_at ? new Date(l.created_at).toLocaleDateString('es-ES') : '—') : 'revocada'}
                </td>
                <td className="px-4 py-3 text-right">
                  {l.activo && (
                    <button onClick={() => revocar(l.id)} className="text-red-600 hover:text-red-500 text-xs">
                      Revocar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

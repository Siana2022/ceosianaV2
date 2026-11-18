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

export default function LlavesClient({ empleados, clientes, bypass }: { empleados: Empleado[]; clientes: Cliente[]; bypass: string }) {
  const [llaves, setLlaves] = useState<Llave[]>([])
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'operativo' | 'admin' | 'externo'>('operativo')
  const [cliente, setCliente] = useState('')
  const [empleado, setEmpleado] = useState('')
  const [creando, setCreando] = useState(false)
  const [nueva, setNueva] = useState<{ token: string; tipo: string } | null>(null)
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
      setNueva({ token: (d as { token: string }).token, tipo })
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
          <PanelNuevaLlave token={nueva.token} tipo={nueva.tipo} bypass={bypass} />
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


function PanelNuevaLlave({ token, tipo, bypass }: { token: string; tipo: string; bypass: string }) {
  const origen = typeof window !== 'undefined' ? window.location.origin : ''
  // En previews protegidos por Vercel hace falta el secreto de omisión.
  const extra = bypass ? `&x-vercel-protection-bypass=${encodeURIComponent(bypass)}` : ''
  const url = `${origen}/api/mcp/${tipo}?llave=${token}${extra}`
  const [copiada, setCopiada] = useState(false)

  const copiar = () => {
    void navigator.clipboard.writeText(url)
    setCopiada(true)
    setTimeout(() => setCopiada(false), 2000)
  }

  return (
    <div className="mt-4 border border-[#3B63FB]/40 bg-[#3B63FB]/5 rounded-lg p-4 space-y-4">
      <div>
        <p className="text-[#111] text-sm font-semibold mb-1">Su enlace de conexión</p>
        <p className="text-[#6f6a62] text-xs mb-2">
          Es lo único que necesita. La llave va dentro, así que el enlace es personal: no lo comparta.
        </p>
        <div className="flex gap-2">
          <input readOnly value={url} className={`${input} font-mono text-[11px]`} onFocus={e => e.currentTarget.select()} />
          <button onClick={copiar} className="bg-[#111] text-white rounded-lg px-3 text-sm whitespace-nowrap">
            {copiada ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <div>
        <p className="text-[#111] text-sm font-semibold mb-2">Qué tiene que hacer</p>
        <ol className="text-sm text-[#3a352f] space-y-1.5 list-decimal list-inside">
          <li>Abrir Claude y entrar en <strong>Ajustes</strong> (abajo a la izquierda, o en el menú de su perfil).</li>
          <li>Ir a <strong>Conectores</strong> y pulsar <strong>Add custom connector</strong>.</li>
          <li>Poner un nombre, por ejemplo <strong>ceosiana</strong>.</li>
          <li>Pegar el enlace de arriba en el campo de URL.</li>
          <li>Guardar. No hace falta instalar nada ni escribir contraseñas.</li>
          <li>Probar preguntándole: <em>“¿qué tareas tengo pendientes?”</em></li>
        </ol>
        <p className="text-[#6f6a62] text-xs mt-2">
          Si Claude le pide autenticación, es que el conector no admite enlaces con llave: en ese caso
          se añade en Claude Desktop con la cabecera <code className="bg-white px-1.5 py-0.5 rounded">Authorization: Bearer …</code>
        </p>
      </div>

      <p className="text-[#8a847a] text-[11px]">
        Esta llave no se vuelve a mostrar. Si se pierde, revóquela y cree otra.
      </p>
    </div>
  )
}

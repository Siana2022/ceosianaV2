import { createAdminClient } from '@/lib/server/supabase-admin'
import Link from 'next/link'

export default async function EditorialPage() {
  const admin = createAdminClient()

  const { data: clientes } = await admin
    .from('clientes')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  const { data: boards } = await admin
    .from('editorial_boards')
    .select('id_cliente')

  const boardSet = new Set((boards ?? []).map((b: { id_cliente: string }) => b.id_cliente))

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Editorial</h1>
        <p className="text-gray-400">Calendario editorial por cliente</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(clientes ?? []).map((c: { id: string; nombre: string }) => (
          <Link
            key={c.id}
            href={`/editorial/${c.id}`}
            className="group block bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500 rounded-xl p-5 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-white font-semibold group-hover:text-blue-400 transition-colors">
                  {c.nombre}
                </h2>
                {boardSet.has(c.id) ? (
                  <span className="text-xs text-green-400 mt-1 inline-block">Tablero activo</span>
                ) : (
                  <span className="text-xs text-gray-500 mt-1 inline-block">Sin tablero aún</span>
                )}
              </div>
              <span className="text-2xl">📅</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

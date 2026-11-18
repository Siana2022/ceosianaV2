import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/server/supabase'

// Creative Lab integrado: misma estructura que el resto de ceosiana (menú
// lateral) y el artefacto ocupando toda la zona de contenido.
export default async function CreativeLabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nombre')
    .eq('id', id)
    .maybeSingle()

  if (!cliente) notFound()

  const src = `/creative-lab/index.html?proyecto=${cliente.id}&v=20261118e`

  return (
    <div className="grid grid-rows-[auto_1fr] h-[100dvh] w-full overflow-hidden">
      <div className="px-6 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/clientes/${cliente.id}/hub`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-black border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
          >
            ← Volver al hub
          </Link>
          <span className="text-gray-400 text-sm truncate">
            Creative Lab · <span className="text-gray-800 font-medium">{cliente.nombre}</span>
          </span>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:text-blue-500 text-xs flex-shrink-0"
        >
          Abrir en pestaña ↗
        </a>
      </div>
      <iframe src={src} title="Creative Lab" className="w-full h-full border-0 block" />
    </div>
  )
}

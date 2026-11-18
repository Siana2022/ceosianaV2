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

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col">
      <div className="px-6 py-2.5 bg-gray-950 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Creative Lab</span>
          <span className="text-gray-700">·</span>
          <span className="text-white font-medium">{cliente.nombre}</span>
        </div>
        <a
          href={`/creative-lab/index.html?proyecto=${cliente.id}&v=20261118d`}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:text-blue-300 text-xs"
        >
          Abrir en pestaña ↗
        </a>
      </div>
      <iframe
        src={`/creative-lab/index.html?proyecto=${cliente.id}&v=20261118d`}
        title="Creative Lab"
        className="w-full flex-1 border-0 block"
      />
    </div>
  )
}

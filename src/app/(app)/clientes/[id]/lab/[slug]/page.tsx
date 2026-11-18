import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/server/supabase'
import { getPerfil } from '@/lib/server/perfil'

interface Artefacto {
  slug: string
  nombre: string
  descripcion: string | null
  ruta: string
}

// Laboratorio del cliente: botonera de artefactos y el activo a pantalla completa.
export default async function LabPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params
  const supabase = await createClient()
  const perfil = await getPerfil()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nombre')
    .eq('id', id)
    .maybeSingle()

  if (!cliente) notFound()

  const { data } = await supabase
    .from('artefactos')
    .select('slug, nombre, descripcion, ruta')
    .eq('activo', true)
    .order('orden', { ascending: true })

  const artefactos = (data ?? []) as Artefacto[]
  const activo = artefactos.find(a => a.slug === slug)

  // Si la tabla aún no existe, al menos deja entrar al Creative Lab
  if (!activo) {
    if (slug === 'creative-lab') {
      return <Marco cliente={cliente as { id: string; nombre: string }} artefactos={[]} slug={slug} ruta="/creative-lab/index.html" esAdmin={perfil?.rol === 'admin'} />
    }
    notFound()
  }

  return (
    <Marco
      cliente={cliente as { id: string; nombre: string }}
      artefactos={artefactos}
      slug={slug}
      ruta={activo.ruta}
      esAdmin={perfil?.rol === 'admin'}
    />
  )
}

function Marco({
  cliente, artefactos, slug, ruta, esAdmin,
}: {
  cliente: { id: string; nombre: string }
  artefactos: Artefacto[]
  slug: string
  ruta: string
  esAdmin: boolean
}) {
  const src = `${ruta}?proyecto=${cliente.id}&v=20261118e`

  return (
    <div className="grid grid-rows-[auto_1fr] h-[100dvh] w-full overflow-hidden">
      <div className="px-5 py-2 bg-white border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <Link
          href={`/clientes/${cliente.id}/hub`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-black border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
        >
          ← Volver al hub
        </Link>

        {artefactos.length > 1 && (
          <nav className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {artefactos.map(a => (
              <Link
                key={a.slug}
                href={`/clientes/${cliente.id}/lab/${a.slug}`}
                className={
                  a.slug === slug
                    ? 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm'
                    : 'px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-gray-900'
                }
              >
                {a.nombre}
              </Link>
            ))}
          </nav>
        )}

        <span className="text-gray-400 text-sm truncate">
          <span className="text-gray-800 font-medium">{cliente.nombre}</span>
          {esAdmin ? '' : ''}
        </span>

        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-blue-600 hover:text-blue-500 text-xs flex-shrink-0"
        >
          Abrir en pestaña ↗
        </a>
      </div>

      <iframe src={src} title={slug} className="w-full h-full border-0 block" />
    </div>
  )
}

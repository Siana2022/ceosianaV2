import { redirect } from 'next/navigation'

// Ruta antigua: se mantiene por los enlaces guardados.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/clientes/${id}/lab/creative-lab`)
}

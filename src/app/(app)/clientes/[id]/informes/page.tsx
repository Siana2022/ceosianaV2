import { redirect } from 'next/navigation'

export default async function InformesClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/informes/${id}`)
}

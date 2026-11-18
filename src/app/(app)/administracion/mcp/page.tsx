import { redirect } from 'next/navigation'

// Ruta antigua: la pantalla vive ahora en /mcp
export default async function Page() {
  redirect('/mcp')
}

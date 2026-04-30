import { createClient } from '@/lib/server/supabase'
import DepartamentosClient from './DepartamentosClient'

export default async function DepartamentosPage() {
  const supabase = await createClient()
  const { data: departamentos } = await supabase
    .from('departamentos')
    .select('id, nombre, activo')
    .order('nombre')

  return <DepartamentosClient departamentos={departamentos ?? []} />
}

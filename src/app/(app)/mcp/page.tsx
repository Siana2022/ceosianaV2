import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { getPerfil } from '@/lib/server/perfil'
import LlavesClient from './LlavesClient'

export default async function LlavesMCPPage() {
  const perfil = await getPerfil()
  if (perfil?.rol !== 'admin') redirect('/hub')

  const admin = createAdminClient()
  const { data: empleados } = await admin.from('empleados').select('id, nombre').order('nombre')
  const { data: clientes } = await admin.from('clientes').select('id, nombre').eq('activo', true).order('nombre')

  return (
    <div className="p-8 w-full space-y-6">
      <div>
        <p className="text-[#6f6a62] text-xs mb-1">Gestión</p>
        <h2 className="text-[30px] font-bold text-[#111] leading-tight">Acceso desde Claude</h2>
        <p className="text-[#6f6a62] text-sm mt-1">
          Llaves para conectar el Claude de cada persona con ceosiana. La operativa sirve para tareas,
          fichaje y consultar el hub; la de administrador, para todo.
        </p>
      </div>
      <LlavesClient
        empleados={(empleados ?? []) as { id: string; nombre: string }[]}
        clientes={(clientes ?? []) as { id: string; nombre: string }[]}
        bypass={process.env.MCP_BYPASS ?? ''}
      />
    </div>
  )
}

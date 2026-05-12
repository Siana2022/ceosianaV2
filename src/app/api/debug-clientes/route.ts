import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server/supabase'

export async function GET() {
  const supabase = await createClient()

  // Get ALL clients with raw activo values
  const { data: todos, error: e1 } = await supabase
    .from('clientes')
    .select('id, nombre, activo')
    .order('nombre')

  // Try OR filter
  const { data: inactivos, error: e2 } = await supabase
    .from('clientes')
    .select('id, nombre, activo')
    .or('activo.eq.false,activo.is.null')

  // Try neq
  const { data: neqResult, error: e3 } = await supabase
    .from('clientes')
    .select('id, nombre, activo')
    .neq('activo', true)

  return NextResponse.json({
    todos: todos?.map(c => ({ id: c.id, nombre: c.nombre, activo: c.activo, type: typeof c.activo })),
    inactivos,
    neqResult,
    errors: { e1: e1?.message, e2: e2?.message, e3: e3?.message },
  })
}

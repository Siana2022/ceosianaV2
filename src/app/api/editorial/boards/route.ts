import { createClient } from '@/lib/server/supabase'
import { createAdminClient } from '@/lib/server/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

const COLUMNAS_DEFAULT = [
  { nombre: 'Ideas', orden: 0, color: '#8b5cf6' },
  { nombre: 'Copy', orden: 1, color: '#3b82f6' },
  { nombre: 'Diseño', orden: 2, color: '#f59e0b' },
  { nombre: 'Revisión', orden: 3, color: '#ef4444' },
  { nombre: 'Programado', orden: 4, color: '#06b6d4' },
  { nombre: 'Publicado', orden: 5, color: '#22c55e' },
]

// GET /api/editorial/boards — list all boards (with client info)
// GET /api/editorial/boards?id_cliente=xxx — get or create board for client
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id_cliente = searchParams.get('id_cliente')

  if (id_cliente) {
    // Get or auto-create board for this client
    let { data: board } = await admin
      .from('editorial_boards')
      .select('*')
      .eq('id_cliente', id_cliente)
      .maybeSingle()

    if (!board) {
      const { data: newBoard, error: boardErr } = await admin
        .from('editorial_boards')
        .insert({ id_cliente })
        .select()
        .single()
      if (boardErr) return NextResponse.json({ error: boardErr.message }, { status: 500 })
      board = newBoard

      // Insert default columns
      const cols = COLUMNAS_DEFAULT.map(c => ({ ...c, id_board: board!.id }))
      await admin.from('editorial_columnas').insert(cols)
    }

    const { data: columnas } = await admin
      .from('editorial_columnas')
      .select('*')
      .eq('id_board', board.id)
      .order('orden')

    const { data: fichas } = await admin
      .from('editorial_fichas')
      .select('*')
      .eq('id_board', board.id)
      .order('orden')

    return NextResponse.json({ board, columnas: columnas ?? [], fichas: fichas ?? [] })
  }

  // List all boards with client name
  const { data, error } = await admin
    .from('editorial_boards')
    .select('id, id_cliente, created_at, cliente:id_cliente(id, nombre)')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/editorial/boards — create board for a client (if not exists)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id_cliente } = await req.json()
  if (!id_cliente) return NextResponse.json({ error: 'id_cliente requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('editorial_boards')
    .select('id')
    .eq('id_cliente', id_cliente)
    .maybeSingle()

  if (existing) return NextResponse.json(existing)

  const { data: board, error } = await admin
    .from('editorial_boards')
    .insert({ id_cliente })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cols = COLUMNAS_DEFAULT.map(c => ({ ...c, id_board: board.id }))
  await admin.from('editorial_columnas').insert(cols)

  return NextResponse.json(board)
}

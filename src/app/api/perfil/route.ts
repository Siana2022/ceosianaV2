import { getPerfil } from '@/lib/server/perfil'
import { NextResponse } from 'next/server'

export async function GET() {
  const perfil = await getPerfil()
  if (!perfil) return NextResponse.json(null, { status: 401 })
  return NextResponse.json(perfil)
}

import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  // Only protect (app) routes
  if (!pathname.startsWith('/dashboard') &&
      !pathname.startsWith('/hub') &&
      !pathname.startsWith('/clientes') &&
      !pathname.startsWith('/informes') &&
      !pathname.startsWith('/tareas') &&
      !pathname.startsWith('/ingresos') &&
      !pathname.startsWith('/equipo') &&
      !pathname.startsWith('/comercial') &&
      !pathname.startsWith('/dedicacion') &&
      !pathname.startsWith('/departamentos') &&
      !pathname.startsWith('/costes') &&
      !pathname.startsWith('/administracion') &&
      !pathname.startsWith('/historico') &&
      !pathname.startsWith('/fichar') &&
      !pathname.startsWith('/alertas') &&
      !pathname.startsWith('/servicios') &&
      !pathname.startsWith('/rendimiento')) {
    return res
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Check role in perfiles
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle()

  // El hub no muestra datos económicos, así que lo ve todo el equipo.

  // Empleados solo pueden acceder a /fichar y /tareas (procesos)
  const esEmpleado = perfil?.rol !== 'admin'
  const rutasEquipo = ['/dashboard', '/hub', '/tareas', '/fichar', '/editorial', '/perfil', '/alertas', '/informes']
  const rutaPermitida = rutasEquipo.some(r => pathname === r || pathname.startsWith(r + '/'))
  if (esEmpleado && !rutaPermitida) {
    return NextResponse.redirect(new URL('/fichar', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|api).*)',
  ],
}

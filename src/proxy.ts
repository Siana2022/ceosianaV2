import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  // Only protect (app) routes
  if (!pathname.startsWith('/dashboard') &&
      !pathname.startsWith('/clientes') &&
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

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Check role in perfiles
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', session.user.id)
    .maybeSingle()

  // Empleados solo pueden acceder a /fichar y /tareas (procesos)
  const esEmpleado = perfil?.rol !== 'admin'
  const rutaPermitida = pathname.startsWith('/fichar') || pathname.startsWith('/tareas')
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

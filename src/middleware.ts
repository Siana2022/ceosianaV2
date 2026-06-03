import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  // Only protect (app) routes
  if (!pathname.startsWith('/dashboard') &&
      !pathname.startsWith('/clientes') &&
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
      !pathname.startsWith('/servicios')) {
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

  // Employees can only access /fichar
  if (perfil?.rol === 'empleado' && !pathname.startsWith('/fichar')) {
    return NextResponse.redirect(new URL('/fichar', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|api).*)',
  ],
}

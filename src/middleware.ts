import { NextResponse, type NextRequest } from 'next/server'

// Check auth by looking for the Supabase session cookie directly.
// This avoids instantiating @supabase/ssr in the Edge Runtime which
// causes ByteString errors with non-ASCII cookie values on Vercel.
const PROJECT_REF = 'vbrkedtaesuoabxxyhan'

function hasSession(request: NextRequest): boolean {
  const cookies = request.cookies
  return (
    cookies.has(`sb-${PROJECT_REF}-auth-token`) ||
    cookies.has(`sb-${PROJECT_REF}-auth-token.0`) ||
    cookies.has(`sb-${PROJECT_REF}-auth-token-code-verifier`)
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authenticated = hasSession(request)

  if (!authenticated && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (authenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

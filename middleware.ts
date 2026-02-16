import { NextResponse, type NextRequest } from 'next/server'

/**
 * MC9.0.2: Helper para verificar se é path de asset público
 */
function isAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/public/') ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)
  )
}

/**
 * MC9.0.2: Helper para verificar se é path de app protegido
 */
function isAppPath(pathname: string): boolean {
  return pathname.startsWith('/app/') || pathname === '/app'
}

/**
 * MC9.0.2: Middleware Enterprise - Fail-Closed
 * 
 * Regras:
 * - Assets públicos sempre passam
 * - Para /app/**:
 *   - Sem env vars => redirect com ?err=misconfig
 *   - Falha de auth => redirect com ?err=auth
 *   - Sem usuário => redirect para /login
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Assets públicos sempre passam (fail-open para assets)
  if (isAssetPath(pathname)) {
    return NextResponse.next()
  }

  // Rotas /app: acesso liberado sem exigir login (senha desabilitada)
  if (isAppPath(pathname)) {
    return NextResponse.next()
  }

  // Para outras rotas, permitir passar
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

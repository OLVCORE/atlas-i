import { createServerClient, type CookieOptions } from '@supabase/ssr'
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

  // Para rotas de app, aplicar proteção fail-closed
  if (isAppPath(pathname)) {
    // Verificar se as variáveis de ambiente estão definidas
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      // FAIL-CLOSED: sem env vars, não entra em /app
      const url = new URL('/', request.url)
      url.searchParams.set('err', 'misconfig')
      return NextResponse.redirect(url)
    }

    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    })

    let supabase
    try {
      supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set(name: string, value: string, options: CookieOptions) {
              request.cookies.set({
                name,
                value,
                ...options,
              })
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              response.cookies.set({
                name,
                value,
                ...options,
              })
            },
            remove(name: string, options: CookieOptions) {
              request.cookies.set({
                name,
                value: '',
                ...options,
              })
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              response.cookies.set({
                name,
                value: '',
                ...options,
              })
            },
          },
        }
      )
    } catch (error) {
      // FAIL-CLOSED: erro ao criar cliente Supabase
      console.error('[middleware] Erro ao criar cliente Supabase:', error)
      const url = new URL('/', request.url)
      url.searchParams.set('err', 'misconfig')
      return NextResponse.redirect(url)
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        // FAIL-CLOSED: sem usuário ou erro de auth, não entra em /app
        const url = new URL('/login', request.url)
        if (authError) {
          url.searchParams.set('err', 'auth')
        }
        return NextResponse.redirect(url)
      }

      // Usuário autenticado, permitir acesso a /app
      return response
    } catch (error) {
      // FAIL-CLOSED: erro ao verificar usuário
      console.error('[middleware] Erro ao verificar usuário:', error)
      const url = new URL('/login', request.url)
      url.searchParams.set('err', 'auth')
      return NextResponse.redirect(url)
    }
  }

  // Para /login, redirecionar se já autenticado (opcional, mas útil)
  if (pathname === '/login') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createServerClient(
          supabaseUrl,
          supabaseAnonKey,
          {
            cookies: {
              get(name: string) {
                return request.cookies.get(name)?.value
              },
              set() {},
              remove() {},
            },
          }
        )

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          return NextResponse.redirect(new URL('/app', request.url))
        }
      } catch (error) {
        // Em caso de erro, permitir acessar login
      }
    }
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

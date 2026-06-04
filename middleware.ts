import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Inject the current pathname onto the REQUEST headers so server components
  // (e.g. the (auth) layout) can read it via headers().get('x-pathname').
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes — always allow (no authentication required). Members use the
  // /member/[token] self-service links and shared /rally-timer/[sessionId] links
  // without ever logging in, and the public APIs below back those pages.
  //
  // The /api/member/* save endpoints listed here authorize the caller via the
  // secret access_token in the request body (resolved against the service client,
  // returning 404 for an unknown token) — the SAME security model as the public
  // /member/[token] page. They must be public, otherwise an anonymous member's
  // save is redirected to "/" by the guard below, the browser follows it to a
  // 200, and the UI shows a false "Saved!" while NO database write ever happens.
  const publicPaths = [
    '/',                          // root / landing
    '/welcome',                   // public marketing page
    '/login',                     // login page
    '/auth',                      // auth callback
    '/member',                    // /member/[token] self-service profile links
    '/api/player-lookup',         // public player lookup API
    '/api/gift-codes',            // public gift-codes API
    // Self-service member endpoints (token-authorized) used by /member/[token]:
    '/api/member/stats',          // power / march / rally / troop_data / willing-to-move
    '/api/member/combat-stats',   // battle-report combat stats
    '/api/member/heroes',         // hero add / edit / delete
    '/api/member/availability',   // event attendance
    '/api/member/language',       // preferred language
    '/api/member/cache-avatar',   // persist fetched avatar url
    '/api/ocr',                   // battle-report screenshot OCR (no DB write)
  ]
  const isPublic =
    publicPaths.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    // Shared rally-timer session links (the authed /rally-timer index stays protected)
    pathname.startsWith('/rally-timer/')

  if (!isPublic && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Admin routes — require system_admin role
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'system_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

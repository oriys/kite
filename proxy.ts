import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const publicPaths = ['/', '/auth', '/components', '/api/auth', '/api/mock', '/api/error-reports', '/metrics', '/pub', '/invite']

function isPublicPath(pathname: string) {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

const STATIC_EXT = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|webp|avif)$/

function isStaticAsset(pathname: string) {
  return pathname.startsWith('/_next') || STATIC_EXT.test(pathname)
}

function isSafeCallbackUrl(url: string) {
  return url.startsWith('/') && !url.startsWith('//')
}

export default auth((req) => {
  const start = Date.now()
  const { pathname } = req.nextUrl
  const method = req.method
  const session = req.auth
  const traceId = requestIdFrom(pathname, start)

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const requestId = traceId
  const forwardHeaders = () => {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-request-id', requestId)
    requestHeaders.set('x-trace-id', traceId)
    requestHeaders.set('x-request-method', method)
    requestHeaders.set('x-request-path', pathname)
    requestHeaders.set('x-request-start-ms', String(start))
    return requestHeaders
  }
  const attachResponseHeaders = (res: NextResponse) => {
    res.headers.set('x-request-id', requestId)
    res.headers.set('x-trace-id', traceId)
    return res
  }
  const log = () => {
    const duration = Date.now() - start
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[req] ${method.padEnd(7)} ${pathname} ${duration}ms  (${requestId})`,
      )
    } else {
      console.log(
        JSON.stringify({
          type: 'access',
          event: 'request_received',
          request_id: requestId,
          trace_id: traceId,
          method,
          route: pathname,
          duration_ms: duration,
          ts: new Date().toISOString(),
        }),
      )
    }
  }

  if (isPublicPath(pathname)) {
    log()
    return attachResponseHeaders(
      NextResponse.next({
        request: {
          headers: forwardHeaders(),
        },
      }),
    )
  }

  if (!session) {
    log()
    const signInUrl = new URL('/auth/signin', req.url)
    if (isSafeCallbackUrl(pathname)) {
      signInUrl.searchParams.set('callbackUrl', pathname)
    }
    return attachResponseHeaders(NextResponse.redirect(signInUrl))
  }

  log()
  return attachResponseHeaders(
    NextResponse.next({
      request: {
        headers: forwardHeaders(),
      },
    }),
  )
})

function requestIdFrom(pathname: string, start: number) {
  return `${start.toString(36)}-${Math.random().toString(36).slice(2, 9)}-${pathname.length.toString(36)}`
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

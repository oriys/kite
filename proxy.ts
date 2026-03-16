import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const publicPaths = ['/', '/auth', '/components', '/api/auth', '/api/mock', '/pub', '/invite']

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

function generateRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export default auth((req) => {
  const start = Date.now()
  const { pathname } = req.nextUrl
  const method = req.method
  const session = req.auth

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const requestId = generateRequestId()
  const log = () => {
    const duration = Date.now() - start
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[req] ${method.padEnd(7)} ${pathname} ${duration}ms  (${requestId})`,
      )
    } else {
      console.log(
        JSON.stringify({ requestId, method, path: pathname, duration, ts: new Date().toISOString() }),
      )
    }
  }

  if (isPublicPath(pathname)) {
    log()
    const res = NextResponse.next()
    res.headers.set('x-request-id', requestId)
    return res
  }

  if (!session) {
    log()
    const signInUrl = new URL('/auth/signin', req.url)
    if (isSafeCallbackUrl(pathname)) {
      signInUrl.searchParams.set('callbackUrl', pathname)
    }
    return NextResponse.redirect(signInUrl)
  }

  log()
  const res = NextResponse.next()
  res.headers.set('x-request-id', requestId)
  return res
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

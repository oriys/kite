import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const publicPaths = ['/', '/auth', '/components', '/api/auth']

function isPublicPath(pathname: string) {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
}

const STATIC_EXT = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|webp|avif)$/

function isStaticAsset(pathname: string) {
  return pathname.startsWith('/_next') || STATIC_EXT.test(pathname)
}

function isSafeCallbackUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  if (isStaticAsset(pathname) || isPublicPath(pathname)) {
    return NextResponse.next()
  }

  if (!session) {
    const signInUrl = new URL('/auth/signin', req.url)
    if (isSafeCallbackUrl(pathname)) {
      signInUrl.searchParams.set('callbackUrl', pathname)
    }
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

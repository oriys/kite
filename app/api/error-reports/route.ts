import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { captureClientError } from '@/lib/error-collector'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * POST /api/error-reports
 * Public endpoint for client-side error reporting (from error boundaries / window.onerror).
 * No auth required — rate-limited by IP.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = checkRateLimit(`error-report:${ip}`, RATE_LIMITS.errorReports)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    errorName,
    errorMessage,
    errorStack,
    componentStack,
    url,
    userId,
    context,
  } = body

  if (!errorMessage || typeof errorMessage !== 'string') {
    return NextResponse.json(
      { error: 'errorMessage is required' },
      { status: 400 },
    )
  }

  await captureClientError({
    errorName: typeof errorName === 'string' ? errorName : undefined,
    errorMessage,
    errorStack: typeof errorStack === 'string' ? errorStack : undefined,
    componentStack: typeof componentStack === 'string' ? componentStack : undefined,
    url: typeof url === 'string' ? url : undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
    userId: typeof userId === 'string' ? userId : undefined,
    context: typeof context === 'object' && context !== null
      ? context as Record<string, unknown>
      : undefined,
  })

  return NextResponse.json({ ok: true })
}

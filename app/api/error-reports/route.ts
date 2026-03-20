import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { captureClientError } from '@/lib/error-collector'
import { withRouteObservability } from '@/lib/observability/route-handler'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getAuthenticatedUser, resolveAuthenticatedUser } from '@/lib/api-utils'
import { getDefaultWorkspace } from '@/lib/queries/workspaces'

async function resolveReportingIdentity() {
  try {
    const sessionUser = await getAuthenticatedUser()
    const user = await resolveAuthenticatedUser(sessionUser)
    if (!user?.id) {
      return {}
    }

    const workspace = await getDefaultWorkspace(user.id)

    return {
      userId: user.id,
      workspaceId: workspace?.id,
    }
  } catch {
    return {}
  }
}

/**
 * POST /api/error-reports
 * Public endpoint for client-side error reporting (from error boundaries / window.onerror).
 * No auth required — rate-limited by IP.
 */
async function postErrorReport(request: NextRequest) {
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
    errorDigest,
    url,
    context,
  } = body

  if (!errorMessage || typeof errorMessage !== 'string') {
    return NextResponse.json(
      { error: 'errorMessage is required' },
      { status: 400 },
    )
  }

  const identity = await resolveReportingIdentity()
  const requestId = request.headers.get('x-request-id') ?? undefined

  await captureClientError({
    errorName: typeof errorName === 'string' ? errorName : undefined,
    errorMessage,
    errorStack: typeof errorStack === 'string' ? errorStack : undefined,
    componentStack: typeof componentStack === 'string' ? componentStack : undefined,
    errorDigest: typeof errorDigest === 'string' ? errorDigest : undefined,
    url: typeof url === 'string' ? url : undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
    userId: identity.userId,
    workspaceId: identity.workspaceId,
    requestId,
    ipAddress: ip !== 'unknown' ? ip : undefined,
    context: typeof context === 'object' && context !== null
      ? {
          ...(context as Record<string, unknown>),
          reporter: 'client',
        }
      : {
          reporter: 'client',
        },
  })

  return NextResponse.json({ ok: true })
}

export const POST = withRouteObservability(postErrorReport, {
  route: '/api/error-reports',
})

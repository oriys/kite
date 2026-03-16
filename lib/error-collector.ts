import { db } from './db'
import { errorLogs } from './schema-errors'
import { headers } from 'next/headers'

const MAX_BODY_LENGTH = 8_000
const MAX_STACK_LENGTH = 16_000
const MAX_URL_LENGTH = 2_000

type ErrorLevel = 'warn' | 'error' | 'fatal'
type ErrorSource =
  | 'api-route'
  | 'server-action'
  | 'server-component'
  | 'client'
  | 'middleware'
  | 'cron'
  | 'webhook'
  | 'unknown'

export interface ErrorContext {
  level?: ErrorLevel
  source?: ErrorSource
  userId?: string
  workspaceId?: string
  sessionId?: string
  requestId?: string
  httpMethod?: string
  httpUrl?: string
  httpStatus?: number
  httpHeaders?: Record<string, string>
  httpBody?: string
  userAgent?: string
  ipAddress?: string
  context?: Record<string, unknown>
}

function truncate(value: string | undefined | null, max: number): string | undefined {
  if (!value) return undefined
  return value.length > max ? value.slice(0, max) + '…[truncated]' : value
}

function generateFingerprint(
  errorName: string | undefined,
  errorMessage: string | undefined,
  errorStack: string | undefined,
): string {
  const firstFrame = errorStack
    ?.split('\n')
    .find((line) => line.trim().startsWith('at '))
    ?.trim() ?? ''
  const raw = `${errorName ?? ''}:${errorMessage ?? ''}:${firstFrame}`
  // Simple hash — good enough for grouping
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i)
    hash = ((hash << 5) - hash + chr) | 0
  }
  return `fp_${(hash >>> 0).toString(36)}`
}

function serializeErrorChain(error: unknown): {
  errorName?: string
  errorMessage?: string
  errorStack?: string
  errorCause?: string
} {
  if (!(error instanceof Error)) {
    return {
      errorName: 'NonError',
      errorMessage: typeof error === 'string' ? error : JSON.stringify(error),
    }
  }

  const causeChain: string[] = []
  let current: unknown = error.cause
  let depth = 0
  while (current && depth < 5) {
    if (current instanceof Error) {
      causeChain.push(`${current.name}: ${current.message}`)
      current = current.cause
    } else {
      causeChain.push(String(current))
      break
    }
    depth++
  }

  return {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: truncate(error.stack, MAX_STACK_LENGTH),
    errorCause: causeChain.length > 0 ? causeChain.join(' → ') : undefined,
  }
}

function safeHeadersToRecord(h: Record<string, string | string[] | undefined>): Record<string, string> {
  const result: Record<string, string> = {}
  const sensitiveKeys = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token'])
  for (const [key, value] of Object.entries(h)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      result[key] = '[redacted]'
    } else {
      result[key] = Array.isArray(value) ? value.join(', ') : (value ?? '')
    }
  }
  return result
}

/**
 * Try to extract request metadata from Next.js headers().
 * Safe to call anywhere — returns empty object if headers aren't available.
 */
async function tryExtractRequestHeaders(): Promise<Partial<ErrorContext>> {
  try {
    const h = await headers()
    return {
      requestId: h.get('x-request-id') ?? undefined,
      userAgent: h.get('user-agent') ?? undefined,
      ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? undefined,
    }
  } catch {
    return {}
  }
}

/**
 * Core error capture — fire-and-forget DB insert.
 * NEVER throws. NEVER blocks the caller.
 */
export async function captureError(
  error: unknown,
  ctx: ErrorContext = {},
): Promise<void> {
  try {
    const { errorName, errorMessage, errorStack, errorCause } = serializeErrorChain(error)
    const requestCtx = await tryExtractRequestHeaders()

    const fingerprint = generateFingerprint(errorName, errorMessage, errorStack)
    const digest = error instanceof Error && 'digest' in error
      ? String((error as Error & { digest?: string }).digest)
      : undefined

    await db.insert(errorLogs).values({
      level: ctx.level ?? 'error',
      source: ctx.source ?? 'unknown',
      errorName,
      errorMessage: truncate(errorMessage, MAX_BODY_LENGTH),
      errorStack,
      errorCause: truncate(errorCause, MAX_BODY_LENGTH),
      errorDigest: digest,
      fingerprint,
      httpMethod: ctx.httpMethod,
      httpUrl: truncate(ctx.httpUrl, MAX_URL_LENGTH),
      httpStatus: ctx.httpStatus,
      httpHeaders: ctx.httpHeaders,
      httpBody: truncate(ctx.httpBody, MAX_BODY_LENGTH),
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      sessionId: ctx.sessionId,
      requestId: ctx.requestId ?? requestCtx.requestId,
      userAgent: ctx.userAgent ?? requestCtx.userAgent,
      ipAddress: ctx.ipAddress ?? requestCtx.ipAddress,
      context: ctx.context,
    })
  } catch (insertError) {
    // Last resort: log to console so we don't lose the original error
    console.error('[error-collector] Failed to persist error:', insertError)
    console.error('[error-collector] Original error:', error)
  }
}

/**
 * Capture error with full API request context.
 * Extracts HTTP info from NextRequest and workspace context.
 */
export async function captureApiError(
  error: unknown,
  request: Request,
  authCtx?: { userId?: string; workspaceId?: string },
  extra?: Partial<ErrorContext>,
): Promise<void> {
  let body: string | undefined
  try {
    body = await request.clone().text()
  } catch {
    body = undefined
  }

  const url = new URL(request.url)
  const headerEntries: Record<string, string> = {}
  request.headers.forEach((v, k) => {
    headerEntries[k] = v
  })

  return captureError(error, {
    source: 'api-route',
    httpMethod: request.method,
    httpUrl: `${url.pathname}${url.search}`,
    httpHeaders: safeHeadersToRecord(headerEntries),
    httpBody: truncate(body, MAX_BODY_LENGTH),
    userId: authCtx?.userId,
    workspaceId: authCtx?.workspaceId,
    ...extra,
  })
}

/**
 * Wrap a Next.js API route handler to auto-capture unhandled errors.
 * Returns 500 with a safe error message; logs full context to DB.
 */
export function withErrorCapture<T extends Request>(
  handler: (request: T, ...args: unknown[]) => Promise<Response>,
  opts?: { source?: ErrorSource },
): (request: T, ...args: unknown[]) => Promise<Response> {
  return async (request: T, ...args: unknown[]) => {
    try {
      return await handler(request, ...args)
    } catch (error) {
      await captureApiError(error, request, undefined, {
        source: opts?.source ?? 'api-route',
        httpStatus: 500,
      })

      return Response.json(
        { error: 'Internal server error' },
        { status: 500 },
      )
    }
  }
}

/**
 * Capture a client-reported error (from error boundary / window.onerror).
 * Validates shape before inserting.
 */
export async function captureClientError(payload: {
  errorName?: string
  errorMessage?: string
  errorStack?: string
  componentStack?: string
  url?: string
  userAgent?: string
  userId?: string
  context?: Record<string, unknown>
}): Promise<void> {
  const fingerprint = generateFingerprint(
    payload.errorName,
    payload.errorMessage,
    payload.errorStack,
  )

  try {
    await db.insert(errorLogs).values({
      level: 'error',
      source: 'client',
      errorName: payload.errorName,
      errorMessage: truncate(payload.errorMessage, MAX_BODY_LENGTH),
      errorStack: truncate(payload.errorStack, MAX_STACK_LENGTH),
      fingerprint,
      httpUrl: truncate(payload.url, MAX_URL_LENGTH),
      userId: payload.userId,
      userAgent: payload.userAgent,
      context: {
        ...payload.context,
        ...(payload.componentStack
          ? { componentStack: payload.componentStack.slice(0, 4000) }
          : {}),
      },
    })
  } catch (insertError) {
    console.error('[error-collector] Failed to persist client error:', insertError)
  }
}

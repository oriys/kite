import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { headers as nextHeaders } from 'next/headers'

export interface RequestContext {
  requestId: string
  traceId: string
  startedAt: number
  method?: string
  route?: string
  userId?: string
  workspaceId?: string
  workspaceName?: string
  role?: string
}

type GlobalRequestContext = typeof globalThis & {
  __kiteRequestContextStorage?: AsyncLocalStorage<RequestContext>
}

const globalForRequestContext = globalThis as GlobalRequestContext

const requestContextStorage = globalForRequestContext.__kiteRequestContextStorage
  ?? (globalForRequestContext.__kiteRequestContextStorage = new AsyncLocalStorage<RequestContext>())

const INTEGER_SEGMENT_RE = /^\d+$/
const UUID_SEGMENT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HEX_SEGMENT_RE = /^[0-9a-f]{16,}$/i
const LONG_ID_SEGMENT_RE = /^(?:[a-z0-9]{20,}|[a-z0-9_-]{24,})$/i
const RESOURCE_COLLECTIONS = new Set([
  'agent',
  'api-versions',
  'approval-policies',
  'approvals',
  'auth-configs',
  'documents',
  'doc-snippets',
  'environments',
  'grpc',
  'integrations',
  'invites',
  'knowledge-sources',
  'link-checks',
  'mcp-servers',
  'members',
  'mock-servers',
  'notification-channels',
  'openapi',
  'partner-groups',
  'providers',
  'sessions',
  'teams',
  'templates',
  'tokens',
  'translations',
  'users',
  'webhooks',
  'workspaces',
])

function mergeDefined<T extends object>(base: T, overrides: Partial<T>): T {
  const merged = { ...base }

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      Object.assign(merged, { [key]: value })
    }
  }

  return merged
}

function getRoutePlaceholder(previousSegment: string | undefined) {
  if (previousSegment === 'pub') return ':slug'
  return ':id'
}

function shouldNormalizeSegment(
  segment: string,
  index: number,
  segments: string[],
) {
  if (!segment) return false
  if (segment.startsWith('[') && segment.endsWith(']')) return true
  if (segments[index - 1] === 'pub') return true
  if (
    INTEGER_SEGMENT_RE.test(segment)
    || UUID_SEGMENT_RE.test(segment)
    || HEX_SEGMENT_RE.test(segment)
    || LONG_ID_SEGMENT_RE.test(segment)
  ) {
    return true
  }

  const previousSegment = segments[index - 1]
  return Boolean(
    previousSegment
      && RESOURCE_COLLECTIONS.has(previousSegment)
      && /[0-9]/.test(segment)
      && segment.length >= 6,
  )
}

function normalizePathname(pathname: string) {
  const [rawPathname] = pathname.split('?')
  const segments = rawPathname.split('/').filter(Boolean)

  if (segments.length === 0) return '/'

  const normalized = segments.map((segment, index) => (
    shouldNormalizeSegment(segment, index, segments)
      ? getRoutePlaceholder(segments[index - 1])
      : segment
  ))

  return `/${normalized.join('/')}`
}

function getStartedAt(value: number | undefined) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  return Date.now()
}

function createRequestContext(overrides: Partial<RequestContext> = {}): RequestContext {
  const requestId = overrides.requestId ?? randomUUID()
  const traceId = overrides.traceId ?? requestId

  return {
    requestId,
    traceId,
    startedAt: getStartedAt(overrides.startedAt),
    method: overrides.method,
    route: overrides.route,
    userId: overrides.userId,
    workspaceId: overrides.workspaceId,
    workspaceName: overrides.workspaceName,
    role: overrides.role,
  }
}

export function normalizeHttpRoute(pathname: string) {
  return normalizePathname(pathname)
}

export function getRequestContext() {
  return requestContextStorage.getStore()
}

export function runWithRequestContext<T>(context: RequestContext, callback: () => T) {
  return requestContextStorage.run(context, callback)
}

export function ensureRequestContext(overrides: Partial<RequestContext> = {}) {
  const current = getRequestContext()
  const nextContext = current
    ? mergeDefined(current, overrides)
    : createRequestContext(overrides)

  requestContextStorage.enterWith(nextContext)
  return nextContext
}

export function updateRequestContext(overrides: Partial<RequestContext>) {
  return ensureRequestContext(overrides)
}

export function buildRequestContextFromRequest(
  request: Request,
  overrides: Partial<RequestContext> = {},
) {
  const requestId = request.headers.get('x-request-id') ?? overrides.requestId ?? randomUUID()
  const traceId = request.headers.get('x-trace-id') ?? overrides.traceId ?? requestId
  const route = overrides.route ?? normalizeHttpRoute(new URL(request.url).pathname)
  const startedAtHeader = request.headers.get('x-request-start-ms')
  const startedAt = startedAtHeader ? Number.parseInt(startedAtHeader, 10) : overrides.startedAt

  return createRequestContext({
    requestId,
    traceId,
    startedAt,
    method: request.method,
    route,
    ...overrides,
  })
}

export async function seedRequestContextFromHeaders(overrides: Partial<RequestContext> = {}) {
  const current = getRequestContext()
  if (current) {
    return updateRequestContext(overrides)
  }

  try {
    const headerStore = await nextHeaders()
    const requestId = overrides.requestId ?? headerStore.get('x-request-id') ?? randomUUID()
    const traceId = overrides.traceId ?? headerStore.get('x-trace-id') ?? requestId
    const routeHeader = headerStore.get('x-request-path')
    const startedAtHeader = headerStore.get('x-request-start-ms')
    const startedAt = startedAtHeader ? Number.parseInt(startedAtHeader, 10) : overrides.startedAt

    return ensureRequestContext({
      requestId,
      traceId,
      startedAt,
      method: overrides.method ?? headerStore.get('x-request-method') ?? undefined,
      route: overrides.route ?? (routeHeader ? normalizeHttpRoute(routeHeader) : undefined),
      userId: overrides.userId,
      workspaceId: overrides.workspaceId,
      workspaceName: overrides.workspaceName,
      role: overrides.role,
    })
  } catch {
    return ensureRequestContext(overrides)
  }
}

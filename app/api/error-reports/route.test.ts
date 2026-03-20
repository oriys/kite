import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  captureClientErrorMock,
  checkRateLimitMock,
  getAuthenticatedUserMock,
  resolveAuthenticatedUserMock,
  getDefaultWorkspaceMock,
} = vi.hoisted(() => ({
  captureClientErrorMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getAuthenticatedUserMock: vi.fn(),
  resolveAuthenticatedUserMock: vi.fn(),
  getDefaultWorkspaceMock: vi.fn(),
}))

vi.mock('@/lib/error-collector', () => ({
  captureClientError: captureClientErrorMock,
}))

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: {
    errorReports: { windowMs: 60_000, max: 20 },
  },
  checkRateLimit: checkRateLimitMock,
}))

vi.mock('@/lib/api-utils', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
  resolveAuthenticatedUser: resolveAuthenticatedUserMock,
}))

vi.mock('@/lib/queries/workspaces', () => ({
  getDefaultWorkspace: getDefaultWorkspaceMock,
}))

describe('POST /api/error-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, resetMs: 0 })
    captureClientErrorMock.mockResolvedValue(undefined)
    getAuthenticatedUserMock.mockResolvedValue({ id: 'session_user', email: 'user@example.com' })
    resolveAuthenticatedUserMock.mockResolvedValue({ id: 'user_123' })
    getDefaultWorkspaceMock.mockResolvedValue({ id: 'ws_123' })
  })

  it('enriches client reports with authenticated user and workspace context', async () => {
    const { POST } = await import('./route')

    const response = await POST(
      new Request('http://localhost/api/error-reports', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Vitest Browser',
          'x-forwarded-for': '203.0.113.9',
          'x-request-id': 'req_123',
        },
        body: JSON.stringify({
          errorName: 'TypeError',
          errorMessage: 'Boom',
          errorStack: 'stack trace',
          componentStack: 'component stack',
          errorDigest: 'digest_123',
          url: 'https://kite.test/docs/settings/error-reports',
          userId: 'spoofed_user',
          context: {
            source: 'window.onerror',
          },
        }),
      }) as never,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req_123')
    expect(response.headers.get('x-trace-id')).toBe('req_123')
    expect(captureClientErrorMock).toHaveBeenCalledWith({
      errorName: 'TypeError',
      errorMessage: 'Boom',
      errorStack: 'stack trace',
      componentStack: 'component stack',
      errorDigest: 'digest_123',
      url: 'https://kite.test/docs/settings/error-reports',
      userAgent: 'Vitest Browser',
      userId: 'user_123',
      workspaceId: 'ws_123',
      requestId: 'req_123',
      ipAddress: '203.0.113.9',
      context: {
        source: 'window.onerror',
        reporter: 'client',
      },
    })
  })

  it('does not trust spoofed user identifiers when there is no session', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null)
    resolveAuthenticatedUserMock.mockResolvedValue(null)
    getDefaultWorkspaceMock.mockResolvedValue(null)

    const { POST } = await import('./route')

    const response = await POST(
      new Request('http://localhost/api/error-reports', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Vitest Browser',
        },
        body: JSON.stringify({
          errorMessage: 'Manual client event',
          userId: 'spoofed_user',
        }),
      }) as never,
    )

    expect(response.status).toBe(200)
    expect(captureClientErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: 'Manual client event',
        userId: undefined,
        workspaceId: undefined,
      }),
    )
  })
})

import { describe, expect, it } from 'vitest'

describe('GET /metrics', () => {
  it('returns Prometheus-compatible metrics text', async () => {
    const { GET } = await import('./route')

    const response = await GET()
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(text).toContain('http_requests_total')
    expect(text).toContain('db_query_total')
    expect(text).toContain('app_uptime_seconds')
    expect(text).toContain('domain_event_total')
  })
})

import { describe, expect, it } from 'vitest'
import { normalizeHttpRoute } from '@/lib/observability/request-context'

describe('normalizeHttpRoute', () => {
  it('preserves static routes', () => {
    expect(normalizeHttpRoute('/api/error-reports')).toBe('/api/error-reports')
  })

  it('normalizes numeric and UUID segments', () => {
    expect(
      normalizeHttpRoute('/api/documents/123/comments/550e8400-e29b-41d4-a716-446655440000'),
    ).toBe('/api/documents/:id/comments/:id')
  })

  it('normalizes public doc slugs', () => {
    expect(normalizeHttpRoute('/pub/getting-started')).toBe('/pub/:slug')
  })
})

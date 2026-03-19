import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '../rate-limit'

describe('checkRateLimit', () => {
  const opts = { maxTokens: 3, refillRate: 3, refillInterval: 60_000 }

  it('allows requests up to the token limit', () => {
    const key = `test-allow-${Date.now()}`
    expect(checkRateLimit(key, opts).allowed).toBe(true)
    expect(checkRateLimit(key, opts).allowed).toBe(true)
    expect(checkRateLimit(key, opts).allowed).toBe(true)
  })

  it('blocks after tokens are exhausted', () => {
    const key = `test-block-${Date.now()}`
    checkRateLimit(key, opts)
    checkRateLimit(key, opts)
    checkRateLimit(key, opts)
    const result = checkRateLimit(key, opts)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('returns remaining token count', () => {
    const key = `test-remaining-${Date.now()}`
    const r1 = checkRateLimit(key, opts)
    expect(r1.remaining).toBe(2) // started at 3, consumed 1
    const r2 = checkRateLimit(key, opts)
    expect(r2.remaining).toBe(1)
  })

  it('returns resetMs', () => {
    const key = `test-reset-${Date.now()}`
    const result = checkRateLimit(key, opts)
    expect(result.resetMs).toBeGreaterThan(0)
    expect(result.resetMs).toBeLessThanOrEqual(60_000)
  })

  it('uses separate buckets for different keys', () => {
    const key1 = `test-sep1-${Date.now()}`
    const key2 = `test-sep2-${Date.now()}`
    checkRateLimit(key1, opts)
    checkRateLimit(key1, opts)
    checkRateLimit(key1, opts)
    // key1 exhausted, key2 should still be fine
    expect(checkRateLimit(key1, opts).allowed).toBe(false)
    expect(checkRateLimit(key2, opts).allowed).toBe(true)
  })
})

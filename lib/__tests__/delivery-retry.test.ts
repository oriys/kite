import { describe, it, expect, vi } from 'vitest'

// Mock db to prevent DATABASE_URL requirement
vi.mock('@/lib/db', () => ({
  db: {},
}))

vi.mock('@/lib/schema', () => ({
  webhooks: {},
  webhookDeliveries: {},
  notificationChannels: {},
  channelDeliveries: {},
}))

vi.mock('@/lib/notification-sender', () => ({
  deliverToChannel: vi.fn(),
}))

import { computeBackoffDelay } from '../delivery-retry'

describe('computeBackoffDelay', () => {
  it('returns base delay for first attempt', () => {
    expect(computeBackoffDelay(0)).toBe(1000) // 1000 * 2^0 = 1000
  })

  it('doubles delay for each subsequent attempt', () => {
    expect(computeBackoffDelay(1)).toBe(2000) // 1000 * 2^1
    expect(computeBackoffDelay(2)).toBe(4000) // 1000 * 2^2
    expect(computeBackoffDelay(3)).toBe(8000) // 1000 * 2^3
    expect(computeBackoffDelay(4)).toBe(16000) // 1000 * 2^4
  })

  it('caps at 300 seconds (300000ms)', () => {
    expect(computeBackoffDelay(10)).toBe(300_000) // 1000 * 2^10 = 1024000, capped
    expect(computeBackoffDelay(20)).toBe(300_000)
    expect(computeBackoffDelay(100)).toBe(300_000)
  })

  it('reaches cap between attempt 8 and 9', () => {
    expect(computeBackoffDelay(8)).toBe(256_000) // 1000 * 256 = 256000 (below cap)
    expect(computeBackoffDelay(9)).toBe(300_000) // 1000 * 512 = 512000, capped at 300000
  })
})

/**
 * Simple in-memory token bucket rate limiter.
 * Sufficient for single-instance deployments.
 * For multi-instance, replace with upstash/ratelimit or Redis-backed solution.
 */

interface Bucket {
  tokens: number
  lastRefill: number
}

interface RateLimiterOptions {
  /** Maximum tokens (requests) in the bucket */
  maxTokens: number
  /** How many tokens to refill per interval */
  refillRate: number
  /** Refill interval in milliseconds */
  refillInterval: number
}

const buckets = new Map<string, Bucket>()

// Periodically clean stale buckets to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
let lastCleanup = Date.now()

function cleanupStaleBuckets(maxAge: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > maxAge) {
      buckets.delete(key)
    }
  }
}

export function checkRateLimit(
  key: string,
  options: RateLimiterOptions,
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now()

  cleanupStaleBuckets(options.refillInterval * 10)

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: options.maxTokens, lastRefill: now }
    buckets.set(key, bucket)
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill
  if (elapsed > 0) {
    const refills = Math.floor(elapsed / options.refillInterval)
    if (refills > 0) {
      bucket.tokens = Math.min(options.maxTokens, bucket.tokens + refills * options.refillRate)
      bucket.lastRefill += refills * options.refillInterval
    }
  }

  if (bucket.tokens > 0) {
    bucket.tokens--
    return {
      allowed: true,
      remaining: bucket.tokens,
      resetMs: options.refillInterval - (now - bucket.lastRefill),
    }
  }

  return {
    allowed: false,
    remaining: 0,
    resetMs: options.refillInterval - (now - bucket.lastRefill),
  }
}

/** Pre-configured rate limits for critical endpoints */
export const RATE_LIMITS = {
  /** AI chat: 10 requests per minute per user */
  aiChat: { maxTokens: 10, refillRate: 10, refillInterval: 60_000 },
  /** AI doc generation: 5 requests per minute per user */
  aiGenerate: { maxTokens: 5, refillRate: 5, refillInterval: 60_000 },
  /** Search: 30 requests per minute per user */
  search: { maxTokens: 30, refillRate: 30, refillInterval: 60_000 },
  /** Error reports: 20 requests per minute per IP (unauthenticated) */
  errorReports: { maxTokens: 20, refillRate: 20, refillInterval: 60_000 },
} as const

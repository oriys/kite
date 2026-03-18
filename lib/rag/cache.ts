import { createHash } from 'crypto'
import { and, eq, or, gt, isNull } from 'drizzle-orm'
import { logServerError } from '@/lib/server-errors'

export type RagCacheType = 'keywords' | 'query_context' | 'summary'

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(String(value))
}

export function createRagCacheKey(parts: unknown[]): string {
  return createHash('sha256')
    .update(stableStringify(parts))
    .digest('hex')
}

async function loadRagCacheDb() {
  const [{ db }, { aiRagCacheEntries }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/schema-ai'),
  ])

  return {
    db,
    aiRagCacheEntries,
  }
}

export async function getRagCacheEntry<T>(input: {
  workspaceId: string
  cacheType: RagCacheType
  cacheKey: string
}): Promise<T | null> {
  try {
    const { db, aiRagCacheEntries } = await loadRagCacheDb()
    const [entry] = await db
      .select({
        payload: aiRagCacheEntries.payload,
      })
      .from(aiRagCacheEntries)
      .where(
        and(
          eq(aiRagCacheEntries.workspaceId, input.workspaceId),
          eq(aiRagCacheEntries.cacheType, input.cacheType),
          eq(aiRagCacheEntries.cacheKey, input.cacheKey),
          or(
            isNull(aiRagCacheEntries.expiresAt),
            gt(aiRagCacheEntries.expiresAt, new Date()),
          ),
        ),
      )
      .limit(1)

    return (entry?.payload as T | undefined) ?? null
  } catch (error) {
    logServerError('Failed to read RAG cache entry.', error, {
      workspaceId: input.workspaceId,
      cacheType: input.cacheType,
    })
    return null
  }
}

export async function setRagCacheEntry<T>(input: {
  workspaceId: string
  cacheType: RagCacheType
  cacheKey: string
  payload: T
  ttlSeconds?: number
}): Promise<void> {
  try {
    const { db, aiRagCacheEntries } = await loadRagCacheDb()
    const now = new Date()
    const expiresAt =
      typeof input.ttlSeconds === 'number' && input.ttlSeconds > 0
        ? new Date(now.getTime() + input.ttlSeconds * 1000)
        : null

    await db
      .insert(aiRagCacheEntries)
      .values({
        workspaceId: input.workspaceId,
        cacheType: input.cacheType,
        cacheKey: input.cacheKey,
        payload: input.payload as Record<string, unknown>,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          aiRagCacheEntries.workspaceId,
          aiRagCacheEntries.cacheType,
          aiRagCacheEntries.cacheKey,
        ],
        set: {
          payload: input.payload as Record<string, unknown>,
          expiresAt,
          updatedAt: now,
        },
      })
  } catch (error) {
    logServerError('Failed to write RAG cache entry.', error, {
      workspaceId: input.workspaceId,
      cacheType: input.cacheType,
    })
  }
}

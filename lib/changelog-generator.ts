import { db } from './db'
import { publishedSnapshots } from './schema'
import { eq, and, desc } from 'drizzle-orm'

interface ChangelogEntry {
  version: number
  title: string
  publishedAt: Date
  publishedBy: string | null
  isRollback: boolean
  rollbackOf: number | null
}

export async function generateChangelog(
  workspaceId: string,
  options: {
    limit?: number
    documentId?: string
  } = {},
) {
  const { limit = 50, documentId } = options

  const conditions = [eq(publishedSnapshots.workspaceId, workspaceId)]
  if (documentId) {
    conditions.push(eq(publishedSnapshots.documentId, documentId))
  }

  const snapshots = await db
    .select({
      version: publishedSnapshots.version,
      documentId: publishedSnapshots.documentId,
      title: publishedSnapshots.title,
      summary: publishedSnapshots.summary,
      publishedAt: publishedSnapshots.publishedAt,
      publishedBy: publishedSnapshots.publishedBy,
      rollbackOf: publishedSnapshots.rollbackOf,
    })
    .from(publishedSnapshots)
    .where(and(...conditions))
    .orderBy(desc(publishedSnapshots.publishedAt))
    .limit(limit)

  const entries: ChangelogEntry[] = snapshots.map((s) => ({
    version: s.version,
    title: s.title,
    publishedAt: s.publishedAt,
    publishedBy: s.publishedBy,
    isRollback: s.rollbackOf !== null,
    rollbackOf: s.rollbackOf,
  }))

  // Group by date
  const byDate = new Map<string, ChangelogEntry[]>()
  for (const entry of entries) {
    const dateKey = entry.publishedAt.toISOString().split('T')[0]
    if (!byDate.has(dateKey)) byDate.set(dateKey, [])
    byDate.get(dateKey)!.push(entry)
  }

  return {
    entries,
    byDate: Object.fromEntries(byDate),
  }
}

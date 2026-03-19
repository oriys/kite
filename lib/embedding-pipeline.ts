import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documentChunks } from '@/lib/schema'

/**
 * Check embedding coverage for a workspace (knowledge-source chunks only).
 */
export async function getEmbeddingStatus(workspaceId: string) {
  const [ksCountResult, chunkCountResult] = await Promise.all([
    db.execute(sql`
      SELECT count(*) AS count FROM knowledge_sources
      WHERE workspace_id = ${workspaceId} AND deleted_at IS NULL
    `),
    db.execute(sql`
      SELECT
        count(DISTINCT ${documentChunks.knowledgeSourceId}) AS ks_count,
        count(*) AS chunk_count
      FROM ${documentChunks}
      WHERE ${documentChunks.workspaceId} = ${workspaceId}
        AND ${documentChunks.knowledgeSourceId} IS NOT NULL
    `),
  ])

  const totalKnowledgeSources = Number(
    (ksCountResult as unknown as Array<Record<string, unknown>>)[0]?.count ?? 0,
  )
  const embeddedSources = Number(
    (chunkCountResult as unknown as Array<Record<string, unknown>>)[0]?.ks_count ?? 0,
  )
  const totalChunks = Number(
    (chunkCountResult as unknown as Array<Record<string, unknown>>)[0]?.chunk_count ?? 0,
  )

  return {
    totalKnowledgeSources,
    embeddedSources,
    totalChunks,
    coverage: totalKnowledgeSources > 0 ? embeddedSources / totalKnowledgeSources : 0,
  }
}

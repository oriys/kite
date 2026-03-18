/**
 * Embedding health check — detects stale vectors from a different model.
 *
 * When the workspace switches embedding models, old vectors remain in a
 * different vector space.  This utility surfaces the mismatch so the caller
 * can decide to re-embed.
 */

import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { documentChunks } from '@/lib/schema'
import { kgEntities, kgRelations } from '@/lib/schema-kg'
import { resolveEmbeddingProvider } from '@/lib/ai-server'

export interface EmbeddingHealthReport {
  currentModelId: string
  chunks: { total: number; stale: number; missing: number }
  kgEntities: { total: number; stale: number; missing: number }
  kgRelations: { total: number; stale: number; missing: number }
  healthy: boolean
}

/**
 * Check if stored embeddings match the currently configured model.
 */
export async function checkEmbeddingHealth(
  workspaceId: string,
): Promise<EmbeddingHealthReport | null> {
  const config = await resolveEmbeddingProvider(workspaceId)
  if (!config) return null

  const currentModelId = config.modelId

  const [chunkStats, entityStats, relationStats] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        stale: sql<number>`count(*) FILTER (WHERE ${documentChunks.embeddingModelId} IS NOT NULL AND ${documentChunks.embeddingModelId} != ${currentModelId})`,
        missing: sql<number>`count(*) FILTER (WHERE ${documentChunks.embedding} IS NULL)`,
      })
      .from(documentChunks)
      .where(eq(documentChunks.workspaceId, workspaceId)),
    db
      .select({
        total: sql<number>`count(*)`,
        stale: sql<number>`count(*) FILTER (WHERE ${kgEntities.embeddingModelId} IS NOT NULL AND ${kgEntities.embeddingModelId} != ${currentModelId})`,
        missing: sql<number>`count(*) FILTER (WHERE ${kgEntities.embedding} IS NULL)`,
      })
      .from(kgEntities)
      .where(eq(kgEntities.workspaceId, workspaceId)),
    db
      .select({
        total: sql<number>`count(*)`,
        stale: sql<number>`count(*) FILTER (WHERE ${kgRelations.embeddingModelId} IS NOT NULL AND ${kgRelations.embeddingModelId} != ${currentModelId})`,
        missing: sql<number>`count(*) FILTER (WHERE ${kgRelations.embedding} IS NULL)`,
      })
      .from(kgRelations)
      .where(eq(kgRelations.workspaceId, workspaceId)),
  ])

  const chunks = {
    total: Number(chunkStats[0]?.total ?? 0),
    stale: Number(chunkStats[0]?.stale ?? 0),
    missing: Number(chunkStats[0]?.missing ?? 0),
  }
  const entities = {
    total: Number(entityStats[0]?.total ?? 0),
    stale: Number(entityStats[0]?.stale ?? 0),
    missing: Number(entityStats[0]?.missing ?? 0),
  }
  const relations = {
    total: Number(relationStats[0]?.total ?? 0),
    stale: Number(relationStats[0]?.stale ?? 0),
    missing: Number(relationStats[0]?.missing ?? 0),
  }

  return {
    currentModelId,
    chunks,
    kgEntities: entities,
    kgRelations: relations,
    healthy:
      chunks.stale === 0 &&
      chunks.missing === 0 &&
      entities.stale === 0 &&
      entities.missing === 0 &&
      relations.stale === 0 &&
      relations.missing === 0,
  }
}

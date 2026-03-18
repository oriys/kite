import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  requestAiEmbedding,
  resolveEmbeddingProvider,
} from '@/lib/ai-server'
import { logServerError } from '@/lib/server-errors'
import { SEMANTIC_TOP_K } from '@/lib/ai-config'
import type { SearchResult } from './searcher'
import { searchDocuments } from './searcher'

export interface HybridSearchResult extends SearchResult {
  matchType: 'keyword' | 'semantic' | 'hybrid'
  chunkPreview?: string
}

/**
 * Semantic-only search: embed query and find similar document chunks.
 */
async function semanticSearch(
  workspaceId: string,
  query: string,
  limit: number,
): Promise<HybridSearchResult[]> {
  const resolved = await resolveEmbeddingProvider(workspaceId)
  if (!resolved) return []

  let queryEmbedding: number[]
  try {
    const { embeddings } = await requestAiEmbedding({
      provider: resolved.provider,
      texts: [query],
      model: resolved.modelId,
    })
    if (embeddings.length === 0) return []
    queryEmbedding = embeddings[0]
  } catch (error) {
    logServerError('Semantic search embedding failed', error, { workspaceId })
    return []
  }

  const queryVector = `[${queryEmbedding.join(',')}]`

  const rows = await db.execute(sql`
    SELECT
      d.id,
      d.title,
      d.status,
      d.updated_at,
      dc.chunk_text AS headline,
      1 - (dc.embedding <=> ${queryVector}::vector) AS rank
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id AND d.deleted_at IS NULL
    WHERE dc.workspace_id = ${workspaceId}
      AND dc.embedding IS NOT NULL
      AND d.visibility IN ('public', 'partner')
    ORDER BY dc.embedding <=> ${queryVector}::vector
    LIMIT ${limit * 2}
  `)

  // Deduplicate by document ID, keeping highest-ranked chunk per document
  const seen = new Map<string, HybridSearchResult>()
  for (const row of rows as unknown as Array<Record<string, unknown>>) {
    const docId = row.id as string
    if (seen.has(docId)) continue

    const chunkText = row.headline as string
    seen.set(docId, {
      id: docId,
      title: row.title as string,
      headline: chunkText.slice(0, 300),
      status: row.status as string,
      updatedAt: new Date(row.updated_at as string),
      rank: Number(row.rank ?? 0),
      matchType: 'semantic',
      chunkPreview: chunkText.slice(0, 300),
    })

    if (seen.size >= limit) break
  }

  return Array.from(seen.values())
}

/**
 * Reciprocal Rank Fusion: combine two ranked lists into one.
 * RRF score = sum(1 / (k + rank)) for each list where the document appears.
 */
function reciprocalRankFusion(
  keywordResults: SearchResult[],
  semanticResults: HybridSearchResult[],
  k = 60,
): HybridSearchResult[] {
  const scores = new Map<
    string,
    { score: number; result: HybridSearchResult; sources: Set<string> }
  >()

  for (let i = 0; i < keywordResults.length; i++) {
    const r = keywordResults[i]
    const existing = scores.get(r.id)
    const rrfScore = 1 / (k + i + 1)

    if (existing) {
      existing.score += rrfScore
      existing.sources.add('keyword')
    } else {
      scores.set(r.id, {
        score: rrfScore,
        result: { ...r, matchType: 'keyword' },
        sources: new Set(['keyword']),
      })
    }
  }

  for (let i = 0; i < semanticResults.length; i++) {
    const r = semanticResults[i]
    const existing = scores.get(r.id)
    const rrfScore = 1 / (k + i + 1)

    if (existing) {
      existing.score += rrfScore
      existing.sources.add('semantic')
      if (!existing.result.chunkPreview && r.chunkPreview) {
        existing.result.chunkPreview = r.chunkPreview
      }
    } else {
      scores.set(r.id, {
        score: rrfScore,
        result: r,
        sources: new Set(['semantic']),
      })
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ result, sources }) => ({
      ...result,
      matchType: sources.size > 1 ? 'hybrid' as const : result.matchType,
      rank: 0, // RRF doesn't use the original rank
    }))
}

/**
 * Hybrid search combining keyword FTS and semantic vector search.
 * Falls back gracefully to keyword-only if embeddings are unavailable.
 */
export async function hybridSearch(
  workspaceId: string,
  query: string,
  mode: 'keyword' | 'semantic' | 'hybrid' = 'hybrid',
  limit = 20,
): Promise<HybridSearchResult[]> {
  if (mode === 'keyword') {
    const results = await searchDocuments(workspaceId, query, limit)
    return results.map((r) => ({ ...r, matchType: 'keyword' as const }))
  }

  if (mode === 'semantic') {
    return semanticSearch(workspaceId, query, limit)
  }

  // Hybrid mode: run both in parallel
  const [keywordResults, semanticResults] = await Promise.all([
    searchDocuments(workspaceId, query, limit),
    semanticSearch(workspaceId, query, SEMANTIC_TOP_K).catch(() => []),
  ])

  if (semanticResults.length === 0) {
    return keywordResults.map((r) => ({ ...r, matchType: 'keyword' as const }))
  }

  return reciprocalRankFusion(keywordResults, semanticResults).slice(0, limit)
}

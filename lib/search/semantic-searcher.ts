import { SEMANTIC_TOP_K } from '@/lib/ai-config'
import type { SearchResult } from './searcher'
import { searchDocuments } from './searcher'

export interface HybridSearchResult extends SearchResult {
  matchType: 'keyword' | 'semantic' | 'hybrid'
  chunkPreview?: string
}

/**
 * Semantic search is disabled for documents (no document chunks in RAG).
 * Knowledge source chunks are used for AI chat only, not public search.
 */
async function semanticSearch(
  _workspaceId: string,
  _query: string,
  _limit: number,
): Promise<HybridSearchResult[]> {
  return []
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

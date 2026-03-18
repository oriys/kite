/**
 * LLM-based keyword extraction for RAG query routing.
 *
 * Extracts high-level (concept/theme) and low-level (entity/detail) keywords
 * from user queries. Results are cached per workspace+query combination.
 *
 * Inspired by LightRAG's dual-level keyword extraction approach.
 */

import { createHash } from 'crypto'
import {
  requestAiTextCompletion,
  resolveWorkspaceAiProviders,
  resolveAiModelSelection,
  type ResolvedAiProviderConfig,
} from '@/lib/ai-server'
import { RAG_KEYWORD_CACHE_TTL_SECONDS, TEMPERATURE_QUERY_REWRITE } from '@/lib/ai-config'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'
import { createRagCacheKey, getRagCacheEntry, setRagCacheEntry } from '@/lib/rag/cache'
import { logServerError } from '@/lib/server-errors'

export interface ExtractedKeywords {
  /** Concept-level keywords: themes, topics, abstract relationships */
  highLevel: string[]
  /** Entity-level keywords: specific names, identifiers, concrete terms */
  lowLevel: string[]
}

const KEYWORD_EXTRACTION_PROMPT = `You are a keyword extraction specialist for an API documentation system.
Given a user query, extract two types of keywords:

HIGH_LEVEL: Broad concepts, themes, topics, or abstract relationships in the query.
Examples: "authentication flow", "error handling", "data pagination", "permission model"

LOW_LEVEL: Specific entity names, identifiers, API names, field names, or concrete terms.
Examples: "MetaObject", "write_inventory", "AccessScope", "POST /orders", "webhook"

Output format (strict):
HIGH_LEVEL: keyword1, keyword2, keyword3
LOW_LEVEL: keyword1, keyword2, keyword3

Rules:
- Extract 1-5 keywords per level
- Preserve original language (Chinese terms stay Chinese, English stays English)
- For API queries, LOW_LEVEL should include endpoint paths, method names, type names
- For conceptual queries, HIGH_LEVEL should capture the abstract intent
- If the query is simple/direct, it's OK to have fewer keywords
- Do NOT add explanations, just the two lines`

// LRU cache: workspace:queryHash → ExtractedKeywords
const _keywordCache = new Map<string, { keywords: ExtractedKeywords; ts: number }>()
const CACHE_TTL_MS = 5 * 60_000 // 5 minutes
const CACHE_MAX_SIZE = 200

function computeQueryHash(query: string): string {
  return createHash('sha256').update(query.trim().toLowerCase()).digest('hex').slice(0, 12)
}

function evictStaleEntries() {
  if (_keywordCache.size <= CACHE_MAX_SIZE) return
  const now = Date.now()
  for (const [key, entry] of _keywordCache) {
    if (now - entry.ts > CACHE_TTL_MS) {
      _keywordCache.delete(key)
    }
  }
  // If still over limit, remove oldest
  if (_keywordCache.size > CACHE_MAX_SIZE) {
    const firstKey = _keywordCache.keys().next().value
    if (firstKey !== undefined) _keywordCache.delete(firstKey)
  }
}

function parseKeywordResponse(response: string): ExtractedKeywords {
  const highLevel: string[] = []
  const lowLevel: string[] = []

  for (const line of response.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('HIGH_LEVEL:')) {
      const raw = trimmed.slice('HIGH_LEVEL:'.length).trim()
      highLevel.push(
        ...raw.split(',').map(k => k.trim()).filter(k => k.length > 0 && k.length <= 100)
      )
    } else if (trimmed.startsWith('LOW_LEVEL:')) {
      const raw = trimmed.slice('LOW_LEVEL:'.length).trim()
      lowLevel.push(
        ...raw.split(',').map(k => k.trim()).filter(k => k.length > 0 && k.length <= 100)
      )
    }
  }

  return {
    highLevel: highLevel.slice(0, 5),
    lowLevel: lowLevel.slice(0, 5),
  }
}

/**
 * Extract high-level and low-level keywords from a query using LLM.
 * Results are cached per workspace+query for 5 minutes.
 *
 * Falls back to simple heuristic extraction if LLM is unavailable.
 */
export async function extractQueryKeywords(input: {
  query: string
  provider?: { provider: ResolvedAiProviderConfig; modelId: string }
  workspaceId: string
}): Promise<ExtractedKeywords> {
  const queryHash = computeQueryHash(input.query)
  const cacheKey = `${input.workspaceId}:${queryHash}`
  const persistentCacheKey = createRagCacheKey([
    'keywords',
    input.workspaceId,
    input.query.trim().toLowerCase(),
  ])

  // Check cache
  const cached = _keywordCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.keywords
  }

  const persisted = await getRagCacheEntry<{ keywords?: ExtractedKeywords }>({
    workspaceId: input.workspaceId,
    cacheType: 'keywords',
    cacheKey: persistentCacheKey,
  })
  if (persisted?.keywords) {
    evictStaleEntries()
    _keywordCache.set(cacheKey, {
      keywords: persisted.keywords,
      ts: Date.now(),
    })
    return persisted.keywords
  }

  // Resolve provider if not provided
  let provider = input.provider
  if (!provider) {
    try {
      const [providers, settings] = await Promise.all([
        resolveWorkspaceAiProviders(input.workspaceId),
        getAiWorkspaceSettings(input.workspaceId),
      ])
      const selection = resolveAiModelSelection({
        defaultModelId: settings?.defaultModelId ?? null,
        enabledModelIds: Array.isArray(settings?.enabledModelIds)
          ? settings.enabledModelIds.filter((v): v is string => typeof v === 'string')
          : [],
        providers,
      })
      if (selection) {
        provider = { provider: selection.provider, modelId: selection.modelId }
      }
    } catch {
      // Fall through to heuristic
    }
  }

  if (!provider) {
    const keywords = heuristicKeywordExtraction(input.query)
    evictStaleEntries()
    _keywordCache.set(cacheKey, { keywords, ts: Date.now() })
    void setRagCacheEntry({
      workspaceId: input.workspaceId,
      cacheType: 'keywords',
      cacheKey: persistentCacheKey,
      payload: { keywords },
      ttlSeconds: RAG_KEYWORD_CACHE_TTL_SECONDS,
    })
    return keywords
  }

  try {
    const { result } = await requestAiTextCompletion({
      provider: provider.provider,
      model: provider.modelId,
      temperature: TEMPERATURE_QUERY_REWRITE,
      systemPrompt: KEYWORD_EXTRACTION_PROMPT,
      userPrompt: input.query,
    })

    const keywords = parseKeywordResponse(result)

    // Cache result
    evictStaleEntries()
    _keywordCache.set(cacheKey, { keywords, ts: Date.now() })
    void setRagCacheEntry({
      workspaceId: input.workspaceId,
      cacheType: 'keywords',
      cacheKey: persistentCacheKey,
      payload: { keywords },
      ttlSeconds: RAG_KEYWORD_CACHE_TTL_SECONDS,
    })

    return keywords
  } catch (error) {
    logServerError('LLM keyword extraction failed, using heuristic fallback', error, {
      workspaceId: input.workspaceId,
      query: input.query,
    })
    const keywords = heuristicKeywordExtraction(input.query)
    evictStaleEntries()
    _keywordCache.set(cacheKey, { keywords, ts: Date.now() })
    void setRagCacheEntry({
      workspaceId: input.workspaceId,
      cacheType: 'keywords',
      cacheKey: persistentCacheKey,
      payload: { keywords },
      ttlSeconds: RAG_KEYWORD_CACHE_TTL_SECONDS,
    })
    return keywords
  }
}

/**
 * Heuristic fallback when LLM is unavailable.
 * Splits query into likely high-level and low-level terms.
 */
export function heuristicKeywordExtraction(query: string): ExtractedKeywords {
  const highLevel: string[] = []
  const lowLevel: string[] = []

  const trimmed = query.trim()
  if (!trimmed) return { highLevel: [], lowLevel: [] }

  // LOW_LEVEL: Extract specific identifiers
  // PascalCase/camelCase words (likely type or field names)
  for (const match of trimmed.matchAll(/\b([A-Z][a-zA-Z0-9]+(?:Type|Input|Object|Enum|Schema|Scope)?)\b/g)) {
    if (match[1].length > 2) lowLevel.push(match[1])
  }

  // API paths
  for (const match of trimmed.matchAll(/\/[a-z][a-z0-9/_-]*/gi)) {
    lowLevel.push(match[0])
  }

  // HTTP methods + paths
  for (const match of trimmed.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/gi)) {
    lowLevel.push(`${match[1].toUpperCase()} ${match[2]}`)
  }

  // snake_case identifiers
  for (const match of trimmed.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g)) {
    lowLevel.push(match[1])
  }

  // CJK specific terms that look like entity names
  for (const match of trimmed.matchAll(/([\u4e00-\u9fff]{2,6}(?:点|码|段|象|口|表|型))/g)) {
    lowLevel.push(match[1])
  }

  // HIGH_LEVEL: Extract conceptual terms
  const conceptPatterns = [
    /\b(authentication|authorization|auth)\b/i,
    /\b(permission|权限|access\s*scope)\b/i,
    /\b(pagination|分页)\b/i,
    /\b(error\s*handling|错误处理)\b/i,
    /\b(rate\s*limit|限流)\b/i,
    /\b(webhook|回调|事件通知)\b/i,
    /\b(how\s+to|如何|怎么|流程)\b/i,
    /\b(overview|概述|介绍)\b/i,
    /\b(best\s+practice|最佳实践)\b/i,
  ]

  for (const pattern of conceptPatterns) {
    const match = trimmed.match(pattern)
    if (match) highLevel.push(match[0])
  }

  // If no concept extracted, use the full query as high-level
  if (highLevel.length === 0) {
    highLevel.push(trimmed.slice(0, 80))
  }

  return {
    highLevel: [...new Set(highLevel)].slice(0, 5),
    lowLevel: [...new Set(lowLevel)].slice(0, 5),
  }
}

// For testing
export { parseKeywordResponse as _parseKeywordResponse }
export { KEYWORD_EXTRACTION_PROMPT as _KEYWORD_EXTRACTION_PROMPT }

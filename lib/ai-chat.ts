import { eq, and, sql, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  documents,
} from '@/lib/schema'
import {
  requestAiEmbedding,
  requestAiChatCompletionStream,
  requestAiRerank,
  requestAiTextCompletion,
  resolveAiModelSelection,
  resolveWorkspaceAiProviders,
  resolveEmbeddingProvider,
} from '@/lib/ai-server'
import { listStoredDocumentRelations } from '@/lib/document-relations'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'
import { logServerError } from '@/lib/server-errors'
import { resolveWorkspaceMcpToolSet } from '@/lib/mcp-tools'
import { getMcpPrompt } from '@/lib/mcp-client'
import { getMcpServerConfig } from '@/lib/queries/mcp'
import {
  buildChatSystemPrompt,
  hasChatGrounding,
} from '@/lib/ai-chat-prompt'
import {
  type ChatSource,
  normalizeChatMessageAttribution,
} from '@/lib/ai-chat-shared'
import {
  DEFAULT_RERANKER_MODEL,
  RAG_QUERY_CONTEXT_CACHE_TTL_SECONDS,
  TOP_K_CHUNKS,
  TOP_K_KEYWORD_DOCUMENTS,
  MAX_QUERY_VARIANTS,
  MAX_SEMANTIC_CHUNKS,
  MAX_SEMANTIC_CHUNKS_PER_DOCUMENT,
  ADJACENT_CHUNK_RADIUS,
  MAX_CONTEXT_CHARS,
  MAX_CONTEXT_SECTIONS,
  MAX_SECTION_CHARS,
  MAX_COMPRESSED_BLOCKS,
  MAX_CONTEXT_TOKENS,
  MAX_SECTION_TOKENS,
  MAX_HISTORY_MESSAGES,
  MAX_KEYWORD_SNIPPET_CHARS,
  MIN_VECTOR_SIMILARITY,
  VECTOR_SIMILARITY_WINDOW,
  SIMILARITY_PROFILES,
  MAX_PRIMARY_DOCUMENTS,
  MAX_REFERENCE_LINKS_PER_DOCUMENT,
  MAX_REFERENCE_SEARCH_RESULTS,
  MAX_RELATED_DOCUMENTS,
  MAX_RERANK_DOCUMENT_CHARS,
  SHOPLINE_DOCS_BASE_URL,
  TEMPERATURE_CHAT,
  TEMPERATURE_QUERY_REWRITE,
  MAX_HISTORY_TURNS_FOR_REWRITE,
  BOOST_RECENT_SOURCE_SCORE,
  ENABLE_ITERATIVE_RETRIEVAL,
  MIN_CONTEXT_SECTIONS_FOR_SKIP,
  MAX_ITERATIVE_FOLLOWUP_QUERIES,
  MAX_MCP_TOOL_STEPS,
  resolveContextLimits,
  type ContextLimits,
  AI_DEFAULT_QUERY_EXPANSION_RULES,
  type QueryExpansionRule,
} from '@/lib/ai-config'
import { estimateTokens } from '@/lib/chunker'
import { extractQueryKeywords } from '@/lib/kg/query-keywords'
import { retrieveKgContext } from '@/lib/kg/kg-retrieval'
import { createRagCacheKey, getRagCacheEntry, setRagCacheEntry } from '@/lib/rag/cache'
import { resolveWorkspaceRagQueryMode } from '@/lib/rag/settings'
import {
  type RagQueryMode,
  type RagVisibilityContext,
  type RagVisibilityRole,
} from '@/lib/rag/types'
import {
  containsCjk,
  createQueryMatchPlan,
  extractQueryTerms,
} from '@/lib/search/query-terms'
import {
  escapeLikePattern,
  buildVisibilityFilter,
  isMissingSearchVectorColumnError,
} from '@/lib/ai/visibility-filter'
import {
  createChatSession as _createChatSession,
  listChatSessions as _listChatSessions,
  getChatHistory as _getChatHistory,
  saveChatMessage as _saveChatMessage,
} from '@/lib/ai/chat-sessions'

// Re-export session CRUD from extracted module
export const createChatSession = _createChatSession
export const listChatSessions = _listChatSessions
export const getChatHistory = _getChatHistory
export const saveChatMessage = _saveChatMessage

type MemberRole = RagVisibilityRole
type VisibilityContext = RagVisibilityContext

// Visibility filter, escapeLikePattern, and isMissingSearchVectorColumnError
// are now in lib/ai/visibility-filter.ts

async function searchDocumentKeywordRows(input: {
  workspaceId: string
  terms: string[]
  limit: number
  visibility?: VisibilityContext
  documentId?: string
  preferIlike?: boolean
}) {
  const documentFilter = input.documentId
    ? sql`AND d.id = ${input.documentId}`
    : sql``
  const visibilityFilter = buildVisibilityFilter('d', input.visibility)
  const likePatterns = input.terms.map((term) => `%${escapeLikePattern(term)}%`)
  const whereMatches = sql.join(
    likePatterns.map(
      (pattern) => sql`(d.title ILIKE ${pattern} OR d.content ILIKE ${pattern})`,
    ),
    sql` OR `,
  )
  const keywordRank = sql.join(
    likePatterns.flatMap((pattern) => [
      sql`CASE WHEN d.title ILIKE ${pattern} THEN 3 ELSE 0 END`,
      sql`CASE WHEN d.content ILIKE ${pattern} THEN 1 ELSE 0 END`,
    ]),
    sql` + `,
  )

  if (!input.preferIlike) {
    const tsQuery = input.terms.join(' ')

    try {
      return await db.execute(sql`
        SELECT
          d.id,
          d.title,
          d.slug,
          d.content,
          d.updated_at,
          ts_rank(d.search_vector, plainto_tsquery('english', ${tsQuery})) AS keyword_rank
        FROM documents d
        WHERE d.workspace_id = ${input.workspaceId}
          AND d.deleted_at IS NULL
          ${documentFilter}
          ${visibilityFilter}
          AND d.search_vector @@ plainto_tsquery('english', ${tsQuery})
        ORDER BY keyword_rank DESC, d.updated_at DESC
        LIMIT ${input.limit}
      `) as unknown as Array<Record<string, unknown>>
    } catch (error) {
      if (!isMissingSearchVectorColumnError(error)) {
        throw error
      }
    }
  }

  return await db.execute(sql`
    SELECT
      d.id,
      d.title,
      d.slug,
      d.content,
      d.updated_at,
      ${keywordRank} AS keyword_rank
    FROM documents d
    WHERE d.workspace_id = ${input.workspaceId}
      AND d.deleted_at IS NULL
      ${documentFilter}
      ${visibilityFilter}
      AND (${whereMatches})
    ORDER BY keyword_rank DESC, d.updated_at DESC
    LIMIT ${input.limit}
  `) as unknown as Array<Record<string, unknown>>
}

interface RetrievedContextSection {
  source: ChatSource
  content: string
}

interface StoredDocumentRecord {
  id: string
  title: string
  slug: string | null
  content: string
}

interface ReferenceCandidate {
  sourceDocumentId: string
  sourceTitle: string
  label?: string
  url?: string
  searchTerms: string[]
  searchQuery: string
}

type SemanticChunkHit = Awaited<ReturnType<typeof searchSimilarChunks>>['hits'][number]

export interface RetrievalDiagnostics {
  mode: RagQueryMode
  queryVariants: string[]
  timings: {
    semanticSearchMs: number
    keywordSearchMs: number
    neighborhoodMs: number
    rerankMs: number
    referenceExpansionMs: number
    kgRetrievalMs: number
    totalMs: number
  }
  kgResults?: {
    entityCount: number
    relationCount: number
    keywords: { highLevel: string[]; lowLevel: string[] }
  }
  semanticChunks: Array<{
    chunkId: string
    documentId: string
    documentTitle: string
    chunkIndex: number
    similarity: number
  }>
  keywordDocuments: Array<{
    documentId: string
    title: string
  }>
  rerankScores: Array<{
    documentId: string
    title: string
    score: number | null
  }>
  selectedSections: Array<{
    documentId: string
    title: string
    relationType: string
    contentPreview: string
  }>
  cacheHit?: boolean
}

interface CompiledExpansionRule {
  regex: RegExp
  expansions: string[]
  scoreBoost: number
}

function compileExpansionRules(rules: QueryExpansionRule[]): CompiledExpansionRule[] {
  const compiled: CompiledExpansionRule[] = []
  for (const rule of rules) {
    try {
      compiled.push({
        regex: new RegExp(rule.pattern, 'i'),
        expansions: rule.expansions,
        scoreBoost: rule.scoreBoost ?? 14,
      })
    } catch {
      console.warn(`[RAG] Invalid query expansion pattern, skipping: ${rule.pattern}`)
    }
  }
  return compiled
}

const DEFAULT_COMPILED_RULES = compileExpansionRules(AI_DEFAULT_QUERY_EXPANSION_RULES)

// 60s in-memory cache for workspace-specific expansion rules
const _expansionRulesCache = new Map<string, { rules: CompiledExpansionRule[]; ts: number }>()

async function loadQueryExpansionRules(workspaceId: string): Promise<CompiledExpansionRule[]> {
  const cached = _expansionRulesCache.get(workspaceId)
  if (cached && Date.now() - cached.ts < 60_000) return cached.rules

  try {
    const settings = await getAiWorkspaceSettings(workspaceId)
    const promptSettings = settings?.promptSettings as Record<string, unknown> | null
    const rawRules = promptSettings?.queryExpansionRules

    if (!Array.isArray(rawRules) || rawRules.length === 0) {
      _expansionRulesCache.set(workspaceId, { rules: DEFAULT_COMPILED_RULES, ts: Date.now() })
      if (_expansionRulesCache.size > 50) {
        const firstKey = _expansionRulesCache.keys().next().value
        if (firstKey !== undefined) _expansionRulesCache.delete(firstKey)
      }
      return DEFAULT_COMPILED_RULES
    }

    const rules = compileExpansionRules(rawRules as QueryExpansionRule[])
    _expansionRulesCache.set(workspaceId, { rules, ts: Date.now() })
    if (_expansionRulesCache.size > 50) {
      const firstKey = _expansionRulesCache.keys().next().value
      if (firstKey !== undefined) _expansionRulesCache.delete(firstKey)
    }
    return rules
  } catch (error) {
    logServerError('Failed to load query expansion rules', error, { workspaceId })
    return DEFAULT_COMPILED_RULES
  }
}

// ─── Vector search ──────────────────────────────────────────────

async function resolveRerankerConfig(workspaceId: string) {
  const [providers, settings] = await Promise.all([
    resolveWorkspaceAiProviders(workspaceId),
    getAiWorkspaceSettings(workspaceId),
  ])

  const rerankerProviders = providers.filter(
    (provider) => provider.enabled && provider.providerType === 'openai_compatible',
  )

  if (rerankerProviders.length === 0) return null

  return {
    provider: rerankerProviders[0],
    modelId: settings?.rerankerModelId?.trim() || DEFAULT_RERANKER_MODEL,
  }
}

export async function searchSimilarChunks(input: {
  workspaceId: string
  query: string
  documentId?: string
  topK?: number
  visibility?: VisibilityContext
}): Promise<{ hits: Array<{
  chunkId: string
  documentId: string
  chunkText: string
  chunkIndex: number
  documentTitle: string
  documentSlug: string | null
  similarity: number
}>; embeddingModelId: string | null }> {
  const config = await resolveEmbeddingProvider(input.workspaceId)
  if (!config) return { hits: [], embeddingModelId: null }

  const { embeddings } = await requestAiEmbedding({
    provider: config.provider,
    texts: [input.query],
    model: config.modelId,
  })

  if (embeddings.length === 0) return { hits: [], embeddingModelId: config.modelId }

  const queryVector = `[${embeddings[0].join(',')}]`
  const topK = input.topK ?? TOP_K_CHUNKS

  const results = await db.execute(sql`
    SELECT
      dc.id AS chunk_id,
      dc.chunk_text,
      dc.chunk_index,
      dc.knowledge_source_id,
      COALESCE(ks.title, 'Untitled') AS document_title,
      1 - (dc.embedding <=> ${queryVector}::vector) AS similarity
    FROM document_chunks dc
    JOIN knowledge_sources ks ON ks.id = dc.knowledge_source_id AND ks.deleted_at IS NULL
    WHERE dc.workspace_id = ${input.workspaceId}
      AND dc.embedding IS NOT NULL
      AND dc.knowledge_source_id IS NOT NULL
    ORDER BY dc.embedding <=> ${queryVector}::vector
    LIMIT ${topK}
  `)

  const hits = (results as unknown as Array<Record<string, unknown>>).map((row) => ({
    chunkId: row.chunk_id as string,
    documentId: row.knowledge_source_id as string,
    chunkText: row.chunk_text as string,
    chunkIndex: row.chunk_index as number,
    documentTitle: row.document_title as string,
    documentSlug: null,
    sourceType: 'knowledge_source' as const,
    similarity: Number(row.similarity ?? 0),
  }))

  return { hits, embeddingModelId: config.modelId }
}

// ─── RAG context builder ────────────────────────────────────────

function buildRetrievalQueries(query: string, rules: CompiledExpansionRule[] = DEFAULT_COMPILED_RULES) {
  const queries: string[] = []
  const seen = new Set<string>()

  const addQuery = (value: string) => {
    const trimmed = value.trim().replace(/\s+/g, ' ')
    if (!trimmed) return

    const key = trimmed.toLowerCase()
    if (seen.has(key)) return

    seen.add(key)
    queries.push(trimmed)
  }

  addQuery(query)
  addQuery(query.replace(/[_-]+/g, ' '))
  addQuery(query.replace(/[\s_-]+/g, ''))

  const englishTerms = extractQueryTerms(query).filter((term) => /[A-Za-z]/.test(term))
  if (englishTerms.length > 0) {
    addQuery(englishTerms.join(' '))
  }

  // Extract HTTP methods and path segments for API-doc queries
  const httpMethodMatch = query.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i)
  const pathMatch = query.match(/\/[a-z][a-z0-9/_-]*/i)
  if (httpMethodMatch && pathMatch) {
    addQuery(`${httpMethodMatch[1].toUpperCase()} ${pathMatch[0]}`)
  } else if (pathMatch) {
    addQuery(pathMatch[0])
  }

  // Extract "X endpoint" pattern → search for "/X"
  const endpointMatch = query.match(/\b(\w+)\s+endpoints?\b/i)
  if (endpointMatch) {
    addQuery(`/${endpointMatch[1].toLowerCase()}`)
  }

  const expandedTerms = new Set<string>()
  for (const rule of rules) {
    if (!rule.regex.test(query)) continue
    for (const expansion of rule.expansions) {
      expandedTerms.add(expansion)
      addQuery(expansion)
    }
  }

  if (expandedTerms.size > 0) {
    addQuery([query, ...expandedTerms].join(' '))
  }

  return queries.slice(0, MAX_QUERY_VARIANTS)
}

function mergeSemanticChunkResults(queryResults: SemanticChunkHit[][]) {
  const merged = new Map<
    string,
    SemanticChunkHit & {
      queryMatches: number
    }
  >()

  for (const chunks of queryResults) {
    for (const chunk of chunks) {
      const existing = merged.get(chunk.chunkId)
      if (!existing) {
        merged.set(chunk.chunkId, { ...chunk, queryMatches: 1 })
        continue
      }

      existing.queryMatches += 1
      if (chunk.similarity > existing.similarity) {
        existing.similarity = chunk.similarity
        existing.chunkText = chunk.chunkText
        existing.chunkIndex = chunk.chunkIndex
        existing.documentTitle = chunk.documentTitle
      }
    }
  }

  return [...merged.values()].sort(
    (left, right) =>
      right.similarity - left.similarity ||
      right.queryMatches - left.queryMatches,
  )
}

function selectRelevantChunks(
  chunks: Array<
    SemanticChunkHit & {
      queryMatches?: number
    }
  >,
  embeddingModelId?: string,
) {
  if (chunks.length === 0) return []

  const profile = embeddingModelId ? SIMILARITY_PROFILES[embeddingModelId] : undefined
  const minSimilarity = profile?.min ?? MIN_VECTOR_SIMILARITY
  const similarityWindow = profile?.window ?? VECTOR_SIMILARITY_WINDOW

  const topSimilarity = chunks[0].similarity
  if (topSimilarity < minSimilarity) return []

  const similarityFloor = Math.max(
    minSimilarity,
    topSimilarity - similarityWindow,
  )

  const filtered = chunks.filter(
    (chunk, index) => index < 2 || chunk.similarity >= similarityFloor,
  )

  const selected: SemanticChunkHit[] = []
  const perDocumentCounts = new Map<string, number>()

  for (const chunk of filtered) {
    if (selected.length >= MAX_SEMANTIC_CHUNKS) break
    if ((perDocumentCounts.get(chunk.documentId) ?? 0) > 0) continue

    selected.push(chunk)
    perDocumentCounts.set(chunk.documentId, 1)
  }

  for (const chunk of filtered) {
    if (selected.length >= MAX_SEMANTIC_CHUNKS) break

    const currentCount = perDocumentCounts.get(chunk.documentId) ?? 0
    if (currentCount >= MAX_SEMANTIC_CHUNKS_PER_DOCUMENT) continue
    if (selected.some((selectedChunk) => selectedChunk.chunkId === chunk.chunkId)) continue

    selected.push(chunk)
    perDocumentCounts.set(chunk.documentId, currentCount + 1)
  }

  return selected
}

function buildSnippetFromDocument(content: string, terms: string[]) {
  return compressContentForTerms(content, terms, MAX_KEYWORD_SNIPPET_CHARS)
}

function splitIntoContextBlocks(content: string) {
  const lines = content.replace(/\r\n?/g, '\n').trim().split('\n')
  const blocks: string[] = []
  let current: string[] = []
  let inCodeFence = false

  const flush = () => {
    const block = current.join('\n').trim()
    if (block) {
      blocks.push(block)
    }
    current = []
  }

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      current.push(line)
      inCodeFence = !inCodeFence
      continue
    }

    if (!inCodeFence && line.trim() === '') {
      flush()
      continue
    }

    current.push(line)
  }

  flush()

  const merged: string[] = []
  for (const block of blocks) {
    if (
      merged.length > 0 &&
      /^\s{0,3}#{1,6}\s+/.test(merged[merged.length - 1]) &&
      !/^\s{0,3}#{1,6}\s+/.test(block)
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n${block}`.trim()
      continue
    }

    merged.push(block)
  }

  return merged
}

function scoreContextBlock(block: string, terms: string[], query: string, rules: CompiledExpansionRule[] = DEFAULT_COMPILED_RULES) {
  const lowerBlock = block.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const normalizedCompactBlock = lowerBlock.replace(/[\s_-]+/g, '')
  let score = 0

  for (const term of [...terms].sort((left, right) => right.length - left.length)) {
    const normalizedTerm = term.toLowerCase()
    const compactTerm = normalizedTerm.replace(/[\s_-]+/g, '')

    if (lowerBlock.includes(normalizedTerm)) {
      score += /^\s{0,3}#{1,6}\s+/.test(block) ? 18 : 10
    } else if (compactTerm && normalizedCompactBlock.includes(compactTerm)) {
      score += 8
    }
  }

  if (lowerBlock.includes(lowerQuery)) {
    score += 20
  }

  if (/^\s{0,3}#{1,6}\s+/.test(block)) score += 6
  if (/^\|.+\|/m.test(block)) score += 4
  if (/^```/.test(block.trim())) score += /json|bash|curl|graphql|sql|typescript|javascript/i.test(query) ? 6 : -3
  if (/^\>\s+/m.test(block)) score += 3

  // Generic query expansion scoring — replaces hardcoded domain logic
  for (const rule of rules) {
    if (!rule.regex.test(query)) continue
    for (const expansion of rule.expansions) {
      if (lowerBlock.includes(expansion.toLowerCase())) {
        score += rule.scoreBoost
        break
      }
    }
  }

  if (/(接口|api|endpoint|request|response|参数)/i.test(query) && /(请求|响应|参数|字段|endpoint|api)/i.test(block)) {
    score += 8
  }

  return score
}

function compressContentForTerms(
  content: string,
  terms: string[],
  maxChars: number,
  query = terms.join(' '),
  maxBlocks = MAX_COMPRESSED_BLOCKS,
  rules?: CompiledExpansionRule[],
) {
  const normalized = content.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''
  if (normalized.length <= maxChars) return normalized

  const blocks = splitIntoContextBlocks(normalized)
  if (blocks.length === 0) {
    return normalized.slice(0, maxChars).trim()
  }

  const scoredBlocks = blocks.map((block, index) => ({
    block,
    index,
    score: scoreContextBlock(block, terms, query, rules),
  }))

  const selected = scoredBlocks
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, maxBlocks)
    .sort((left, right) => left.index - right.index)

  if (selected.length === 0) {
    return normalized.slice(0, maxChars).trim()
  }

  if (
    selected[0]?.index !== 0 &&
    /^\s{0,3}#{1,6}\s+/.test(blocks[0]) &&
    blocks[0].length < Math.floor(maxChars * 0.25)
  ) {
    selected.unshift({
      block: blocks[0],
      index: 0,
      score: 1,
    })
  }

  let text = ''

  for (const item of selected) {
    const nextText = text ? `${text}\n\n${item.block}` : item.block
    if (nextText.length > maxChars) {
      break
    }
    text = nextText
  }

  if (!text) {
    text = selected[0].block.slice(0, maxChars).trim()
  }

  const hasMoreContent = text.length < normalized.length
  if (hasMoreContent && !text.endsWith('…')) {
    text = `${text}…`
  }

  return text
}

function heuristicRerankContextSections(
  query: string,
  sections: RetrievedContextSection[],
  rerankScores?: Map<number, number>,
  boostDocumentIds?: Set<string>,
) {
  const queryTerms = extractQueryTerms(query)
  const queryUpper = query.toUpperCase()
  const scored = sections.map((section, index) => {
    const title = section.source.title.toLowerCase()
    const content = section.content.toLowerCase()
    // Extract the first heading from content as a "section heading" signal
    const headingMatch = section.content.match(/^#+\s+(.+)/m)
    const heading = headingMatch ? headingMatch[1].toLowerCase() : ''
    let score = section.source.relationType === 'primary' ? 55 : 28
    const modelScore = rerankScores?.get(index) ?? null

    // Boost documents that appeared in recent conversation turns
    if (boostDocumentIds?.has(section.source.documentId)) {
      score += BOOST_RECENT_SOURCE_SCORE
    }

    if (modelScore !== null && rerankScores) {
      const values = [...rerankScores.values()]
      const mlMin = Math.min(...values)
      const mlRange = Math.max(...values) - mlMin || 1
      const normalizedScore = (modelScore - mlMin) / mlRange
      score += normalizedScore * 80
    }

    for (const term of queryTerms) {
      const normalizedTerm = term.toLowerCase()
      const compactTerm = normalizedTerm.replace(/[\s_-]+/g, '')

      // Heading match — strong signal
      if (heading && (heading.includes(normalizedTerm) || heading.replace(/[\s/_-]+/g, '').includes(compactTerm))) {
        score += 15
      }

      if (title.includes(normalizedTerm) || title.replace(/[\s/_-]+/g, '').includes(compactTerm)) {
        score += 18
      }

      if (content.includes(normalizedTerm)) {
        score += 7
      }
    }

    // HTTP method match: query mentions GET/POST/etc. and section contains it
    const httpMethodMatch = queryUpper.match(/\b(GET|POST|PUT|PATCH|DELETE)\b/)
    if (httpMethodMatch) {
      const method = httpMethodMatch[1]
      if (
        section.content.toUpperCase().includes(method) &&
        (heading.toUpperCase().includes(method) || title.toUpperCase().includes(method))
      ) {
        score += 12
      }
    }

    // Schema name match: query mentions a type name and heading matches
    const typeNameMatch = query.match(/\b([A-Z][a-zA-Z]+(?:Type|Input|Object|Enum|Schema)?)\b/)
    if (typeNameMatch) {
      const typeName = typeNameMatch[1].toLowerCase()
      if (heading.includes(typeName) || title.includes(typeName)) {
        score += 10
      }
    }

    // Code block presence — helpful for "how to" queries
    if (/\bhow\s+to\b/i.test(query) && /```/.test(section.content)) {
      score += 5
    }

    return { section, index, score, modelScore }
  })

  scored.sort(
    (left, right) =>
      right.score - left.score ||
      (right.modelScore ?? -1) - (left.modelScore ?? -1) ||
      left.index - right.index,
  )

  const selected: RetrievedContextSection[] = []
  const perDocumentCount = new Map<string, number>()

  for (const item of scored) {
    if (selected.length >= MAX_CONTEXT_SECTIONS) break

    const currentCount = perDocumentCount.get(item.section.source.documentId) ?? 0
    if (currentCount > 0 && item.section.source.relationType === 'reference') continue
    if (currentCount >= 2) continue

    selected.push(item.section)
    perDocumentCount.set(item.section.source.documentId, currentCount + 1)
  }

  for (const item of scored) {
    if (selected.length >= MAX_CONTEXT_SECTIONS) break
    if (selected.includes(item.section)) continue

    const currentCount = perDocumentCount.get(item.section.source.documentId) ?? 0
    if (currentCount >= 2) continue

    selected.push(item.section)
    perDocumentCount.set(item.section.source.documentId, currentCount + 1)
  }

  return selected
}

function buildRerankDocument(section: RetrievedContextSection) {
  const relationLine =
    section.source.relationDescription ||
    'Direct retrieval match for the user question.'

  return [
    `Title: ${section.source.title}`,
    `Relation: ${relationLine}`,
    '',
    section.content.slice(0, MAX_RERANK_DOCUMENT_CHARS),
  ]
    .join('\n')
    .trim()
}

async function rerankContextSections(input: {
  workspaceId: string
  query: string
  sections: RetrievedContextSection[]
  boostDocumentIds?: Set<string>
}) {
  if (input.sections.length <= 1) {
    return heuristicRerankContextSections(input.query, input.sections, undefined, input.boostDocumentIds)
  }

  const config = await resolveRerankerConfig(input.workspaceId)
  if (!config) {
    return heuristicRerankContextSections(input.query, input.sections, undefined, input.boostDocumentIds)
  }

  try {
    const rerankResult = await requestAiRerank({
      provider: config.provider,
      model: config.modelId,
      query: input.query,
      documents: input.sections.map(buildRerankDocument),
      topN: input.sections.length,
    })

    const rerankScores = new Map<number, number>(
      rerankResult.results.map((result) => [result.index, result.relevanceScore]),
    )

    return heuristicRerankContextSections(input.query, input.sections, rerankScores, input.boostDocumentIds)
  } catch (error) {
    console.warn('[RAG] Reranker failed, falling back to heuristic-only ranking:', error)
    logServerError('AI chat reranking failed.', error, {
      workspaceId: input.workspaceId,
      query: input.query,
    })

    return heuristicRerankContextSections(input.query, input.sections, undefined, input.boostDocumentIds)
  }
}

function normalizeReferenceLabel(value: string | null | undefined) {
  const trimmed = value?.replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  return trimmed.slice(0, 80)
}

function normalizeReferenceUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const cleaned = trimmed
    .replace(/^<|>$/g, '')
    .replace(/^[[(]+/, '')
    .replace(/[)\].,;:!?)\u3002\uff0c\uff1b\uff1a\uff01\uff1f]+$/g, '')

  if (!cleaned) return null

  try {
    const url = cleaned.startsWith('/')
      ? new URL(cleaned, SHOPLINE_DOCS_BASE_URL)
      : new URL(cleaned)

    if (!/developer\.shopline\.com$/i.test(url.hostname)) {
      return null
    }

    url.hash = ''
    url.search = ''

    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function buildReferenceSearchTerms(input: {
  label?: string | null
  url?: string | null
}) {
  const terms: string[] = []
  const seen = new Set<string>()

  const addTerm = (value: string) => {
    const trimmed = value.trim()
    if (trimmed.length < 2) return

    const key = trimmed.toLowerCase()
    if (seen.has(key)) return

    seen.add(key)
    terms.push(trimmed)
  }

  if (input.label) {
    addTerm(input.label)
  }

  const normalizedUrl = normalizeReferenceUrl(input.url)
  if (!normalizedUrl) {
    return terms
  }

  const { pathname } = new URL(normalizedUrl)
  const segments = pathname.split('/').filter(Boolean)
  const lastSegment = segments.at(-1)
  const tailPath = segments.slice(-2).join('/')

  if (lastSegment) {
    addTerm(lastSegment)
    addTerm(lastSegment.replace(/[-_]+/g, ' '))
    addTerm(lastSegment.replace(/[-_]+/g, ''))
  }

  if (tailPath) {
    addTerm(tailPath)
  }

  return terms
}

function extractReferenceCandidates(document: StoredDocumentRecord) {
  const candidates: ReferenceCandidate[] = []
  const seen = new Set<string>()
  const normalizedContent = document.content
    .replace(/\r\n?/g, '\n')
    .replace(/\\([\[\]()])/g, '$1')

  const addCandidate = (label: string | null, url: string | null) => {
    const normalizedLabel = normalizeReferenceLabel(label)
    const normalizedUrl = normalizeReferenceUrl(url)
    const searchTerms = buildReferenceSearchTerms({
      label: normalizedLabel,
      url: normalizedUrl,
    })

    if (searchTerms.length === 0) return

    const key = `${normalizedUrl ?? ''}|${searchTerms.join('|')}`
    if (seen.has(key)) return

    seen.add(key)
    candidates.push({
      sourceDocumentId: document.id,
      sourceTitle: document.title,
      label: normalizedLabel ?? undefined,
      url: normalizedUrl ?? undefined,
      searchTerms,
      searchQuery: searchTerms.join(' '),
    })
  }

  for (const match of normalizedContent.matchAll(/(?<!!)\[([^\]]{1,80})\]\(([^)\s]+)\)/g)) {
    addCandidate(match[1] ?? null, match[2] ?? null)
  }

  for (const match of normalizedContent.matchAll(/https?:\/\/developer\.shopline\.com[^\s)"'>]+/g)) {
    addCandidate(null, match[0] ?? null)
  }

  for (const match of normalizedContent.matchAll(/\/zh-hans-cn\/docs\/[^\s)"'>]+/g)) {
    addCandidate(null, match[0] ?? null)
  }

  return candidates.slice(0, MAX_REFERENCE_LINKS_PER_DOCUMENT)
}

function extractDocumentSourceUrl(content: string) {
  const markerMatch = content.match(
    /<!--\s*SHOPLINE_IMPORT\b[^>]*\bsource=([^\s>]+)\s*-->/i,
  )

  if (markerMatch?.[1]) {
    return normalizeReferenceUrl(markerMatch[1])
  }

  const sourceLineMatch = content.match(/^>\s*Source:\s*(\S+)\s*$/m)
  return normalizeReferenceUrl(sourceLineMatch?.[1] ?? null)
}

function getReferenceUrlParts(value: string | null | undefined) {
  const normalized = normalizeReferenceUrl(value)
  if (!normalized) {
    return {
      normalized: null,
      lastSegment: '',
      compactLastSegment: '',
      tailPath: '',
    }
  }

  const segments = new URL(normalized).pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.toLowerCase())

  const lastSegment = segments.at(-1) ?? ''

  return {
    normalized,
    lastSegment,
    compactLastSegment: lastSegment.replace(/[-_\s]+/g, ''),
    tailPath: segments.slice(-2).join('/'),
  }
}

async function searchReferenceCandidateDocuments(input: {
  workspaceId: string
  candidate: ReferenceCandidate
  visibility?: VisibilityContext
}) {
  const searchTerms = input.candidate.searchTerms
  if (searchTerms.length === 0) return []

  const useCjkFallback = searchTerms.some((term) => containsCjk(term))
  const results = await searchDocumentKeywordRows({
    workspaceId: input.workspaceId,
    terms: searchTerms,
    limit: MAX_REFERENCE_SEARCH_RESULTS * 8,
    visibility: input.visibility,
    preferIlike: useCjkFallback,
  })

  const candidateUrlParts = getReferenceUrlParts(input.candidate.url)

  return results
    .map((row) => {
      const document = {
        id: row.id as string,
        title: (row.title as string) || 'Untitled',
        slug:
          row.slug === undefined || row.slug === null
            ? null
            : String(row.slug),
        content: String(row.content ?? ''),
      } satisfies StoredDocumentRecord

      const title = document.title.toLowerCase()
      const compactTitle = title.replace(/[-_\s/]+/g, '')
      const content = document.content.toLowerCase()
      const documentUrlParts = getReferenceUrlParts(
        extractDocumentSourceUrl(document.content),
      )

      let score = 0

      if (
        candidateUrlParts.normalized &&
        documentUrlParts.normalized &&
        candidateUrlParts.normalized === documentUrlParts.normalized
      ) {
        score += 120
      } else {
        if (
          candidateUrlParts.tailPath &&
          candidateUrlParts.tailPath === documentUrlParts.tailPath
        ) {
          score += 90
        }

        if (
          candidateUrlParts.lastSegment &&
          candidateUrlParts.lastSegment === documentUrlParts.lastSegment
        ) {
          score += 70
        }
      }

      for (const term of input.candidate.searchTerms) {
        const normalizedTerm = term.toLowerCase()
        const compactTerm = normalizedTerm.replace(/[-_\s/]+/g, '')

        if (title.includes(normalizedTerm) || compactTitle.includes(compactTerm)) {
          score += 18
        }

        if (content.includes(normalizedTerm)) {
          score += 6
        }
      }

      return {
        document,
        updatedAt: new Date(row.updated_at as string),
        score,
      }
    })
    .filter((row) => row.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.updatedAt.getTime() - left.updatedAt.getTime(),
    )
}

async function loadDocumentsByIds(
  workspaceId: string,
  ids: string[],
  visibility?: VisibilityContext,
) {
  if (ids.length === 0) return []

  const visibilityFilter = buildVisibilityFilter('d', visibility)

  if (visibility && visibility.role !== 'owner' && visibility.role !== 'admin') {
    // Use raw SQL to apply visibility filter
    const results = await db.execute(sql`
      SELECT d.id, d.title, d.slug, d.content
      FROM documents d
      WHERE d.workspace_id = ${workspaceId}
        AND d.deleted_at IS NULL
        AND d.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
        ${visibilityFilter}
    `)

    return (results as unknown as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      title: (row.title as string) || 'Untitled',
      slug: row.slug === undefined || row.slug === null ? null : String(row.slug),
      content: String(row.content ?? ''),
    }))
  }

  return db
    .select({
      id: documents.id,
      title: documents.title,
      slug: documents.slug,
      content: documents.content,
    })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, workspaceId),
        isNull(documents.deletedAt),
        inArray(documents.id, ids),
      ),
    )
}

async function loadChunkNeighborhoods(input: {
  workspaceId: string
  chunks: SemanticChunkHit[]
  chunkRadius?: number
}) {
  if (input.chunks.length === 0) {
    return new Map<string, Map<number, string>>()
  }

  const radius = input.chunkRadius ?? ADJACENT_CHUNK_RADIUS
  const clauses: ReturnType<typeof sql>[] = []

  for (const chunk of input.chunks) {
    const indexes: number[] = []

    for (
      let index = Math.max(0, chunk.chunkIndex - radius);
      index <= chunk.chunkIndex + radius;
      index += 1
    ) {
      indexes.push(index)
    }

    clauses.push(
      sql`(dc.knowledge_source_id = ${chunk.documentId} AND dc.chunk_index IN (${sql.join(
        indexes.map((index) => sql`${index}`),
        sql`, `,
      )}))`,
    )
  }

  const rows = await db.execute(sql`
    SELECT
      dc.knowledge_source_id AS document_id,
      dc.chunk_index,
      dc.chunk_text
    FROM document_chunks dc
    WHERE dc.workspace_id = ${input.workspaceId}
      AND (${sql.join(clauses, sql` OR `)})
    ORDER BY dc.knowledge_source_id ASC, dc.chunk_index ASC
  `)

  const byDocument = new Map<string, Map<number, string>>()

  for (const row of rows as Array<Record<string, unknown>>) {
    const documentId = row.document_id as string
    const chunkIndex = Number(row.chunk_index ?? 0)
    const chunkText = String(row.chunk_text ?? '')
    const chunkMap = byDocument.get(documentId) ?? new Map<number, string>()

    chunkMap.set(chunkIndex, chunkText)
    byDocument.set(documentId, chunkMap)
  }

  return byDocument
}

function buildSemanticSections(input: {
  chunks: SemanticChunkHit[]
  neighborhoodMap: Map<string, Map<number, string>>
  query: string
  limits?: ContextLimits
}) {
  const sectionChars = input.limits?.maxSectionChars ?? MAX_SECTION_CHARS
  const compressedBlocks = input.limits?.maxCompressedBlocks ?? MAX_COMPRESSED_BLOCKS
  const chunkRadius = input.limits?.adjacentChunkRadius ?? ADJACENT_CHUNK_RADIUS
  const sections: RetrievedContextSection[] = []
  const seenRanges = new Set<string>()
  const queryTerms = extractQueryTerms(input.query)

  for (const chunk of input.chunks) {
    const chunkMap = input.neighborhoodMap.get(chunk.documentId)
    const indexes: number[] = []
    const parts: string[] = []

    for (
      let index = Math.max(0, chunk.chunkIndex - chunkRadius);
      index <= chunk.chunkIndex + chunkRadius;
      index += 1
    ) {
      const part = chunkMap?.get(index)
      if (!part) continue

      indexes.push(index)
      parts.push(part)
    }

    const rawContent = parts.join('\n\n').trim() || chunk.chunkText
    const content = compressContentForTerms(
      rawContent,
      queryTerms,
      sectionChars,
      input.query,
      compressedBlocks,
    )
    const rangeKey =
      indexes.length > 0
        ? `${chunk.documentId}:${indexes.join(',')}`
        : `${chunk.documentId}:${chunk.chunkIndex}`

    if (!content || seenRanges.has(rangeKey)) continue

    seenRanges.add(rangeKey)
    sections.push({
      source: {
        documentId: chunk.documentId,
        documentSlug: chunk.documentSlug,
        sourceType: 'knowledge_source',
        chunkId: chunk.chunkId,
        title: chunk.documentTitle,
        preview: chunk.chunkText.slice(0, 150),
        relationType: 'primary',
        relationDescription: 'Direct retrieval match for the user question.',
      },
      content,
    })
  }

  return sections
}

function formatReferenceDescription(candidate: ReferenceCandidate) {
  return candidate.label
    ? `Referenced by "${candidate.sourceTitle}" via "${candidate.label}".`
    : `Referenced by "${candidate.sourceTitle}".`
}

async function expandStoredReferencedDocuments(input: {
  workspaceId: string
  query: string
  primarySections: RetrievedContextSection[]
  visibility?: VisibilityContext
}) {
  const primaryDocumentIds = Array.from(
    new Set(input.primarySections.map((section) => section.source.documentId)),
  ).slice(0, MAX_PRIMARY_DOCUMENTS)

  if (primaryDocumentIds.length === 0) return []

  const relations = await listStoredDocumentRelations({
    workspaceId: input.workspaceId,
    sourceDocumentIds: primaryDocumentIds,
    limit: MAX_RELATED_DOCUMENTS * 3,
  })

  if (relations.length === 0) return []

  const queryTerms = extractQueryTerms(input.query)
  const includedDocumentIds = new Set(primaryDocumentIds)
  const sections: RetrievedContextSection[] = []

  for (const relation of relations) {
    if (sections.length >= MAX_RELATED_DOCUMENTS) break
    if (includedDocumentIds.has(relation.targetDocumentId)) continue

    const snippet = buildSnippetFromDocument(relation.targetContent, [
      ...queryTerms,
      ...extractQueryTerms(relation.relationLabel),
    ])

    if (!snippet) continue

    includedDocumentIds.add(relation.targetDocumentId)
    sections.push({
      source: {
        documentId: relation.targetDocumentId,
        documentSlug: relation.targetSlug,
        chunkId: `document:${relation.targetDocumentId}:reference`,
        title: relation.targetTitle,
        preview: snippet.slice(0, 150),
        relationType: 'reference',
        relationDescription: relation.relationLabel
          ? `Referenced by "${relation.sourceTitle}" via "${relation.relationLabel}".`
          : `Referenced by "${relation.sourceTitle}".`,
      },
      content: snippet,
    })
  }

  return sections
}

async function expandReferencedDocuments(input: {
  workspaceId: string
  query: string
  primarySections: RetrievedContextSection[]
  visibility?: VisibilityContext
}) {
  const primaryDocumentIds = Array.from(
    new Set(input.primarySections.map((section) => section.source.documentId)),
  ).slice(0, MAX_PRIMARY_DOCUMENTS)

  if (primaryDocumentIds.length === 0) return []

  const primaryDocuments = await loadDocumentsByIds(
    input.workspaceId,
    primaryDocumentIds,
    input.visibility,
  )

  const resolvedMatches = new Map<string, ReferenceCandidate>()
  const excludedDocumentIds = new Set(primaryDocumentIds)

  for (const document of primaryDocuments) {
    const candidates = extractReferenceCandidates(document)

    for (const candidate of candidates) {
      if (resolvedMatches.size >= MAX_RELATED_DOCUMENTS) break

      try {
        const matches = await searchReferenceCandidateDocuments({
          workspaceId: input.workspaceId,
          candidate,
          visibility: input.visibility,
        })

        const match = matches.find(
          (result) =>
            !excludedDocumentIds.has(result.document.id) &&
            !resolvedMatches.has(result.document.id),
        )

        if (!match) continue

        resolvedMatches.set(match.document.id, candidate)
        excludedDocumentIds.add(match.document.id)
      } catch (error) {
        logServerError('AI chat reference expansion failed.', error, {
          workspaceId: input.workspaceId,
          query: input.query,
          candidateQuery: candidate.searchQuery,
          sourceDocumentId: candidate.sourceDocumentId,
        })
        continue
      }
    }

    if (resolvedMatches.size >= MAX_RELATED_DOCUMENTS) break
  }

  const relatedDocuments = await loadDocumentsByIds(
    input.workspaceId,
    [...resolvedMatches.keys()],
    input.visibility,
  )

  const queryTerms = extractQueryTerms(input.query)

  const sections: RetrievedContextSection[] = []

  for (const document of relatedDocuments) {
    const candidate = resolvedMatches.get(document.id)
    if (!candidate) continue

    const snippet = buildSnippetFromDocument(document.content, [
      ...queryTerms,
      ...extractQueryTerms(candidate.searchQuery),
    ])

    if (!snippet) continue

    sections.push({
      source: {
        documentId: document.id,
        documentSlug: document.slug,
        chunkId: `document:${document.id}:reference`,
        title: document.title,
        preview: snippet.slice(0, 150),
        relationType: 'reference',
        relationDescription: formatReferenceDescription(candidate),
      },
      content: snippet,
    })
  }

  return sections
}

async function searchKeywordDocuments(input: {
  workspaceId: string
  query: string
  documentId?: string
  topK?: number
  visibility?: VisibilityContext
}): Promise<RetrievedContextSection[]> {
  const matchPlan = createQueryMatchPlan(input.query)
  const terms = matchPlan.previewTerms
  if (terms.length === 0) return []

  const topK = input.topK ?? TOP_K_KEYWORD_DOCUMENTS
  const buildKnowledgeSourceMatches = (termList: string[]) => {
    if (termList.length === 0) return sql`false`

    return sql`(${sql.join(
      termList.map((term) => {
        const pattern = `%${escapeLikePattern(term)}%`
        return sql`(ks.title ILIKE ${pattern} OR ks.raw_content ILIKE ${pattern})`
      }),
      sql` OR `,
    )})`
  }
  const buildKnowledgeSourceMatchCount = (termList: string[]) => {
    if (termList.length === 0) return sql<number>`0`

    return sql<number>`${sql.join(
      termList.map((term) => {
        const pattern = `%${escapeLikePattern(term)}%`
        return sql`CASE
          WHEN (ks.title ILIKE ${pattern} OR ks.raw_content ILIKE ${pattern}) THEN 1
          ELSE 0
        END`
      }),
      sql` + `,
    )}`
  }
  const buildKnowledgeSourceWeightedScore = (
    termList: string[],
    weights: {
      title: number
      content: number
    },
    scaleByLength = false,
  ) => {
    if (termList.length === 0) return sql<number>`0`

    return sql<number>`${sql.join(
      termList.flatMap((term) => {
        const pattern = `%${escapeLikePattern(term)}%`
        const compactLength = term.replace(/[\s_-]+/g, '').length
        const lengthBoost = scaleByLength ? Math.min(4, Math.max(0, compactLength - 2)) : 0
        return [
          sql`CASE WHEN ks.title ILIKE ${pattern} THEN ${weights.title + lengthBoost} ELSE 0 END`,
          sql`CASE WHEN ks.raw_content ILIKE ${pattern} THEN ${weights.content + lengthBoost} ELSE 0 END`,
        ]
      }),
      sql` + `,
    )}`
  }
  const whereMatches = buildKnowledgeSourceMatches([
    ...matchPlan.primaryTerms,
    ...matchPlan.secondaryTerms,
  ])
  const exactCoverage = buildKnowledgeSourceMatchCount(matchPlan.exactTerms)
  const primaryCoverage = buildKnowledgeSourceMatchCount(matchPlan.primaryTerms)
  const secondaryCoverage = buildKnowledgeSourceMatchCount(matchPlan.secondaryTerms)
  const keywordRank = sql<number>`
    ${buildKnowledgeSourceWeightedScore(
      matchPlan.exactTerms,
      { title: 16, content: 9 },
    )} +
    ${buildKnowledgeSourceWeightedScore(
      matchPlan.primaryTerms,
      { title: 7, content: 4 },
      true,
    )} +
    ${buildKnowledgeSourceWeightedScore(
      matchPlan.secondaryTerms,
      { title: 2, content: 1 },
    )} +
    (${primaryCoverage} * 12) +
    (${secondaryCoverage} * 2)
  `
  const results = await db.execute(sql`
    SELECT
      ks.id,
      ks.title,
      ks.raw_content AS content,
      ks.updated_at,
      ${exactCoverage} AS exact_coverage,
      ${primaryCoverage} AS primary_coverage,
      ${secondaryCoverage} AS secondary_coverage,
      ${keywordRank} AS keyword_rank
    FROM knowledge_sources ks
    WHERE ks.workspace_id = ${input.workspaceId}
      AND ks.deleted_at IS NULL
      AND ks.status = 'ready'
      AND (${whereMatches})
    ORDER BY exact_coverage DESC, primary_coverage DESC, keyword_rank DESC, secondary_coverage DESC, ks.updated_at DESC
    LIMIT ${topK}
  `) as unknown as Array<Record<string, unknown>>

  const sections: RetrievedContextSection[] = []

  for (const row of results as unknown as Array<Record<string, unknown>>) {
    const content = String(row.content ?? '')
    const title = (row.title as string) || 'Untitled'
    const snippet = buildSnippetFromDocument(content, terms) || title

    if (!snippet) continue

    const documentId = row.id as string

    sections.push({
      source: {
        documentId,
        documentSlug: null,
        sourceType: 'knowledge_source',
        chunkId: `knowledge-source:${documentId}:keyword`,
        title,
        preview: snippet.slice(0, 150),
        relationType: 'primary',
        relationDescription: 'Direct retrieval match for the user question.',
      },
      content: snippet,
    })
  }

  return sections
}

function buildContextFromSections(
  sections: RetrievedContextSection[],
  limits?: ContextLimits,
  kgContext?: { entityContext: string; relationContext: string },
) {
  const maxContextChars = limits?.maxContextChars ?? MAX_CONTEXT_CHARS
  const maxSectionChars = limits?.maxSectionChars ?? MAX_SECTION_CHARS
  const maxContextTokens = limits?.maxContextTokens ?? MAX_CONTEXT_TOKENS
  const maxSectionTokens = limits?.maxSectionTokens ?? MAX_SECTION_TOKENS
  const sources: ChatSource[] = []
  const contextParts: string[] = []
  let totalChars = 0
  let totalTokens = 0

  // Prepend KG entity context
  if (kgContext?.entityContext) {
    const entityTokens = estimateTokens(kgContext.entityContext)
    if (totalTokens + entityTokens <= maxContextTokens) {
      contextParts.push(`## Knowledge Graph — Entities\n\n${kgContext.entityContext}`)
      totalChars += kgContext.entityContext.length
      totalTokens += entityTokens
    }
  }

  // Prepend KG relation context
  if (kgContext?.relationContext) {
    const relationTokens = estimateTokens(kgContext.relationContext)
    if (totalTokens + relationTokens <= maxContextTokens) {
      contextParts.push(`## Knowledge Graph — Relations\n\n${kgContext.relationContext}`)
      totalChars += kgContext.relationContext.length
      totalTokens += relationTokens
    }
  }

  for (const section of sections) {
    const remainingChars = maxContextChars - totalChars
    const remainingTokens = maxContextTokens - totalTokens
    if (remainingChars <= 0 || remainingTokens <= 0) break

    let content = section.content.slice(0, Math.min(remainingChars, maxSectionChars)).trim()
    if (!content) continue

    // Token-based enforcement: trim content if it exceeds section token budget
    let contentTokens = estimateTokens(content)
    if (contentTokens > maxSectionTokens) {
      // Binary search for the right char cutoff
      let lo = 0
      let hi = content.length
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (estimateTokens(content.slice(0, mid)) <= maxSectionTokens) {
          lo = mid
        } else {
          hi = mid - 1
        }
      }
      content = content.slice(0, lo).trim()
      contentTokens = estimateTokens(content)
    }

    if (totalTokens + contentTokens > maxContextTokens) break
    if (!content) continue

    const label = `[${sources.length + 1}]`
    const relationLine =
      section.source.relationDescription ||
      'Direct retrieval match for the user question.'
    const sourceLabel = section.source.sourceType === 'knowledge_source'
      ? 'Knowledge source'
      : section.source.relationType === 'reference'
        ? 'Related document'
        : 'Primary document'

    contextParts.push(
      [
        `${label} ${sourceLabel}`,
        `Title: "${section.source.title}"`,
        `Relation: ${relationLine}`,
        '',
        content,
      ].join('\n'),
    )
    totalChars += content.length
    totalTokens += contentTokens

    sources.push(section.source)
  }

  return { contextText: contextParts.join('\n\n---\n\n'), sources }
}

async function retrieveChatContext(input: {
  workspaceId: string
  query: string
  documentId?: string
  visibility?: VisibilityContext
  debug?: boolean
  boostDocumentIds?: Set<string>
  chatModelId?: string
  mode?: RagQueryMode
}) {
  const totalStart = performance.now()
  const limits = resolveContextLimits(input.chatModelId)
  const [expansionRules, resolvedMode] = await Promise.all([
    loadQueryExpansionRules(input.workspaceId),
    resolveWorkspaceRagQueryMode({
      workspaceId: input.workspaceId,
      requestedMode: input.mode,
    }),
  ])
  const contextCacheKey = !input.debug
    ? createRagCacheKey([
        'query_context',
        resolvedMode,
        input.query,
        input.documentId ?? null,
        input.visibility ?? null,
        input.boostDocumentIds ? Array.from(input.boostDocumentIds).sort() : [],
      ])
    : null

  if (contextCacheKey) {
    const cached = await getRagCacheEntry<{
      contextText?: string
      sources?: ChatSource[]
      mode?: RagQueryMode
    }>({
      workspaceId: input.workspaceId,
      cacheType: 'query_context',
      cacheKey: contextCacheKey,
    })

    if (cached?.contextText && Array.isArray(cached.sources)) {
      return {
        contextText: cached.contextText,
        sources: cached.sources,
        diagnostics: {
          mode: cached.mode ?? resolvedMode,
          queryVariants: [],
          timings: {
            semanticSearchMs: 0,
            keywordSearchMs: 0,
            neighborhoodMs: 0,
            rerankMs: 0,
            referenceExpansionMs: 0,
            kgRetrievalMs: 0,
            totalMs: 0,
          },
          semanticChunks: [],
          keywordDocuments: [],
          rerankScores: [],
          selectedSections: [],
          cacheHit: true,
        },
      }
    }
  }

  // Chat RAG is intentionally knowledge-source only.
  const shouldUseKg = false
  const shouldIncludeEntityContext = false
  const shouldIncludeRelationContext = false
  const shouldExpandRelatedDocs = false
  const shouldRerank = resolvedMode !== 'naive'
  const queryVariants = buildRetrievalQueries(input.query, expansionRules)

  // KG keyword extraction (runs in parallel with semantic search)
  const kgKeywordsPromise = shouldUseKg
    ? extractQueryKeywords({
        workspaceId: input.workspaceId,
        query: input.query,
      }).catch((error) => {
        logServerError('KG keyword extraction failed', error, { workspaceId: input.workspaceId })
        return { highLevel: [] as string[], lowLevel: [] as string[] }
      })
    : Promise.resolve({ highLevel: [] as string[], lowLevel: [] as string[] })

  const semanticStart = performance.now()
  const [semanticChunks, keywordDocuments] = await Promise.all([
    Promise.all(
      queryVariants.map((query) =>
        searchSimilarChunks({
          workspaceId: input.workspaceId,
          query,
          documentId: input.documentId,
          topK: TOP_K_CHUNKS,
          visibility: input.visibility,
        }),
      ),
    )
      .then((results) => {
        const embeddingModelId = results.find((r) => r.embeddingModelId)?.embeddingModelId ?? null
        const merged = mergeSemanticChunkResults(results.map((r) => r.hits))
        return selectRelevantChunks(merged, embeddingModelId ?? undefined)
      })
      .catch((error) => {
        logServerError('AI chat semantic retrieval failed.', error, {
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          query: input.query,
        })
        return []
      }),
    searchKeywordDocuments({
      workspaceId: input.workspaceId,
      query: input.query,
      documentId: input.documentId,
      visibility: input.visibility,
    }).catch((error) => {
      logServerError('AI chat keyword retrieval failed.', error, {
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        query: input.query,
      })
      return []
      }),
  ])
  const semanticMs = performance.now() - semanticStart

  // KG retrieval: use extracted keywords for entity/relation search
  const kgStart = performance.now()
  const kgKeywords = await kgKeywordsPromise
  const kgContext = shouldUseKg
    ? await retrieveKgContext({
        workspaceId: input.workspaceId,
        query: input.query,
        highLevelKeywords: kgKeywords.highLevel,
        lowLevelKeywords: kgKeywords.lowLevel,
        entityTokenBudget: limits.maxEntityTokens,
        relationTokenBudget: limits.maxRelationTokens,
        mode: resolvedMode,
      }).catch((error) => {
        logServerError('KG retrieval failed', error, { workspaceId: input.workspaceId })
        return {
          entityContext: '',
          relationContext: '',
          entityCount: 0,
          relationCount: 0,
          sourceChunkIds: [] as string[],
        }
      })
    : {
        entityContext: '',
        relationContext: '',
        entityCount: 0,
        relationCount: 0,
        sourceChunkIds: [] as string[],
      }
  const kgMs = performance.now() - kgStart

  const neighborhoodStart = performance.now()
  const neighborhoodMap = await loadChunkNeighborhoods({
    workspaceId: input.workspaceId,
    chunks: semanticChunks,
    chunkRadius: limits.adjacentChunkRadius,
  }).catch((error) => {
    logServerError('AI chat chunk neighborhood expansion failed.', error, {
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      query: input.query,
    })
    return new Map<string, Map<number, string>>()
  })
  const neighborhoodMs = performance.now() - neighborhoodStart

  const sections: RetrievedContextSection[] = buildSemanticSections({
    chunks: semanticChunks,
    neighborhoodMap,
    query: input.query,
    limits,
  })

  const includedDocumentIds = new Set(
    sections.map((section) => section.source.documentId),
  )

  for (const document of keywordDocuments) {
    if (includedDocumentIds.has(document.source.documentId)) continue
    sections.push(document)
  }

  const refStart = performance.now()
  const relatedSections = shouldExpandRelatedDocs
    ? await (async () => {
        const storedRelatedSections = await expandStoredReferencedDocuments({
          workspaceId: input.workspaceId,
          query: input.query,
          primarySections: sections,
          visibility: input.visibility,
        }).catch((error) => {
          logServerError('AI chat stored relation expansion failed.', error, {
            workspaceId: input.workspaceId,
            documentId: input.documentId,
            query: input.query,
          })
          return []
        })

        if (storedRelatedSections.length > 0) {
          return storedRelatedSections
        }

        return expandReferencedDocuments({
          workspaceId: input.workspaceId,
          query: input.query,
          primarySections: sections,
          visibility: input.visibility,
        }).catch((error) => {
          logServerError('AI chat related-document expansion failed.', error, {
            workspaceId: input.workspaceId,
            documentId: input.documentId,
            query: input.query,
          })
          return []
        })
      })()
    : []
  const refMs = performance.now() - refStart

  for (const relatedSection of relatedSections) {
    if (includedDocumentIds.has(relatedSection.source.documentId)) continue
    includedDocumentIds.add(relatedSection.source.documentId)
    sections.push(relatedSection)
  }

  const rerankStart = performance.now()
  const rerankedSections = shouldRerank
    ? await rerankContextSections({
        workspaceId: input.workspaceId,
        query: input.query,
        sections,
        boostDocumentIds: input.boostDocumentIds,
      })
    : sections.slice(0, MAX_CONTEXT_SECTIONS)
  const rerankMs = performance.now() - rerankStart

  const result = buildContextFromSections(rerankedSections, limits, {
    entityContext: shouldIncludeEntityContext ? kgContext.entityContext : '',
    relationContext: shouldIncludeRelationContext ? kgContext.relationContext : '',
  })
  const totalMs = performance.now() - totalStart

  if (contextCacheKey) {
    void setRagCacheEntry({
      workspaceId: input.workspaceId,
      cacheType: 'query_context',
      cacheKey: contextCacheKey,
      payload: {
        contextText: result.contextText,
        sources: result.sources,
        mode: resolvedMode,
      },
      ttlSeconds: RAG_QUERY_CONTEXT_CACHE_TTL_SECONDS,
    })
  }

  const diagnostics: RetrievalDiagnostics | undefined = input.debug
    ? {
        mode: resolvedMode,
        queryVariants,
        timings: {
          semanticSearchMs: Math.round(semanticMs),
          keywordSearchMs: Math.round(semanticMs), // combined in parallel
          neighborhoodMs: Math.round(neighborhoodMs),
          rerankMs: Math.round(rerankMs),
          referenceExpansionMs: Math.round(refMs),
          kgRetrievalMs: Math.round(kgMs),
          totalMs: Math.round(totalMs),
        },
        kgResults: {
          entityCount: kgContext.entityCount,
          relationCount: kgContext.relationCount,
          keywords: kgKeywords,
        },
        semanticChunks: semanticChunks.map((c) => ({
          chunkId: c.chunkId,
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          chunkIndex: c.chunkIndex,
          similarity: c.similarity,
        })),
        keywordDocuments: keywordDocuments.map((s) => ({
          documentId: s.source.documentId,
          title: s.source.title,
        })),
        rerankScores: rerankedSections.map((s) => ({
          documentId: s.source.documentId,
          title: s.source.title,
          score: null,
        })),
        selectedSections: rerankedSections.map((s) => ({
          documentId: s.source.documentId,
          title: s.source.title,
          relationType: s.source.relationType ?? 'primary',
          contentPreview: s.content.slice(0, 200),
        })),
        cacheHit: false,
      }
    : undefined

  return { ...result, diagnostics }
}

export async function debugRetrieveChatContext(input: {
  workspaceId: string
  query: string
  documentId?: string
  visibility?: VisibilityContext
  debug?: boolean
  mode?: RagQueryMode
}) {
  return retrieveChatContext({ ...input, debug: input.debug ?? true })
}

export async function retrieveWorkspaceRagContext(input: {
  workspaceId: string
  query: string
  documentId?: string
  visibility?: VisibilityContext
  debug?: boolean
  mode?: RagQueryMode
}) {
  return retrieveChatContext({ ...input, debug: input.debug ?? false })
}

async function maybeIterativeRetrieval(input: {
  workspaceId: string
  originalQuery: string
  firstResult: { contextText: string; sources: ChatSource[] }
  documentId?: string
  visibility?: VisibilityContext
  provider: { provider: import('@/lib/ai-server').ResolvedAiProviderConfig; modelId: string }
  boostDocumentIds?: Set<string>
  mode?: RagQueryMode
}): Promise<{ contextText: string; sources: ChatSource[] }> {
  if (ENABLE_ITERATIVE_RETRIEVAL === 0) return input.firstResult
  if (input.mode === 'naive') return input.firstResult
  if (input.firstResult.sources.length >= MIN_CONTEXT_SECTIONS_FOR_SKIP) return input.firstResult

  try {
    // Ask the LLM to suggest alternative queries based on what was (or wasn't) found
    const foundSummary = input.firstResult.sources.length > 0
      ? `Found ${input.firstResult.sources.length} section(s): ${input.firstResult.sources.map((s) => s.title).join(', ')}`
      : 'No relevant sections were found.'

    const { result } = await requestAiTextCompletion({
      provider: input.provider.provider,
      model: input.provider.modelId,
      temperature: TEMPERATURE_QUERY_REWRITE,
      systemPrompt:
        'You are a search query generator for a documentation RAG system. ' +
        'The initial search returned insufficient results. Generate 1-2 alternative search queries ' +
        'that might find the relevant documentation. Output one query per line, nothing else.',
      userPrompt:
        `Original query: ${input.originalQuery}\n${foundSummary}\n\nSuggest alternative search queries:`,
    })

    const followUpQueries = result
      .split('\n')
      .map((line) => line.replace(/^\d+[.)]\s*/, '').trim())
      .filter((line) => line.length > 0 && line.length <= 300)
      .slice(0, MAX_ITERATIVE_FOLLOWUP_QUERIES)

    if (followUpQueries.length === 0) return input.firstResult

    // Run follow-up retrievals
    const followUpResults = await Promise.all(
      followUpQueries.map((query) =>
        retrieveChatContext({
          workspaceId: input.workspaceId,
          query,
          documentId: input.documentId,
          visibility: input.visibility,
          boostDocumentIds: input.boostDocumentIds,
          mode: input.mode,
        }).catch(() => ({ contextText: '', sources: [] as ChatSource[] })),
      ),
    )

    // Merge: deduplicate sources by chunkId, concatenate context
    const seenChunkIds = new Set(input.firstResult.sources.map((s) => s.chunkId))
    const mergedSources = [...input.firstResult.sources]
    const contextParts = [input.firstResult.contextText]

    for (const followUp of followUpResults) {
      for (const source of followUp.sources) {
        if (seenChunkIds.has(source.chunkId)) continue
        seenChunkIds.add(source.chunkId)
        mergedSources.push(source)
      }
      if (followUp.contextText) {
        contextParts.push(followUp.contextText)
      }
    }

    return {
      contextText: contextParts.filter(Boolean).join('\n\n---\n\n'),
      sources: mergedSources,
    }
  } catch (error) {
    logServerError('AI iterative retrieval failed, using initial results.', error, {
      workspaceId: input.workspaceId,
      query: input.originalQuery,
    })
    return input.firstResult
  }
}

function createStaticStream(text: string) {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

// ─── Chat session management ────────────────────────────────────

// Chat session CRUD is now in lib/ai/chat-sessions.ts

// ─── MCP prompt resolution ──────────────────────────────────────

async function resolveMcpPromptMessages(
  workspaceId: string,
  mcpPrompt: { serverId: string; name: string; arguments?: Record<string, string> },
): Promise<Array<{ role: 'user' | 'assistant'; content: string }> | undefined> {
  try {
    const config = await getMcpServerConfig(mcpPrompt.serverId, workspaceId)
    if (!config) return undefined

    const result = await getMcpPrompt(config, mcpPrompt.name, mcpPrompt.arguments)
    if (!result.messages.length) return undefined

    return result.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
  } catch (error) {
    logServerError('Failed to resolve MCP prompt messages', error, {
      workspaceId,
      serverId: mcpPrompt.serverId,
      promptName: mcpPrompt.name,
    })
    return undefined
  }
}

// ─── Multi-turn RAG helpers ─────────────────────────────────────

interface HistoryMessageWithSources {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
}

async function rewriteQueryOrSkipRetrieval(input: {
  userMessage: string
  recentHistory: HistoryMessageWithSources[]
  provider: { provider: import('@/lib/ai-server').ResolvedAiProviderConfig; modelId: string }
}): Promise<{
  action: 'retrieve' | 'skip'
  query: string
  previousSources: ChatSource[]
}> {
  // No history — nothing to rewrite
  if (input.recentHistory.length === 0) {
    return { action: 'retrieve', query: input.userMessage, previousSources: [] }
  }

  // Collect previous sources from the last assistant message that had them
  let previousSources: ChatSource[] = []
  for (let i = input.recentHistory.length - 1; i >= 0; i--) {
    const msg = input.recentHistory[i]
    if (msg.role === 'assistant' && msg.sources && msg.sources.length > 0) {
      previousSources = msg.sources
      break
    }
  }

  // Take last N turns for the rewrite prompt
  const historySlice = input.recentHistory.slice(-MAX_HISTORY_TURNS_FOR_REWRITE * 2)

  const conversationSnippet = historySlice
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 400)}`)
    .join('\n')

  try {
    const { result } = await requestAiTextCompletion({
      provider: input.provider.provider,
      model: input.provider.modelId,
      temperature: TEMPERATURE_QUERY_REWRITE,
      systemPrompt:
        'You are a search query rewriter for a documentation RAG system. ' +
        'Given the conversation history and the latest user message, decide:\n' +
        '- If the follow-up does NOT need new document retrieval (e.g. "thanks", "got it", ' +
        '"再详细说说", "explain more", or it can be answered from the already-provided context), ' +
        'output exactly: SKIP\n' +
        '- Otherwise, output a single standalone search query that resolves pronouns and references ' +
        'from the conversation. No explanation, no quotes, just the query text.',
      userPrompt: `Conversation:\n${conversationSnippet}\n\nLatest message: ${input.userMessage}`,
    })

    const trimmed = result.trim()

    if (trimmed.toUpperCase() === 'SKIP') {
      return { action: 'skip', query: input.userMessage, previousSources }
    }

    // Sanity: if the rewritten query is empty or absurdly long, fall back
    if (!trimmed || trimmed.length > 500) {
      return { action: 'retrieve', query: input.userMessage, previousSources }
    }

    return { action: 'retrieve', query: trimmed, previousSources }
  } catch (error) {
    logServerError('AI query rewrite failed, falling back to original query.', error, {
      userMessage: input.userMessage,
    })
    return { action: 'retrieve', query: input.userMessage, previousSources }
  }
}

// ─── RAG chat pipeline ──────────────────────────────────────────

export async function streamChatResponse(input: {
  workspaceId: string
  sessionId: string
  userMessage: string
  documentId?: string
  model?: string
  userId?: string
  role?: MemberRole
  ragMode?: RagQueryMode
  mcpPrompt?: {
    serverId: string
    name: string
    arguments?: Record<string, string>
  }
  abortSignal?: AbortSignal
}) {
  // 1. Get chat history — preserve sources on each message for P1/P2
  const history = await getChatHistory(input.sessionId, input.workspaceId)
  const recentHistoryWithSources: HistoryMessageWithSources[] = history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      sources: (m.sources as ChatSource[] | null) ?? undefined,
    }))

  // Stripped history for the LLM messages array (no sources metadata)
  const recentHistory = recentHistoryWithSources.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const visibility: VisibilityContext | undefined =
    input.userId && input.role
      ? { userId: input.userId, role: input.role }
      : undefined

  // 2. Resolve providers, settings, and MCP in parallel (no retrieval yet)
  const [providers, settings, mcpTools, mcpPromptMessages] = await Promise.all([
    resolveWorkspaceAiProviders(input.workspaceId),
    getAiWorkspaceSettings(input.workspaceId),
    resolveWorkspaceMcpToolSet(input.workspaceId).catch(() => undefined),
    input.mcpPrompt
      ? resolveMcpPromptMessages(input.workspaceId, input.mcpPrompt)
      : Promise.resolve(undefined),
  ])

  // 3. Resolve model selection (needs providers)
  const selection = resolveAiModelSelection({
    requestedModelId: input.model,
    defaultModelId: settings?.defaultModelId ?? null,
    enabledModelIds: Array.isArray(settings?.enabledModelIds)
      ? settings.enabledModelIds.filter(
          (v): v is string => typeof v === 'string',
        )
      : [],
    providers,
  })

  if (!selection) {
    throw new Error('No AI model configured.')
  }

  // 4. Query rewrite / retrieval skip (P0+P1)
  const rewriteResult = await rewriteQueryOrSkipRetrieval({
    userMessage: input.userMessage,
    recentHistory: recentHistoryWithSources,
    provider: selection,
  })

  // 5. Collect boostDocumentIds from previous assistant sources (P2)
  const boostDocumentIds = new Set<string>()
  for (const msg of recentHistoryWithSources) {
    if (msg.role === 'assistant' && msg.sources) {
      for (const source of msg.sources) {
        boostDocumentIds.add(source.documentId)
      }
    }
  }

  // 6. Branch: skip retrieval or retrieve + iterative
  let contextText: string
  let sources: ChatSource[]

  if (rewriteResult.action === 'skip' && rewriteResult.previousSources.length > 0) {
    // Reuse previous sources, no new retrieval
    contextText = ''
    sources = rewriteResult.previousSources
  } else {
    // Retrieve with (possibly rewritten) query
    const firstResult = await retrieveChatContext({
      workspaceId: input.workspaceId,
      query: rewriteResult.query,
      documentId: input.documentId,
      visibility,
      boostDocumentIds: boostDocumentIds.size > 0 ? boostDocumentIds : undefined,
      chatModelId: selection.modelId,
      mode: input.ragMode,
    })

    // Iterative retrieval (P3) — only triggers when enabled and results are sparse
    const finalResult = await maybeIterativeRetrieval({
      workspaceId: input.workspaceId,
      originalQuery: rewriteResult.query,
      firstResult,
      documentId: input.documentId,
      visibility,
      provider: selection,
      boostDocumentIds: boostDocumentIds.size > 0 ? boostDocumentIds : undefined,
      mode: input.ragMode,
    })

    contextText = finalResult.contextText
    sources = finalResult.sources
  }

  // 7. Grounding check — treat skip as grounded when previousSources exist
  const hasDocumentationContext = Boolean(contextText && sources.length > 0)
  const hasSkipWithPreviousSources =
    rewriteResult.action === 'skip' && rewriteResult.previousSources.length > 0
  const hasMcpTools = Boolean(mcpTools)
  const hasMcpPromptMessages = Boolean(mcpPromptMessages?.length)

  if (
    !hasSkipWithPreviousSources &&
    !hasChatGrounding({
      hasDocumentationContext,
      hasMcpTools,
      hasMcpPromptMessages,
    })
  ) {
    const noContextMessage = containsCjk(input.userMessage)
      ? '我没有在当前工作区知识库或已启用的 MCP 工具中找到足够的信息来回答这个问题。请先确认相关内容已导入知识库，或者检查 MCP Server 是否已启用且可用后再试。'
      : 'I could not find enough information in the current workspace knowledge sources or enabled MCP tools to answer that. Please confirm the relevant content has been imported into the knowledge base, or verify the MCP server is enabled and reachable, then try again.'

    return {
      stream: createStaticStream(noContextMessage),
      model: 'grounded-fallback',
      sources: [],
      attributionPromise: Promise.resolve(undefined),
    }
  }

  // 8. Build system prompt + stream (unchanged)
  const systemPrompt = buildChatSystemPrompt({
    documentationContext: hasDocumentationContext ? contextText : undefined,
    hasMcpTools,
    hasMcpPromptMessages,
  })

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(mcpPromptMessages ?? []),
    ...recentHistory,
    { role: 'user' as const, content: input.userMessage },
  ]

  const result = await requestAiChatCompletionStream({
    provider: selection.provider,
    model: selection.modelId,
    systemPrompt,
    messages,
    temperature: TEMPERATURE_CHAT,
    tools: mcpTools,
    maxSteps: mcpTools ? MAX_MCP_TOOL_STEPS : undefined,
    abortSignal: input.abortSignal,
  })

  return {
    stream: result.stream,
    model: result.model,
    sources,
    attributionPromise: result.attributionPromise.then((attribution) =>
      normalizeChatMessageAttribution({
        usedMcp: Boolean(mcpPromptMessages?.length) || attribution?.usedMcp,
        mcpToolNames: attribution?.mcpToolNames ?? [],
      }),
    ),
  }
}

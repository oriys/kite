import { eq, and, sql, desc, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  aiChatSessions,
  aiChatMessages,
  documents,
} from '@/lib/schema'
import {
  requestAiEmbedding,
  requestAiChatCompletionStream,
  requestAiRerank,
  resolveAiModelSelection,
  resolveWorkspaceAiProviders,
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
  type ChatMessageAttribution,
  type ChatSource,
  normalizeChatMessageAttribution,
} from '@/lib/ai-chat-shared'
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_RERANKER_MODEL,
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
  MAX_HISTORY_MESSAGES,
  MAX_KEYWORD_SNIPPET_CHARS,
  MIN_VECTOR_SIMILARITY,
  VECTOR_SIMILARITY_WINDOW,
  MAX_PRIMARY_DOCUMENTS,
  MAX_REFERENCE_LINKS_PER_DOCUMENT,
  MAX_REFERENCE_SEARCH_RESULTS,
  MAX_RELATED_DOCUMENTS,
  MAX_RERANK_DOCUMENT_CHARS,
  SHOPLINE_DOCS_BASE_URL,
  TEMPERATURE_CHAT,
  MAX_MCP_TOOL_STEPS,
} from '@/lib/ai-config'

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

type SemanticChunkHit = Awaited<ReturnType<typeof searchSimilarChunks>>[number]

const DOMAIN_QUERY_REWRITES: Array<{
  pattern: RegExp
  expansions: string[]
}> = [
  {
    pattern: /(权限点|权限|access\s*scope|accessscope|scope|permission)/i,
    expansions: ['权限点', 'AccessScope', 'access scope', '授权'],
  },
  {
    pattern: /(metaobject|元对象)/i,
    expansions: ['metaobject', '元对象'],
  },
  {
    pattern: /(metafield|元字段)/i,
    expansions: ['metafield', '元字段'],
  },
  {
    pattern: /(webhook|事件通知|回调)/i,
    expansions: ['webhook', '事件', '回调'],
  },
  {
    pattern: /(token|访问令牌|授权令牌)/i,
    expansions: ['token', '访问令牌', 'access token'],
  },
  {
    pattern: /(admin\s*rest|admin-rest-api|restful|rest\s+api|rest接口)/i,
    expansions: ['admin rest api', 'admin-rest-api'],
  },
  {
    pattern: /(graphql|graph\s*ql)/i,
    expansions: ['graphql'],
  },
]

// ─── Vector search ──────────────────────────────────────────────

async function resolveEmbeddingConfig(workspaceId: string) {
  const [providers, settings] = await Promise.all([
    resolveWorkspaceAiProviders(workspaceId),
    getAiWorkspaceSettings(workspaceId),
  ])

  const embeddingProviders = providers.filter(
    (p) => p.enabled && (p.providerType === 'openai_compatible' || p.providerType === 'gemini'),
  )

  if (embeddingProviders.length === 0) return null

  return {
    provider: embeddingProviders[0],
    modelId: settings?.embeddingModelId?.trim() || DEFAULT_EMBEDDING_MODEL,
  }
}

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
}) {
  const config = await resolveEmbeddingConfig(input.workspaceId)
  if (!config) return []

  const { embeddings } = await requestAiEmbedding({
    provider: config.provider,
    texts: [input.query],
    model: config.modelId,
  })

  if (embeddings.length === 0) return []

  const queryVector = `[${embeddings[0].join(',')}]`
  const topK = input.topK ?? TOP_K_CHUNKS

  const documentFilter = input.documentId
    ? sql`AND dc.document_id = ${input.documentId}`
    : sql``

  const results = await db.execute(sql`
    SELECT
      dc.id AS chunk_id,
      dc.document_id,
      dc.chunk_text,
      dc.chunk_index,
      d.title AS document_title,
      d.slug AS document_slug,
      1 - (dc.embedding <=> ${queryVector}::vector) AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id AND d.deleted_at IS NULL
    WHERE dc.workspace_id = ${input.workspaceId}
      AND dc.embedding IS NOT NULL
      ${documentFilter}
    ORDER BY dc.embedding <=> ${queryVector}::vector
    LIMIT ${topK}
  `)

  return (results as unknown as Array<Record<string, unknown>>).map((row) => ({
    chunkId: row.chunk_id as string,
    documentId: row.document_id as string,
    chunkText: row.chunk_text as string,
    chunkIndex: row.chunk_index as number,
    documentTitle: row.document_title as string,
    documentSlug:
      row.document_slug === undefined || row.document_slug === null
        ? null
        : String(row.document_slug),
    similarity: Number(row.similarity ?? 0),
  }))
}

// ─── RAG context builder ────────────────────────────────────────

function containsCjk(text: string) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)
}

function extractQueryTerms(query: string) {
  const normalized = query.trim()
  if (!normalized) return []

  const seen = new Set<string>()
  const terms: string[] = []

  const addTerm = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return

    const key = trimmed.toLowerCase()
    if (seen.has(key)) return

    seen.add(key)
    terms.push(trimmed)
  }

  addTerm(normalized)
  addTerm(normalized.replace(/[_-]+/g, ' '))
  addTerm(normalized.replace(/[\s_-]+/g, ''))

  for (const token of normalized.match(/[A-Za-z][A-Za-z0-9:_-]{2,}/g) ?? []) {
    addTerm(token)
    addTerm(token.replace(/[_-]+/g, ' '))
    addTerm(token.replace(/[\s_-]+/g, ''))
    addTerm(token.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
  }

  for (const token of normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    addTerm(token)
  }

  return terms.slice(0, 8)
}

function buildRetrievalQueries(query: string) {
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

  const expandedTerms = new Set<string>()
  for (const rewrite of DOMAIN_QUERY_REWRITES) {
    if (!rewrite.pattern.test(query)) continue
    for (const expansion of rewrite.expansions) {
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
) {
  if (chunks.length === 0) return []

  const topSimilarity = chunks[0].similarity
  if (topSimilarity < MIN_VECTOR_SIMILARITY) return []

  const similarityFloor = Math.max(
    MIN_VECTOR_SIMILARITY,
    topSimilarity - VECTOR_SIMILARITY_WINDOW,
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

function scoreContextBlock(block: string, terms: string[], query: string) {
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

  if (
    /(权限点|权限|access\s*scope|accessscope|permission)/i.test(query) &&
    /(权限点|accessscope|access scope|私有应用是否可用|相关接口)/i.test(block)
  ) {
    score += 18
  }

  if (/(metaobject|元对象)/i.test(query) && /(metaobject|元对象)/i.test(block)) {
    score += 14
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
    score: scoreContextBlock(block, terms, query),
  }))

  const selected = scoredBlocks
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, MAX_COMPRESSED_BLOCKS)
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
) {
  const queryTerms = extractQueryTerms(query)
  const scored = sections.map((section, index) => {
    const title = section.source.title.toLowerCase()
    const content = section.content.toLowerCase()
    let score = section.source.relationType === 'primary' ? 55 : 28
    const modelScore = rerankScores?.get(index) ?? null

    if (modelScore !== null) {
      score += modelScore * 120
    }

    for (const term of queryTerms) {
      const normalizedTerm = term.toLowerCase()
      const compactTerm = normalizedTerm.replace(/[\s_-]+/g, '')

      if (title.includes(normalizedTerm) || title.replace(/[\s/_-]+/g, '').includes(compactTerm)) {
        score += 18
      }

      if (content.includes(normalizedTerm)) {
        score += 7
      }
    }

    if (section.content.includes('<!-- SHOPLINE_IMPORT') || section.content.includes('> Source: ')) {
      score += 6
    }

    if (
      /(权限点|权限|access\s*scope|accessscope|permission)/i.test(query) &&
      /(权限点|accessscope|access scope|私有应用是否可用|相关接口)/i.test(section.content)
    ) {
      score += 20
    }

    if (/(metaobject|元对象)/i.test(query) && /(metaobject|元对象)/i.test(section.content)) {
      score += 14
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
}) {
  if (input.sections.length <= 1) {
    return heuristicRerankContextSections(input.query, input.sections)
  }

  const config = await resolveRerankerConfig(input.workspaceId)
  if (!config) {
    return heuristicRerankContextSections(input.query, input.sections)
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

    return heuristicRerankContextSections(input.query, input.sections, rerankScores)
  } catch (error) {
    logServerError('AI chat reranking failed.', error, {
      workspaceId: input.workspaceId,
      query: input.query,
    })

    return heuristicRerankContextSections(input.query, input.sections)
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
}) {
  const likePatterns = input.candidate.searchTerms.map((term) => `%${term}%`)
  if (likePatterns.length === 0) return []

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

  const results = await db.execute(sql`
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
      AND (${whereMatches})
    ORDER BY keyword_rank DESC, d.updated_at DESC
    LIMIT ${MAX_REFERENCE_SEARCH_RESULTS * 8}
  `)

  const candidateUrlParts = getReferenceUrlParts(input.candidate.url)

  return (results as unknown as Array<Record<string, unknown>>)
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

async function loadDocumentsByIds(workspaceId: string, ids: string[]) {
  if (ids.length === 0) return []

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
}) {
  if (input.chunks.length === 0) {
    return new Map<string, Map<number, string>>()
  }

  const clauses: ReturnType<typeof sql>[] = []

  for (const chunk of input.chunks) {
    const indexes: number[] = []

    for (
      let index = Math.max(0, chunk.chunkIndex - ADJACENT_CHUNK_RADIUS);
      index <= chunk.chunkIndex + ADJACENT_CHUNK_RADIUS;
      index += 1
    ) {
      indexes.push(index)
    }

    clauses.push(
      sql`(dc.document_id = ${chunk.documentId} AND dc.chunk_index IN (${sql.join(
        indexes.map((index) => sql`${index}`),
        sql`, `,
      )}))`,
    )
  }

  const rows = await db.execute(sql`
    SELECT
      dc.document_id,
      dc.chunk_index,
      dc.chunk_text
    FROM document_chunks dc
    WHERE dc.workspace_id = ${input.workspaceId}
      AND (${sql.join(clauses, sql` OR `)})
    ORDER BY dc.document_id ASC, dc.chunk_index ASC
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
}) {
  const sections: RetrievedContextSection[] = []
  const seenRanges = new Set<string>()
  const queryTerms = extractQueryTerms(input.query)

  for (const chunk of input.chunks) {
    const chunkMap = input.neighborhoodMap.get(chunk.documentId)
    const indexes: number[] = []
    const parts: string[] = []

    for (
      let index = Math.max(0, chunk.chunkIndex - ADJACENT_CHUNK_RADIUS);
      index <= chunk.chunkIndex + ADJACENT_CHUNK_RADIUS;
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
      MAX_SECTION_CHARS,
      input.query,
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
}) {
  const primaryDocumentIds = Array.from(
    new Set(input.primarySections.map((section) => section.source.documentId)),
  ).slice(0, MAX_PRIMARY_DOCUMENTS)

  if (primaryDocumentIds.length === 0) return []

  const primaryDocuments = await loadDocumentsByIds(
    input.workspaceId,
    primaryDocumentIds,
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
}): Promise<RetrievedContextSection[]> {
  const terms = extractQueryTerms(input.query)
  if (terms.length === 0) return []

  const documentFilter = input.documentId
    ? sql`AND d.id = ${input.documentId}`
    : sql``

  const likePatterns = terms.map((term) => `%${term}%`)
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

  const topK = input.topK ?? TOP_K_KEYWORD_DOCUMENTS

  const results = await db.execute(sql`
    SELECT
      d.id,
      d.title,
      d.content,
      d.updated_at,
      ${keywordRank} AS keyword_rank
    FROM documents d
    WHERE d.workspace_id = ${input.workspaceId}
      AND d.deleted_at IS NULL
      ${documentFilter}
      AND (${whereMatches})
    ORDER BY keyword_rank DESC, d.updated_at DESC
    LIMIT ${topK}
  `)

  const sections: RetrievedContextSection[] = []

  for (const row of results as unknown as Array<Record<string, unknown>>) {
    const content = String(row.content ?? '')
    const snippet = buildSnippetFromDocument(content, terms)

    if (!snippet) continue

    const documentId = row.id as string
    const title = (row.title as string) || 'Untitled'

    sections.push({
      source: {
        documentId,
        documentSlug:
          row.slug === undefined || row.slug === null
            ? null
            : String(row.slug),
        chunkId: `document:${documentId}:keyword`,
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

function buildContextFromSections(sections: RetrievedContextSection[]) {
  const sources: ChatSource[] = []
  const contextParts: string[] = []
  let totalChars = 0

  for (const section of sections) {
    const remainingChars = MAX_CONTEXT_CHARS - totalChars
    if (remainingChars <= 0) break

    const content = section.content.slice(0, Math.min(remainingChars, MAX_SECTION_CHARS)).trim()
    if (!content) continue

    const label = `[${sources.length + 1}]`
    const relationLine =
      section.source.relationDescription ||
      'Direct retrieval match for the user question.'

    contextParts.push(
      [
        `${label} ${section.source.relationType === 'reference' ? 'Related document' : 'Primary document'}`,
        `Title: "${section.source.title}"`,
        `Relation: ${relationLine}`,
        '',
        content,
      ].join('\n'),
    )
    totalChars += content.length

    sources.push(section.source)
  }

  return { contextText: contextParts.join('\n\n---\n\n'), sources }
}

async function retrieveChatContext(input: {
  workspaceId: string
  query: string
  documentId?: string
}) {
  const [semanticChunks, keywordDocuments] = await Promise.all([
    Promise.all(
      buildRetrievalQueries(input.query).map((query) =>
        searchSimilarChunks({
          workspaceId: input.workspaceId,
          query,
          documentId: input.documentId,
          topK: TOP_K_CHUNKS,
        }),
      ),
    )
      .then(mergeSemanticChunkResults)
      .then(selectRelevantChunks)
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
    }).catch((error) => {
      logServerError('AI chat keyword retrieval failed.', error, {
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        query: input.query,
      })
      return []
      }),
  ])

  const neighborhoodMap = await loadChunkNeighborhoods({
    workspaceId: input.workspaceId,
    chunks: semanticChunks,
  }).catch((error) => {
    logServerError('AI chat chunk neighborhood expansion failed.', error, {
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      query: input.query,
    })
    return new Map<string, Map<number, string>>()
  })

  const sections: RetrievedContextSection[] = buildSemanticSections({
    chunks: semanticChunks,
    neighborhoodMap,
    query: input.query,
  })

  const includedDocumentIds = new Set(
    sections.map((section) => section.source.documentId),
  )

  for (const document of keywordDocuments) {
    if (includedDocumentIds.has(document.source.documentId)) continue
    sections.push(document)
  }

  const storedRelatedSections = await expandStoredReferencedDocuments({
    workspaceId: input.workspaceId,
    query: input.query,
    primarySections: sections,
  }).catch((error) => {
    logServerError('AI chat stored relation expansion failed.', error, {
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      query: input.query,
    })
    return []
  })

  const relatedSections =
    storedRelatedSections.length > 0
      ? storedRelatedSections
      : await expandReferencedDocuments({
          workspaceId: input.workspaceId,
          query: input.query,
          primarySections: sections,
        }).catch((error) => {
          logServerError('AI chat related-document expansion failed.', error, {
            workspaceId: input.workspaceId,
            documentId: input.documentId,
            query: input.query,
          })
          return []
        })

  for (const relatedSection of relatedSections) {
    if (includedDocumentIds.has(relatedSection.source.documentId)) continue
    includedDocumentIds.add(relatedSection.source.documentId)
    sections.push(relatedSection)
  }

  return buildContextFromSections(
    await rerankContextSections({
      workspaceId: input.workspaceId,
      query: input.query,
      sections,
    }),
  )
}

export async function debugRetrieveChatContext(input: {
  workspaceId: string
  query: string
  documentId?: string
}) {
  return retrieveChatContext(input)
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

export async function createChatSession(input: {
  workspaceId: string
  userId: string
  documentId?: string
  title?: string
}) {
  const [session] = await db
    .insert(aiChatSessions)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      documentId: input.documentId ?? null,
      title: input.title ?? 'New conversation',
    })
    .returning()

  return session
}

export async function listChatSessions(input: {
  workspaceId: string
  userId: string
  limit?: number
}) {
  return db
    .select({
      id: aiChatSessions.id,
      title: aiChatSessions.title,
      documentId: aiChatSessions.documentId,
      createdAt: aiChatSessions.createdAt,
      updatedAt: aiChatSessions.updatedAt,
    })
    .from(aiChatSessions)
    .where(
      and(
        eq(aiChatSessions.workspaceId, input.workspaceId),
        eq(aiChatSessions.userId, input.userId),
      ),
    )
    .orderBy(desc(aiChatSessions.updatedAt))
    .limit(input.limit ?? 20)
}

export async function getChatHistory(sessionId: string) {
  const rows = await db
    .select({
      id: aiChatMessages.id,
      role: aiChatMessages.role,
      content: aiChatMessages.content,
      sources: aiChatMessages.sources,
      attribution: aiChatMessages.attribution,
      createdAt: aiChatMessages.createdAt,
    })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, sessionId))
    .orderBy(aiChatMessages.createdAt)

  return rows.map((row) => ({
    ...row,
    attribution: normalizeChatMessageAttribution(row.attribution),
  }))
}

export async function saveChatMessage(input: {
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: ChatSource[]
  attribution?: ChatMessageAttribution
}) {
  const [message] = await db
    .insert(aiChatMessages)
    .values({
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      sources: input.sources ?? [],
      attribution: input.attribution,
    })
    .returning()

  // Update session timestamp
  await db
    .update(aiChatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(aiChatSessions.id, input.sessionId))

  return message
}

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
  } catch {
    return undefined
  }
}

// ─── RAG chat pipeline ──────────────────────────────────────────

export async function streamChatResponse(input: {
  workspaceId: string
  sessionId: string
  userMessage: string
  documentId?: string
  model?: string
  mcpPrompt?: {
    serverId: string
    name: string
    arguments?: Record<string, string>
  }
}) {
  // 1. Get chat history for context
  const history = await getChatHistory(input.sessionId)
  const recentHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  const [
    { contextText, sources },
    providers,
    settings,
    mcpTools,
    mcpPromptMessages,
  ] = await Promise.all([
    retrieveChatContext({
      workspaceId: input.workspaceId,
      query: input.userMessage,
      documentId: input.documentId,
    }),
    resolveWorkspaceAiProviders(input.workspaceId),
    getAiWorkspaceSettings(input.workspaceId),
    resolveWorkspaceMcpToolSet(input.workspaceId).catch(() => undefined),
    input.mcpPrompt
      ? resolveMcpPromptMessages(input.workspaceId, input.mcpPrompt)
      : Promise.resolve(undefined),
  ])

  const hasDocumentationContext = Boolean(contextText && sources.length > 0)
  const hasMcpTools = Boolean(mcpTools)
  const hasMcpPromptMessages = Boolean(mcpPromptMessages?.length)

  if (
    !hasChatGrounding({
      hasDocumentationContext,
      hasMcpTools,
      hasMcpPromptMessages,
    })
  ) {
    const noContextMessage = containsCjk(input.userMessage)
      ? '我没有在当前工作区文档或已启用的 MCP 工具中找到足够的信息来回答这个问题。请先确认相关文档已经导入并重新生成 embeddings，或者检查 MCP Server 是否已启用且可用后再试。'
      : 'I could not find enough information in the current workspace documents or enabled MCP tools to answer that. Please confirm the relevant documents exist and rerun embeddings if needed, or verify the MCP server is enabled and reachable, then try again.'

    return {
      stream: createStaticStream(noContextMessage),
      model: 'grounded-fallback',
      sources: [],
      attributionPromise: Promise.resolve(undefined),
    }
  }

  // 2. Build system prompt with available grounding
  const systemPrompt = buildChatSystemPrompt({
    documentationContext: hasDocumentationContext ? contextText : undefined,
    hasMcpTools,
    hasMcpPromptMessages,
  })

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

  // 3. Stream response with full conversation context
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    // Prepend MCP prompt messages if provided
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

import { retrieveWorkspaceRagContext } from '@/lib/ai-chat'
import { chunkDocument, type DocumentChunk } from '@/lib/chunker'
import {
  extractKnowledgeSourceContent,
  EXTRACTABLE_KNOWLEDGE_SOURCE_TYPES,
} from '@/lib/knowledge-source-content'
import { type OpenApiDocumentType, getOpenApiDocumentTypeMeta } from '@/lib/openapi/document-types'
import { type ParsedEndpoint } from '@/lib/openapi/parser'
import {
  deriveTitleFromUrl,
  fetchPublicUrlContent,
  type PublicUrlContentError,
} from '@/lib/public-url-content'
import { resolveWorkspaceRagQueryMode } from '@/lib/rag/settings'
import { type RagQueryMode, type RagVisibilityContext } from '@/lib/rag/types'
import { sanitizePlainText } from '@/lib/sanitize'
import { logServerError } from '@/lib/server-errors'

export const DOC_GENERATION_MATERIAL_SOURCE_TYPES =
  EXTRACTABLE_KNOWLEDGE_SOURCE_TYPES

export type DocGenerationMaterialSourceType =
  (typeof DOC_GENERATION_MATERIAL_SOURCE_TYPES)[number]

export interface DocGenerationMaterialInput {
  title?: string
  sourceType: DocGenerationMaterialSourceType
  rawContent?: string
  sourceUrl?: string | null
  fileName?: string | null
}

export interface DocGenerationRetrievedContext {
  contextText: string
  materialCount: number
  materialTitles: string[]
  queryVariants: string[]
  ragMode: RagQueryMode
  workspaceSourceCount: number
}

interface ResolvedMaterial {
  title: string
  sourceType: DocGenerationMaterialSourceType
  sourceUrl: string | null
  content: string
}

interface RankedMaterialChunk {
  material: ResolvedMaterial
  chunk: DocumentChunk
  score: number
}

const MAX_DOC_GENERATION_MATERIALS = 8
const MAX_MATERIAL_CONTENT_CHARS = 200_000
const MAX_CONTEXT_CHARS = 12_000
const MAX_RETRIEVED_CHUNKS = 6
const MAX_CHUNKS_PER_MATERIAL = 2
const MIN_MULTI_TURN_RESULTS = 3
const MAX_MULTI_TURN_QUERIES = 2
const URL_FETCH_TIMEOUT_MS = 8_000

export class DocGenerationMaterialError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'DocGenerationMaterialError'
    this.status = status
  }
}

export function isDocGenerationMaterialSourceType(
  value: string,
): value is DocGenerationMaterialSourceType {
  return DOC_GENERATION_MATERIAL_SOURCE_TYPES.includes(
    value as DocGenerationMaterialSourceType,
  )
}

async function fetchUrlMaterial(sourceUrl: string) {
  try {
    const fetched = await fetchPublicUrlContent(sourceUrl, {
      timeoutMs: URL_FETCH_TIMEOUT_MS,
      maxChars: MAX_MATERIAL_CONTENT_CHARS,
    })
    return {
      title: fetched.title,
      sourceType: 'document' as const,
      rawContent: fetched.rawContent,
      sourceUrl,
    }
  } catch (error) {
    const urlError = error as PublicUrlContentError
    throw new DocGenerationMaterialError(
      error instanceof Error
        ? error.message
        : 'Failed to fetch supplemental URL.',
      urlError?.code === 'fetch_failed' ? 502 : 400,
    )
  }
}

async function resolveMaterial(
  material: DocGenerationMaterialInput,
): Promise<ResolvedMaterial | null> {
  const normalizedTitle = material.title?.trim() ?? ''
  const normalizedUrl = material.sourceUrl?.trim() ?? null
  const normalizedRawContent = material.rawContent ?? ''

  if (material.sourceType === 'url') {
    if (!normalizedUrl) {
      throw new DocGenerationMaterialError(
        'Supplemental URL materials require a sourceUrl.',
        400,
      )
    }

    const fetched = await fetchUrlMaterial(normalizedUrl)
    const extracted = await extractKnowledgeSourceContent(
      fetched.sourceType,
      fetched.rawContent,
    )
    const content = sanitizePlainText(extracted.content).trim()
    if (!content) return null

    return {
      title:
        normalizedTitle ||
        extracted.title.trim() ||
        fetched.title.trim() ||
        deriveTitleFromUrl(normalizedUrl),
      sourceType: material.sourceType,
      sourceUrl: normalizedUrl,
      content,
    }
  }

  if (!normalizedRawContent.trim()) {
    return null
  }

  if (normalizedRawContent.length > MAX_MATERIAL_CONTENT_CHARS) {
    throw new DocGenerationMaterialError(
      `Supplemental material "${normalizedTitle || material.fileName || 'Untitled'}" is too large. Keep it under 200,000 characters.`,
      400,
    )
  }

  const extracted = await extractKnowledgeSourceContent(
    material.sourceType,
    normalizedRawContent,
  )
  const content = sanitizePlainText(extracted.content).trim()
  if (!content) return null

  return {
    title:
      normalizedTitle ||
      extracted.title.trim() ||
      material.fileName?.trim() ||
      'Supplemental material',
    sourceType: material.sourceType,
    sourceUrl: normalizedUrl,
    content,
  }
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

  for (const token of normalized.match(/[A-Za-z][A-Za-z0-9:_./-]{2,}/g) ?? []) {
    addTerm(token)
    addTerm(token.replace(/[_-]+/g, ' '))
    addTerm(token.replace(/[\s/_-]+/g, ''))
    addTerm(token.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
  }

  for (const token of normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    addTerm(token)
  }

  return terms.slice(0, 10)
}

function buildRetrievalQuery(input: {
  sourceName: string
  apiTitle?: string
  userPrompt?: string
  documentType?: OpenApiDocumentType | null
  endpoints: ParsedEndpoint[]
  materialTitles?: string[]
}) {
  const typeMeta = getOpenApiDocumentTypeMeta(input.documentType)
  const endpointSummary = input.endpoints
    .slice(0, 8)
    .map((endpoint) =>
      [
        endpoint.method.toUpperCase(),
        endpoint.path,
        endpoint.summary ?? endpoint.description ?? '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join('\n')
  const materialTitleSummary = (input.materialTitles ?? [])
    .map((title) => title.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join('\n')

  return [
    input.userPrompt?.trim() || '',
    input.apiTitle?.trim() || input.sourceName.trim(),
    typeMeta ? `${typeMeta.label} ${typeMeta.description}` : '',
    endpointSummary,
    materialTitleSummary ? `Supplemental materials:\n${materialTitleSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .trim()
}

function dedupeQueries(queries: string[]) {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const query of queries) {
    const normalized = query.trim().replace(/\s+/g, ' ')
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    deduped.push(normalized)
  }

  return deduped
}

function parseBilingualQueries(result: string) {
  const lines = result
    .split('\n')
    .map((line) => line.replace(/^[*-]\s*/, '').trim())
    .filter(Boolean)

  const englishLine = lines.find((line) => /^english\s*:/i.test(line))
  const chineseLine = lines.find((line) => /^chinese\s*:/i.test(line))

  const english = englishLine
    ? englishLine.replace(/^english\s*:/i, '').trim()
    : lines[0] ?? ''
  const chinese = chineseLine
    ? chineseLine.replace(/^chinese\s*:/i, '').trim()
    : lines.find((line) => line !== english) ?? ''

  return dedupeQueries([english, chinese])
}

async function buildBilingualQueries(input: {
  workspaceId: string
  requestedModelId?: string
  baseQuery: string
}) {
  if (!input.baseQuery.trim()) {
    return []
  }

  const { resolveDocGenerationSelection } = await import(
    '@/lib/openapi/doc-generation-model'
  )
  const selection = await resolveDocGenerationSelection(
    input.workspaceId,
    input.requestedModelId,
  )
  if (!selection) {
    return []
  }
  const { requestAiTextCompletion } = await import('@/lib/ai-server')

  try {
    const { result } = await requestAiTextCompletion({
      provider: selection.provider,
      model: selection.modelId,
      temperature: 0.1,
      systemPrompt: [
        'You generate bilingual retrieval queries for API documentation RAG.',
        'Rewrite the retrieval intent into one concise English query and one concise Simplified Chinese query.',
        'Preserve API names, HTTP methods, paths, headers, product nouns, version strings, and key technical terms.',
        'Return exactly two lines in this format and nothing else:',
        'English: <query>',
        'Chinese: <query>',
      ].join(' '),
      userPrompt: `Original retrieval intent:\n${input.baseQuery}`,
    })

    return parseBilingualQueries(result)
  } catch (error) {
    logServerError('Failed to build bilingual RAG queries.', error, {
      workspaceId: input.workspaceId,
    })
    return []
  }
}

function scoreChunk(
  query: string,
  material: ResolvedMaterial,
  chunk: DocumentChunk,
  mode: RagQueryMode,
) {
  const queryTerms = extractQueryTerms(query)
  const title = material.title.toLowerCase()
  const heading = (chunk.heading ?? chunk.sectionPath ?? '').toLowerCase()
  const content = chunk.chunkText.toLowerCase()
  const sourceUrl = material.sourceUrl?.toLowerCase() ?? ''
  let score = 6

  for (const term of queryTerms) {
    const normalizedTerm = term.toLowerCase()
    const compactTerm = normalizedTerm.replace(/[\s/_-]+/g, '')

    if (title.includes(normalizedTerm) || title.replace(/[\s/_-]+/g, '').includes(compactTerm)) {
      score += 20
    }

    if (heading && (heading.includes(normalizedTerm) || heading.replace(/[\s/_-]+/g, '').includes(compactTerm))) {
      score += 14
    }

    if (sourceUrl && sourceUrl.includes(normalizedTerm)) {
      score += 10
    }

    if (content.includes(normalizedTerm)) {
      score += 7
    }
  }

  if (/\b(GET|POST|PUT|PATCH|DELETE)\b/.test(query.toUpperCase())) {
    const methodMatch = query.toUpperCase().match(/\b(GET|POST|PUT|PATCH|DELETE)\b/)
    if (methodMatch && content.toUpperCase().includes(methodMatch[1])) {
      score += 8
    }
  }

  if (/```/.test(chunk.chunkText)) {
    score += 2
  }

  if (mode === 'local') {
    if (heading.includes('example') || heading.includes('request') || heading.includes('response')) {
      score += 6
    }
    if (/\/[a-z0-9/_-]+/.test(chunk.chunkText) || /\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b/.test(chunk.chunkText)) {
      score += 4
    }
  }

  if (mode === 'global') {
    if (
      heading.includes('overview') ||
      heading.includes('architecture') ||
      heading.includes('workflow') ||
      heading.includes('concept') ||
      heading.includes('migration')
    ) {
      score += 8
    }
    if (chunk.chunkIndex === 0) {
      score += 4
    }
  }

  score += Math.max(0, 4 - chunk.chunkIndex) * 0.5

  return score
}

function selectRankedChunks(
  materials: ResolvedMaterial[],
  queryVariants: string[],
  mode: RagQueryMode,
): RankedMaterialChunk[] {
  const ranked = materials.flatMap((material) =>
    chunkDocument(material.title, material.content).map((chunk) => ({
      material,
      chunk,
      score: queryVariants.reduce(
        (best, query) => Math.max(best, scoreChunk(query, material, chunk, mode)),
        0,
      ),
    })),
  )

  ranked.sort(
    (left, right) =>
      right.score - left.score ||
      left.chunk.chunkIndex - right.chunk.chunkIndex,
  )

  const selected: RankedMaterialChunk[] = []
  const perMaterialCount = new Map<string, number>()

  for (const item of ranked) {
    if (selected.length >= MAX_RETRIEVED_CHUNKS) break

    const currentCount = perMaterialCount.get(item.material.title) ?? 0
    if (currentCount >= MAX_CHUNKS_PER_MATERIAL) continue

    selected.push(item)
    perMaterialCount.set(item.material.title, currentCount + 1)
  }

  return selected
}

async function buildFollowUpQueries(input: {
  workspaceId: string
  requestedModelId?: string
  baseQuery: string
  selectedChunks: RankedMaterialChunk[]
  materials: ResolvedMaterial[]
}) {
  if (input.selectedChunks.length >= MIN_MULTI_TURN_RESULTS) {
    return []
  }

  const { resolveDocGenerationSelection } = await import(
    '@/lib/openapi/doc-generation-model'
  )
  const selection = await resolveDocGenerationSelection(
    input.workspaceId,
    input.requestedModelId,
  )
  if (!selection) {
    return []
  }
  const { requestAiTextCompletion } = await import('@/lib/ai-server')

  try {
    const { result } = await requestAiTextCompletion({
      provider: selection.provider,
      model: selection.modelId,
      temperature: 0.2,
      systemPrompt: [
        'You generate follow-up retrieval queries for API documentation RAG.',
        'Suggest up to two concise search queries that could surface missing operational, architectural, or integration context.',
        'Return one query per line with no numbering and no explanation.',
      ].join(' '),
      userPrompt: [
        `Base query:\n${input.baseQuery}`,
        '',
        'Available materials:',
        ...input.materials.map((material) => `- ${material.title}`),
        '',
        'Already selected context snippets:',
        ...input.selectedChunks.map(
          (chunk, index) =>
            `${index + 1}. ${chunk.material.title} — ${(chunk.chunk.heading ?? chunk.chunk.sectionPath ?? 'General').trim()}`,
        ),
      ].join('\n'),
    })

    return result
      .split('\n')
      .map((line) => line.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, MAX_MULTI_TURN_QUERIES)
  } catch (error) {
    logServerError('Failed to build multi-turn RAG follow-up queries.', error, {
      workspaceId: input.workspaceId,
    })
    return []
  }
}

function humanizeSourceType(value: DocGenerationMaterialSourceType) {
  return value.replace(/_/g, ' ')
}

function buildContextText(chunks: RankedMaterialChunk[], maxChars = MAX_CONTEXT_CHARS) {
  let remainingChars = maxChars
  const parts: string[] = []

  for (const [index, item] of chunks.entries()) {
    const headerLines = [
      `[${index + 1}] ${item.material.title}`,
      `Source Type: ${humanizeSourceType(item.material.sourceType)}`,
      item.material.sourceUrl ? `Source URL: ${item.material.sourceUrl}` : null,
      item.chunk.sectionPath
        ? `Section: ${item.chunk.sectionPath}`
        : item.chunk.heading
          ? `Section: ${item.chunk.heading}`
          : null,
    ].filter((value): value is string => Boolean(value))

    const header = headerLines.join('\n')
    const availableChars = remainingChars - header.length - 12
    if (availableChars < 160) break

    const content = item.chunk.chunkText.slice(0, availableChars).trim()
    if (!content) continue

    parts.push(`${header}\n\n${content}`)
    remainingChars -= header.length + content.length + 8
  }

  return parts.join('\n\n---\n\n')
}

function trimContextText(value: string, maxChars: number) {
  return value.trim().slice(0, maxChars).trim()
}

function buildMergedContextText(input: {
  materialContextText: string
  workspaceContextText: string
}) {
  const materialContextText = input.materialContextText.trim()
  const workspaceContextText = input.workspaceContextText.trim()

  if (materialContextText && workspaceContextText) {
    const materialBlock = trimContextText(materialContextText, 6_800)
    const workspaceBlock = trimContextText(workspaceContextText, 4_600)

    return [
      '## Supplemental materials',
      materialBlock,
      '## Workspace knowledge base',
      workspaceBlock,
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, MAX_CONTEXT_CHARS)
      .trim()
  }

  if (materialContextText) {
    return trimContextText(materialContextText, MAX_CONTEXT_CHARS)
  }

  if (workspaceContextText) {
    return trimContextText(workspaceContextText, MAX_CONTEXT_CHARS)
  }

  return ''
}

export async function retrieveDocGenerationContext(input: {
  workspaceId: string
  sourceName: string
  endpoints: ParsedEndpoint[]
  apiTitle?: string
  userPrompt?: string
  documentType?: OpenApiDocumentType | null
  requestedModelId?: string
  materials: DocGenerationMaterialInput[]
  multiTurn?: boolean
  visibility?: RagVisibilityContext
  ragMode?: RagQueryMode
}): Promise<DocGenerationRetrievedContext | null> {
  if (input.materials.length > MAX_DOC_GENERATION_MATERIALS) {
    throw new DocGenerationMaterialError(
      `You can attach up to ${MAX_DOC_GENERATION_MATERIALS} supplemental materials per generation.`,
      400,
    )
  }

  const resolvedMaterials = (
    await Promise.all(input.materials.map((material) => resolveMaterial(material)))
  ).filter((material): material is ResolvedMaterial => material !== null)

  const baseQuery = buildRetrievalQuery({
    sourceName: input.sourceName,
    apiTitle: input.apiTitle,
    userPrompt: input.userPrompt,
    documentType: input.documentType,
    endpoints: input.endpoints,
    materialTitles: resolvedMaterials.map((material) => material.title),
  })

  const resolvedMode = await resolveWorkspaceRagQueryMode({
    workspaceId: input.workspaceId,
    requestedMode: input.ragMode,
  })
  const bilingualQueries =
    resolvedMaterials.length > 0
      ? await buildBilingualQueries({
          workspaceId: input.workspaceId,
          requestedModelId: input.requestedModelId,
          baseQuery,
        })
      : []
  const initialQueries = dedupeQueries([baseQuery, ...bilingualQueries])
  let queryVariants = initialQueries
  let selectedChunks =
    resolvedMaterials.length > 0
      ? selectRankedChunks(resolvedMaterials, queryVariants, resolvedMode)
      : []

  if (input.multiTurn && resolvedMaterials.length > 0) {
    const followUpQueries = await buildFollowUpQueries({
      workspaceId: input.workspaceId,
      requestedModelId: input.requestedModelId,
      baseQuery,
      selectedChunks,
      materials: resolvedMaterials,
    })

    if (followUpQueries.length > 0) {
      queryVariants = dedupeQueries([...initialQueries, ...followUpQueries])
      selectedChunks = selectRankedChunks(
        resolvedMaterials,
        queryVariants,
        resolvedMode,
      )
    }
  }

  if (resolvedMaterials.length === 0 && !input.visibility) {
    logServerError(
      'Doc generation RAG invoked without materials and without visibility context.',
      new Error('Missing visibility for workspace retrieval'),
      {
        workspaceId: input.workspaceId,
      },
    )
  }

  const materialContextText =
    selectedChunks.length > 0 ? buildContextText(selectedChunks, 6_800) : ''
  const workspaceResult = await retrieveWorkspaceRagContext({
    workspaceId: input.workspaceId,
    query: baseQuery,
    visibility: input.visibility,
    debug: false,
    mode: resolvedMode,
  }).catch((error) => {
    logServerError('Workspace RAG retrieval for doc generation failed.', error, {
      workspaceId: input.workspaceId,
    })
    return { contextText: '', sources: [] as Array<{ documentId: string }> }
  })
  const contextText = buildMergedContextText({
    materialContextText,
    workspaceContextText: workspaceResult.contextText,
  })
  if (!contextText) {
    if (resolvedMaterials.length === 0) {
      return null
    }

    throw new DocGenerationMaterialError(
      'No usable supplemental material content was provided.',
      400,
    )
  }

  return {
    contextText,
    materialCount: resolvedMaterials.length,
    materialTitles: resolvedMaterials.map((material) => material.title),
    queryVariants,
    ragMode: resolvedMode,
    workspaceSourceCount: workspaceResult.sources.length,
  }
}

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { documentRelations, documents } from '@/lib/schema'

const SHOPLINE_DOCS_BASE_URL = 'https://developer.shopline.com'
const MAX_REFERENCE_LINKS_PER_DOCUMENT = 12
const MIN_RELATION_SCORE = 45
const MIN_RELATION_SCORE_GAP = 20
const INSERT_BATCH_SIZE = 500

type WorkspaceDocumentRecord = {
  id: string
  title: string
  content: string
}

type ReferenceCandidate = {
  label?: string
  url?: string
  searchTerms: string[]
}

type ResolvedReference = {
  targetDocument: WorkspaceDocumentRecord
  matchScore: number
}

type DocumentLookup = {
  bySourceUrl: Map<string, WorkspaceDocumentRecord[]>
  byTailPath: Map<string, WorkspaceDocumentRecord[]>
  byLastSegment: Map<string, WorkspaceDocumentRecord[]>
  byTitleAlias: Map<string, WorkspaceDocumentRecord[]>
}

export type StoredDocumentRelation = {
  sourceDocumentId: string
  sourceTitle: string
  targetDocumentId: string
  targetTitle: string
  targetContent: string
  relationType: 'reference'
  relationLabel: string
  matchScore: number
}

function pushLookupValue(
  lookup: Map<string, WorkspaceDocumentRecord[]>,
  key: string | null,
  value: WorkspaceDocumentRecord,
) {
  if (!key) return

  const existing = lookup.get(key) ?? []
  existing.push(value)
  lookup.set(key, existing)
}

function normalizeTitleAlias(value: string | null | undefined) {
  const trimmed = value
    ?.replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!trimmed) return null

  return trimmed
    .toLowerCase()
    .replace(/[`'"()[\]{}<>]/g, '')
    .replace(/[|:：;；,.，。!?！？]/g, '')
    .replace(/[\s/_-]+/g, '')
}

function buildTitleAliases(title: string) {
  const aliases = new Set<string>()
  const addAlias = (value: string | null | undefined) => {
    const normalized = normalizeTitleAlias(value)
    if (normalized) aliases.add(normalized)
  }

  addAlias(title)

  const normalizedTitle = title.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
  const slashParts = normalizedTitle
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (slashParts.length > 0) {
    addAlias(slashParts[slashParts.length - 1])
  }

  if (slashParts.length > 1) {
    addAlias(slashParts.slice(-2).join(' '))
  }

  return [...aliases]
}

function normalizeReferenceLabel(value: string | null | undefined) {
  const trimmed = value?.replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  return trimmed.slice(0, 120)
}

export function normalizeDocumentReferenceUrl(value: string | null | undefined) {
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

export function extractDocumentSourceUrl(content: string) {
  const markerMatch = content.match(
    /<!--\s*SHOPLINE_IMPORT\b[^>]*\bsource=([^\s>]+)\s*-->/i,
  )

  if (markerMatch?.[1]) {
    return normalizeDocumentReferenceUrl(markerMatch[1])
  }

  const sourceLineMatch = content.match(/^>\s*Source:\s*(\S+)\s*$/m)
  return normalizeDocumentReferenceUrl(sourceLineMatch?.[1] ?? null)
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

  const normalizedUrl = normalizeDocumentReferenceUrl(input.url)
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

function extractReferenceCandidates(document: WorkspaceDocumentRecord) {
  const candidates: ReferenceCandidate[] = []
  const seen = new Set<string>()
  const normalizedContent = document.content
    .replace(/\r\n?/g, '\n')
    .replace(/\\([\[\]()])/g, '$1')

  const addCandidate = (label: string | null, url: string | null) => {
    const normalizedLabel = normalizeReferenceLabel(label)
    const normalizedUrl = normalizeDocumentReferenceUrl(url)
    const searchTerms = buildReferenceSearchTerms({
      label: normalizedLabel,
      url: normalizedUrl,
    })

    if (searchTerms.length === 0) return

    const key = `${normalizedUrl ?? ''}|${searchTerms.join('|')}`
    if (seen.has(key)) return

    seen.add(key)
    candidates.push({
      label: normalizedLabel ?? undefined,
      url: normalizedUrl ?? undefined,
      searchTerms,
    })
  }

  for (const match of normalizedContent.matchAll(
    /(?<!!)\[([^\]]{1,120})\]\(([^)\s]+)\)/g,
  )) {
    addCandidate(match[1] ?? null, match[2] ?? null)
  }

  for (const match of normalizedContent.matchAll(
    /https?:\/\/developer\.shopline\.com[^\s)"'>]+/g,
  )) {
    addCandidate(null, match[0] ?? null)
  }

  for (const match of normalizedContent.matchAll(
    /\/zh-hans-cn\/docs\/[^\s)"'>]+/g,
  )) {
    addCandidate(null, match[0] ?? null)
  }

  return candidates.slice(0, MAX_REFERENCE_LINKS_PER_DOCUMENT)
}

function getReferenceUrlParts(value: string | null | undefined) {
  const normalized = normalizeDocumentReferenceUrl(value)
  if (!normalized) {
    return {
      normalized: null,
      lastSegment: '',
      tailPath: '',
    }
  }

  const segments = new URL(normalized).pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.toLowerCase())

  return {
    normalized,
    lastSegment: segments.at(-1) ?? '',
    tailPath: segments.slice(-2).join('/'),
  }
}

function buildDocumentLookup(workspaceDocuments: WorkspaceDocumentRecord[]) {
  const lookup: DocumentLookup = {
    bySourceUrl: new Map(),
    byTailPath: new Map(),
    byLastSegment: new Map(),
    byTitleAlias: new Map(),
  }

  for (const document of workspaceDocuments) {
    const sourceUrl = extractDocumentSourceUrl(document.content)
    const urlParts = getReferenceUrlParts(sourceUrl)

    pushLookupValue(lookup.bySourceUrl, urlParts.normalized, document)
    pushLookupValue(lookup.byTailPath, urlParts.tailPath || null, document)
    pushLookupValue(lookup.byLastSegment, urlParts.lastSegment || null, document)

    for (const alias of buildTitleAliases(document.title)) {
      pushLookupValue(lookup.byTitleAlias, alias, document)
    }
  }

  return lookup
}

function addScore(
  scores: Map<string, ResolvedReference>,
  sourceDocument: WorkspaceDocumentRecord,
  candidates: WorkspaceDocumentRecord[] | undefined,
  value: number,
) {
  if (!candidates?.length) return

  for (const candidate of candidates) {
    if (candidate.id === sourceDocument.id) continue

    const existing = scores.get(candidate.id)
    if (existing) {
      existing.matchScore += value
      continue
    }

    scores.set(candidate.id, {
      targetDocument: candidate,
      matchScore: value,
    })
  }
}

function resolveReferenceCandidate(
  sourceDocument: WorkspaceDocumentRecord,
  candidate: ReferenceCandidate,
  lookup: DocumentLookup,
) {
  const scores = new Map<string, ResolvedReference>()
  const urlParts = getReferenceUrlParts(candidate.url)

  if (urlParts.normalized) {
    addScore(
      scores,
      sourceDocument,
      lookup.bySourceUrl.get(urlParts.normalized),
      140,
    )
  }

  if (urlParts.tailPath) {
    addScore(
      scores,
      sourceDocument,
      lookup.byTailPath.get(urlParts.tailPath),
      90,
    )
  }

  if (urlParts.lastSegment) {
    addScore(
      scores,
      sourceDocument,
      lookup.byLastSegment.get(urlParts.lastSegment),
      70,
    )
  }

  if (candidate.label) {
    const labelAlias = normalizeTitleAlias(candidate.label)
    addScore(
      scores,
      sourceDocument,
      labelAlias ? lookup.byTitleAlias.get(labelAlias) : undefined,
      60,
    )
  }

  for (const term of candidate.searchTerms) {
    const termAlias = normalizeTitleAlias(term)
    addScore(
      scores,
      sourceDocument,
      termAlias ? lookup.byTitleAlias.get(termAlias) : undefined,
      18,
    )
  }

  const ranked = [...scores.values()].sort(
    (left, right) =>
      right.matchScore - left.matchScore ||
      left.targetDocument.title.length - right.targetDocument.title.length,
  )

  const top = ranked[0]
  if (!top || top.matchScore < MIN_RELATION_SCORE) {
    return null
  }

  const second = ranked[1]
  const isClearlyBest =
    top.matchScore >= 140 ||
    !second ||
    top.matchScore - second.matchScore >= MIN_RELATION_SCORE_GAP

  if (!isClearlyBest) {
    return null
  }

  return top
}

async function loadWorkspaceDocuments(workspaceId: string) {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
    })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, workspaceId),
        isNull(documents.deletedAt),
      ),
    )
}

function buildReferenceRelations(workspaceDocuments: WorkspaceDocumentRecord[]) {
  const relations = new Map<
    string,
    {
      workspaceId: string
      sourceDocumentId: string
      targetDocumentId: string
      relationType: 'reference'
      relationLabel: string
      matchScore: number
    }
  >()

  const lookup = buildDocumentLookup(workspaceDocuments)

  for (const sourceDocument of workspaceDocuments) {
    const candidates = extractReferenceCandidates(sourceDocument)

    for (const candidate of candidates) {
      const resolved = resolveReferenceCandidate(sourceDocument, candidate, lookup)
      if (!resolved) continue

      const relationKey = `${sourceDocument.id}:${resolved.targetDocument.id}:reference`
      const relationLabel = candidate.label ?? ''
      const existing = relations.get(relationKey)

      if (existing && existing.matchScore >= resolved.matchScore) {
        continue
      }

      relations.set(relationKey, {
        workspaceId: '',
        sourceDocumentId: sourceDocument.id,
        targetDocumentId: resolved.targetDocument.id,
        relationType: 'reference',
        relationLabel,
        matchScore: resolved.matchScore,
      })
    }
  }

  return [...relations.values()]
}

export async function rebuildWorkspaceDocumentRelations(workspaceId: string) {
  const workspaceDocuments = await loadWorkspaceDocuments(workspaceId)
  const relations = buildReferenceRelations(workspaceDocuments).map((relation) => ({
    ...relation,
    workspaceId,
    updatedAt: new Date(),
  }))

  await db.transaction(async (tx) => {
    await tx
      .delete(documentRelations)
      .where(eq(documentRelations.workspaceId, workspaceId))

    for (let start = 0; start < relations.length; start += INSERT_BATCH_SIZE) {
      const batch = relations.slice(start, start + INSERT_BATCH_SIZE)
      if (batch.length === 0) continue
      await tx.insert(documentRelations).values(batch)
    }
  })

  return {
    documents: workspaceDocuments.length,
    relations: relations.length,
  }
}

export async function listStoredDocumentRelations(input: {
  workspaceId: string
  sourceDocumentIds: string[]
  limit?: number
}) {
  if (input.sourceDocumentIds.length === 0) return []

  const results = await db.execute(sql`
    SELECT
      dr.source_document_id,
      source_doc.title AS source_title,
      dr.target_document_id,
      target_doc.title AS target_title,
      target_doc.content AS target_content,
      dr.relation_type,
      dr.relation_label,
      dr.match_score
    FROM document_relations dr
    JOIN documents source_doc
      ON source_doc.id = dr.source_document_id
     AND source_doc.deleted_at IS NULL
    JOIN documents target_doc
      ON target_doc.id = dr.target_document_id
     AND target_doc.deleted_at IS NULL
    WHERE dr.workspace_id = ${input.workspaceId}
      AND dr.source_document_id IN (${sql.join(
        input.sourceDocumentIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    ORDER BY dr.match_score DESC, target_doc.updated_at DESC
    LIMIT ${input.limit ?? 24}
  `)

  const sourceOrder = new Map(
    input.sourceDocumentIds.map((id, index) => [id, index] as const),
  )

  return (results as unknown as Array<Record<string, unknown>>)
    .map((row) => ({
      sourceDocumentId: row.source_document_id as string,
      sourceTitle: row.source_title as string,
      targetDocumentId: row.target_document_id as string,
      targetTitle: row.target_title as string,
      targetContent: row.target_content as string,
      relationType: row.relation_type as 'reference',
      relationLabel: (row.relation_label as string) || '',
      matchScore: Number(row.match_score ?? 0),
    }))
    .sort(
      (left, right) =>
        (sourceOrder.get(left.sourceDocumentId) ?? Number.MAX_SAFE_INTEGER) -
          (sourceOrder.get(right.sourceDocumentId) ?? Number.MAX_SAFE_INTEGER) ||
        right.matchScore - left.matchScore,
    )
}

export async function countStoredDocumentRelations(input: {
  workspaceId: string
  sourceDocumentIds?: string[]
}) {
  const filters = [
    eq(documentRelations.workspaceId, input.workspaceId),
  ]

  if (input.sourceDocumentIds?.length) {
    filters.push(inArray(documentRelations.sourceDocumentId, input.sourceDocumentIds))
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documentRelations)
    .where(and(...filters))

  return Number(result?.count ?? 0)
}

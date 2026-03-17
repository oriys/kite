import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { listDocuments, createDocument } from '@/lib/queries/documents'
import {
  attachDocumentAccess,
  buildDocumentAccessMap,
} from '@/lib/queries/document-permissions'
import {
  isValidStatus,
  MAX_TITLE_LENGTH,
  MAX_CONTENT_SIZE,
  MAX_DOCUMENT_CATEGORY_LENGTH,
  MAX_DOCUMENT_TAG_COUNT,
  MAX_DOCUMENT_TAG_LENGTH,
} from '@/lib/constants'
import {
  coerceDocumentTagsInput,
  createEmptyDocumentCounts,
  isDocumentSort,
  normalizeDocumentTags,
  type DocStatus,
  type DocumentListCounts,
  type DocumentSort,
} from '@/lib/documents'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const rawStatus = searchParams.get('status')
  const rawApiVersionId = searchParams.get('api_version_id')
  const rawSearchQuery = searchParams.get('q')
  const rawPage = searchParams.get('page')
  const rawPageSize = searchParams.get('page_size')
  const rawSort = searchParams.get('sort')
  const rawCategory = searchParams.get('category')
  const rawTag = searchParams.get('tag')

  let statusFilter: DocStatus | undefined
  if (rawStatus) {
    if (!isValidStatus(rawStatus)) return badRequest('Invalid status filter')
    statusFilter = rawStatus
  }

  const page = rawPage ? Number.parseInt(rawPage, 10) : 1
  if (!Number.isFinite(page) || page < 1) return badRequest('Invalid page')

  const pageSize = rawPageSize ? Number.parseInt(rawPageSize, 10) : 20
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) {
    return badRequest('Invalid page size')
  }

  let sort: DocumentSort = 'updated_desc'
  if (rawSort) {
    if (!isDocumentSort(rawSort)) return badRequest('Invalid sort')
    sort = rawSort
  }

  const docs = await listDocuments(
    result.ctx.workspaceId,
    rawApiVersionId ?? undefined,
    rawSearchQuery?.trim() || undefined,
    sort,
  )
  const accessMap = await buildDocumentAccessMap(
    docs,
    result.ctx.userId,
    result.ctx.role,
  )
  const visibleDocs = docs.filter((doc) => accessMap.get(doc.id)?.canView)
  const selectedTag = normalizeDocumentTags(rawTag).at(0)
  const categories = Array.from(
    new Set(
      visibleDocs
        .map((doc) => doc.category.trim())
        .filter((value) => value.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right))
  const tags = Array.from(
    new Set(visibleDocs.flatMap((doc) => doc.tags)),
  ).sort((left, right) => left.localeCompare(right))
  const categoryFilteredDocs = rawCategory?.trim()
    ? visibleDocs.filter((doc) => doc.category.trim() === rawCategory.trim())
    : visibleDocs
  const tagFilteredDocs = selectedTag
    ? categoryFilteredDocs.filter((doc) => doc.tags.includes(selectedTag))
    : categoryFilteredDocs
  const counts = tagFilteredDocs.reduce<DocumentListCounts>((acc, doc) => {
    acc.all += 1
    acc[doc.status] += 1
    return acc
  }, createEmptyDocumentCounts())
  const filteredDocs = statusFilter
    ? tagFilteredDocs.filter((doc) => doc.status === statusFilter)
    : tagFilteredDocs
  const total = filteredDocs.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const pageItems = filteredDocs
    .slice(startIndex, startIndex + pageSize)
    .map((doc) => attachDocumentAccess(doc, accessMap.get(doc.id)!))

  return NextResponse.json(
    {
        items: pageItems,
        counts,
        categories,
        tags,
        pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
      },
    },
  )
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content : ''
  const category =
    typeof body.category === 'string' ? body.category.trim() : ''
  const tags = coerceDocumentTagsInput(body.tags)

  if (title.length > MAX_TITLE_LENGTH) return badRequest('Title too long')
  if (category.length > MAX_DOCUMENT_CATEGORY_LENGTH) {
    return badRequest('Category too long')
  }
  if (tags === null) return badRequest('Invalid tags')
  if (tags.length > MAX_DOCUMENT_TAG_COUNT) return badRequest('Too many tags')
  if (tags.some((tag) => tag.length > MAX_DOCUMENT_TAG_LENGTH)) {
    return badRequest('Tag too long')
  }
  if (content.length > MAX_CONTENT_SIZE) return badRequest('Content too large')

  const doc = await createDocument(
    result.ctx.workspaceId,
    title || 'Untitled',
    content,
    result.ctx.userId,
    '',
    category,
    tags,
  )

  const accessMap = await buildDocumentAccessMap(
    [doc],
    result.ctx.userId,
    result.ctx.role,
  )

  return NextResponse.json(
    attachDocumentAccess(doc, accessMap.get(doc.id)!),
    { status: 201 },
  )
}

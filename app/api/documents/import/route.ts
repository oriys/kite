import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import { importDocuments } from '@/lib/queries/documents'
import { coerceDocumentTagsInput, type DocStatus } from '@/lib/documents'
import {
  isValidStatus,
  MAX_IMPORT_COUNT,
  MAX_TITLE_LENGTH,
  MAX_CONTENT_SIZE,
  MAX_DOCUMENT_TAG_COUNT,
  MAX_DOCUMENT_TAG_LENGTH,
} from '@/lib/constants'

interface ImportVersionPayload {
  content: string
  savedAt?: string
  wordCount?: number
}

interface ImportDocumentPayload {
  title: string
  content: string
  tags?: string[]
  status?: DocStatus
  createdAt?: string
  updatedAt?: string
  versions?: ImportVersionPayload[]
}

function normalizeVersion(raw: unknown): ImportVersionPayload | null {
  if (!raw || typeof raw !== 'object') return null

  const version = raw as Record<string, unknown>
  const content = typeof version.content === 'string' ? version.content : null
  if (content === null || content.length > MAX_CONTENT_SIZE) return null

  return {
    content,
    savedAt: typeof version.savedAt === 'string' ? version.savedAt : undefined,
    wordCount: typeof version.wordCount === 'number' ? version.wordCount : undefined,
  }
}

function normalizeDocument(raw: unknown): ImportDocumentPayload | null {
  if (!raw || typeof raw !== 'object') return null

  const doc = raw as Record<string, unknown>
  const titleValue = typeof doc.title === 'string' ? doc.title.trim() : ''
  const content = typeof doc.content === 'string' ? doc.content : null
  const status = typeof doc.status === 'string' ? doc.status : undefined
  const tags = coerceDocumentTagsInput(doc.tags)

  if (content === null) return null
  if (titleValue.length > MAX_TITLE_LENGTH || content.length > MAX_CONTENT_SIZE) return null
  if (status && !isValidStatus(status)) return null
  if (tags === null) return null
  if (tags.length > MAX_DOCUMENT_TAG_COUNT) return null
  if (tags.some((tag) => tag.length > MAX_DOCUMENT_TAG_LENGTH)) return null

  const versions = Array.isArray(doc.versions)
    ? doc.versions
        .map((version) => normalizeVersion(version))
        .filter((version): version is ImportVersionPayload => version !== null)
    : []

  return {
    title: titleValue || 'Untitled',
    content,
    tags: tags ?? [],
    status: status as DocStatus | undefined,
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : undefined,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : undefined,
    versions,
  }
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.documents)) {
    return badRequest('Invalid import payload')
  }

  if (body.documents.length === 0) {
    return badRequest('No documents to import')
  }

  if (body.documents.length > MAX_IMPORT_COUNT) {
    return badRequest(`Too many documents. Max ${MAX_IMPORT_COUNT}.`)
  }

  const documents = body.documents
    .map((doc: unknown) => normalizeDocument(doc))
    .filter((doc: ImportDocumentPayload | null): doc is ImportDocumentPayload => doc !== null)

  if (documents.length === 0) {
    return badRequest('No valid documents to import')
  }

  const imported = await importDocuments(
    result.ctx.workspaceId,
    result.ctx.userId,
    documents,
  )

  return NextResponse.json({
    importedCount: imported.length,
    documents: imported,
  })
}

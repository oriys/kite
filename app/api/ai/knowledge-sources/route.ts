import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and, isNull, desc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/schema'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value === 'object' &&
    'text' in value &&
    typeof value.text === 'function'
  )
}

async function parseKnowledgeSourcePayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => null)
    if (!formData) return null

    const fileField = formData.get('file')
    const rawContentField = formData.get('rawContent')
    const sourceType = typeof formData.get('sourceType') === 'string' ? formData.get('sourceType') as string : ''

    let rawContent: string
    if (sourceType === 'zip' && isFileLike(fileField)) {
      const buffer = await fileField.arrayBuffer()
      rawContent = Buffer.from(buffer).toString('base64')
    } else if (typeof rawContentField === 'string') {
      rawContent = rawContentField
    } else if (isFileLike(fileField)) {
      rawContent = await fileField.text()
    } else {
      rawContent = ''
    }

    return {
      title: typeof formData.get('title') === 'string' ? (formData.get('title') as string).trim() : '',
      sourceType,
      sourceUrl: typeof formData.get('sourceUrl') === 'string' ? (formData.get('sourceUrl') as string).trim() : null,
      rawContent,
      metadata: {} as Record<string, unknown>,
      fileName: isFileLike(fileField) ? fileField.name : null,
    }
  }

  const body = await request.json().catch(() => null)
  if (!body) return null

  return {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    sourceType: typeof body.sourceType === 'string' ? body.sourceType : '',
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : null,
    rawContent: typeof body.rawContent === 'string' ? body.rawContent : '',
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : {},
    fileName: null as string | null,
  }
}

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const params = request.nextUrl.searchParams
  const limit = Math.min(500, Math.max(1, parseInt(params.get('limit') ?? '100', 10)))
  const offset = Math.max(0, parseInt(params.get('offset') ?? '0', 10))

  const sources = await db
    .select({
      id: knowledgeSources.id,
      sourceType: knowledgeSources.sourceType,
      status: knowledgeSources.status,
      title: knowledgeSources.title,
      sourceUrl: knowledgeSources.sourceUrl,
      contentHash: knowledgeSources.contentHash,
      metadata: knowledgeSources.metadata,
      errorMessage: knowledgeSources.errorMessage,
      stopRequestedAt: knowledgeSources.stopRequestedAt,
      createdAt: knowledgeSources.createdAt,
      updatedAt: knowledgeSources.updatedAt,
      processedAt: knowledgeSources.processedAt,
    })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.workspaceId, result.ctx.workspaceId),
        isNull(knowledgeSources.deletedAt),
      ),
    )
    .orderBy(desc(knowledgeSources.updatedAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json(sources)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const payload = await parseKnowledgeSourcePayload(request)
  if (!payload) return badRequest('Invalid request')

  const { title, sourceType, sourceUrl, rawContent, metadata, fileName } = payload

  if (!title) return badRequest('Title is required')
  if (rawContent.length > 50 * 1024 * 1024) return badRequest('Content too large (max 50MB)')
  if (
    !['document', 'pdf', 'url', 'markdown', 'faq', 'openapi', 'graphql', 'zip', 'asyncapi', 'protobuf', 'rst', 'asciidoc', 'csv', 'sql_ddl', 'typescript_defs', 'postman'].includes(sourceType)
  ) {
    return badRequest(
      'Invalid sourceType',
    )
  }

  const sourceMetadata = { ...metadata }
  if (fileName) {
    sourceMetadata.fileName = fileName
  }

  const [source] = await db
    .insert(knowledgeSources)
    .values({
      workspaceId: result.ctx.workspaceId,
      title,
      sourceType: sourceType as typeof knowledgeSources.$inferInsert.sourceType,
      sourceUrl,
      rawContent,
      metadata: sourceMetadata,
      createdBy: result.ctx.userId,
    })
    .returning()

  return NextResponse.json(source, { status: 201 })
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and, isNull, desc, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { MAX_IMPORT_COUNT } from '@/lib/constants'
import { EXTRACTABLE_KNOWLEDGE_SOURCE_TYPES } from '@/lib/knowledge-source-content'
import { parsePublicHttpUrl } from '@/lib/outbound-http'
import { deriveTitleFromUrl } from '@/lib/public-url-content'
import { documents, knowledgeSources, openapiSources } from '@/lib/schema'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value === 'object' &&
    'text' in value &&
    typeof value.text === 'function'
  )
}

async function insertKnowledgeSourcesSequentially(
  items: Array<typeof knowledgeSources.$inferInsert>,
) {
  const createdSources: Array<typeof knowledgeSources.$inferSelect> = []

  for (const item of items) {
    const [created] = await db
      .insert(knowledgeSources)
      .values(item)
      .returning()

    if (!created) {
      throw new Error('Failed to create knowledge source')
    }

    createdSources.push(created)
  }

  return createdSources
}

async function parseKnowledgeSourcePayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''

  const normalizeStringList = (value: unknown) => {
    const rawValues = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(/\r?\n/)
        : []

    return Array.from(
      new Set(
        rawValues
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0),
      ),
    )
  }

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
      sourceOrigin:
        typeof formData.get('sourceOrigin') === 'string'
          ? formData.get('sourceOrigin')
          : 'manual',
      sourceUrl: typeof formData.get('sourceUrl') === 'string' ? (formData.get('sourceUrl') as string).trim() : null,
      sourceUrls: sourceType === 'url'
        ? normalizeStringList(
            typeof formData.get('sourceUrl') === 'string'
              ? formData.get('sourceUrl')
              : '',
          )
        : [],
      workspaceImportIds:
        sourceType === 'document' || sourceType === 'openapi'
          ? normalizeStringList(formData.getAll('workspaceImportIds'))
          : [],
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
    sourceOrigin:
      typeof body.sourceOrigin === 'string'
      && (body.sourceOrigin === 'workspace' || body.sourceOrigin === 'manual')
        ? body.sourceOrigin
        : 'manual',
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : null,
    sourceUrls:
      typeof body.sourceType === 'string' && body.sourceType === 'url'
        ? normalizeStringList(
            Array.isArray(body.sourceUrls) || typeof body.sourceUrls === 'string'
              ? body.sourceUrls
              : typeof body.sourceUrl === 'string'
                ? body.sourceUrl
                : '',
          )
        : [],
    workspaceImportIds:
      typeof body.sourceType === 'string'
        && (body.sourceType === 'document' || body.sourceType === 'openapi')
        ? normalizeStringList(body.workspaceImportIds)
        : [],
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

  const {
    title,
    sourceType,
    sourceOrigin,
    sourceUrl,
    sourceUrls,
    workspaceImportIds,
    rawContent,
    metadata,
    fileName,
  } = payload
  const hasWorkspaceImport =
    (sourceType === 'document' || sourceType === 'openapi')
    && workspaceImportIds.length > 0
  const requestedWorkspaceImport = sourceOrigin === 'workspace'

  if (rawContent.length > 50 * 1024 * 1024) return badRequest('Content too large (max 50MB)')
  if (!EXTRACTABLE_KNOWLEDGE_SOURCE_TYPES.includes(sourceType as typeof EXTRACTABLE_KNOWLEDGE_SOURCE_TYPES[number])) {
    return badRequest(
      'Invalid sourceType',
    )
  }
  if (sourceType !== 'url' && !requestedWorkspaceImport && !hasWorkspaceImport && !title) {
    return badRequest('Title is required')
  }
  if (sourceType === 'url' && sourceUrls.length === 0) {
    return badRequest('At least one URL is required')
  }
  if (sourceType === 'url' && sourceUrls.length > MAX_IMPORT_COUNT) {
    return badRequest(`Too many URLs. Max ${MAX_IMPORT_COUNT}.`)
  }
  if (requestedWorkspaceImport && sourceType !== 'document' && sourceType !== 'openapi') {
    return badRequest('Workspace import is only supported for documents and OpenAPI sources')
  }
  if (requestedWorkspaceImport && !hasWorkspaceImport) {
    return badRequest('Select at least one workspace item to import')
  }
  if (hasWorkspaceImport && workspaceImportIds.length > MAX_IMPORT_COUNT) {
    return badRequest(`Too many workspace items. Max ${MAX_IMPORT_COUNT}.`)
  }

  const sourceMetadata = { ...metadata }
  if (fileName) {
    sourceMetadata.fileName = fileName
  }

  if (sourceType === 'url') {
    for (const url of sourceUrls) {
      try {
        parsePublicHttpUrl(url)
      } catch (error) {
        return badRequest(
          error instanceof Error ? error.message : 'Invalid URL',
        )
      }
    }

    const useExplicitTitle = sourceUrls.length === 1 && title.length > 0
    const createdSources = await db
      .insert(knowledgeSources)
      .values(
        sourceUrls.map((url) => ({
          workspaceId: result.ctx.workspaceId,
          title: useExplicitTitle
            ? title
            : deriveTitleFromUrl(url).trim() || 'Untitled URL',
          sourceType: 'url' as const,
          sourceUrl: url,
          rawContent,
          metadata: useExplicitTitle
            ? sourceMetadata
            : { ...sourceMetadata, generatedTitleFromUrl: true },
          createdBy: result.ctx.userId,
        })),
      )
      .returning()

    return NextResponse.json({ items: createdSources }, { status: 201 })
  }

  if (hasWorkspaceImport) {
    if (sourceType === 'document') {
      const documentRows = await db
        .select({
          id: documents.id,
          title: documents.title,
          slug: documents.slug,
          content: documents.content,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(
          and(
            eq(documents.workspaceId, result.ctx.workspaceId),
            isNull(documents.deletedAt),
            inArray(documents.id, workspaceImportIds),
          ),
        )

      const documentsById = new Map(documentRows.map((row) => [row.id, row]))
      if (documentsById.size !== workspaceImportIds.length) {
        return badRequest('One or more workspace documents were not found')
      }
      for (const documentId of workspaceImportIds) {
        const document = documentsById.get(documentId)!
        if ((document.content ?? '').length > 50 * 1024 * 1024) {
          return badRequest(`"${document.title}" is too large to import into the knowledge base`)
        }
      }

      const useExplicitTitle = workspaceImportIds.length === 1 && title.length > 0
      const createdSources = await insertKnowledgeSourcesSequentially(
        workspaceImportIds.map((documentId) => {
          const document = documentsById.get(documentId)!
          const nextRawContent = document.content ?? ''

          return {
            workspaceId: result.ctx.workspaceId,
            title: useExplicitTitle
              ? title
              : document.title.trim() || 'Untitled Document',
            sourceType: 'document' as const,
            sourceUrl: null,
            rawContent: nextRawContent,
            metadata: {
              ...sourceMetadata,
              ...(useExplicitTitle ? {} : { generatedTitleFromWorkspace: true }),
              workspaceImport: {
                kind: 'document',
                documentId: document.id,
                slug: document.slug,
                updatedAt: document.updatedAt.toISOString(),
              },
            },
            createdBy: result.ctx.userId,
          }
        }),
      )

      return NextResponse.json({ items: createdSources }, { status: 201 })
    }

    if (sourceType === 'openapi') {
      const openapiRows = await db
        .select({
          id: openapiSources.id,
          name: openapiSources.name,
          sourceType: openapiSources.sourceType,
          sourceUrl: openapiSources.sourceUrl,
          rawContent: openapiSources.rawContent,
          parsedVersion: openapiSources.parsedVersion,
          openapiVersion: openapiSources.openapiVersion,
          lastSyncedAt: openapiSources.lastSyncedAt,
        })
        .from(openapiSources)
        .where(
          and(
            eq(openapiSources.workspaceId, result.ctx.workspaceId),
            isNull(openapiSources.deletedAt),
            inArray(openapiSources.id, workspaceImportIds),
          ),
        )

      const openapiById = new Map(openapiRows.map((row) => [row.id, row]))
      if (openapiById.size !== workspaceImportIds.length) {
        return badRequest('One or more workspace OpenAPI sources were not found')
      }
      for (const openapiId of workspaceImportIds) {
        const openapi = openapiById.get(openapiId)!
        if (openapi.rawContent.length > 50 * 1024 * 1024) {
          return badRequest(`"${openapi.name}" is too large to import into the knowledge base`)
        }
      }

      const useExplicitTitle = workspaceImportIds.length === 1 && title.length > 0
      const createdSources = await insertKnowledgeSourcesSequentially(
        workspaceImportIds.map((openapiId) => {
          const openapi = openapiById.get(openapiId)!

          return {
            workspaceId: result.ctx.workspaceId,
            title: useExplicitTitle
              ? title
              : openapi.name.trim() || 'Untitled OpenAPI Source',
            sourceType: 'openapi' as const,
            sourceUrl: openapi.sourceUrl,
            rawContent: openapi.rawContent,
            metadata: {
              ...sourceMetadata,
              ...(useExplicitTitle ? {} : { generatedTitleFromWorkspace: true }),
              workspaceImport: {
                kind: 'openapi',
                sourceId: openapi.id,
                sourceType: openapi.sourceType,
                parsedVersion: openapi.parsedVersion,
                openapiVersion: openapi.openapiVersion,
                lastSyncedAt: openapi.lastSyncedAt?.toISOString() ?? null,
              },
            },
            createdBy: result.ctx.userId,
          }
        }),
      )

      return NextResponse.json({ items: createdSources }, { status: 201 })
    }
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

  return NextResponse.json({ items: [source] }, { status: 201 })
}

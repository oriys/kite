import { NextResponse } from 'next/server'

import { withWorkspaceAuth } from '@/lib/api-utils'
import { buildDocumentAccessMap } from '@/lib/queries/document-permissions'
import { listDocuments } from '@/lib/queries/documents'
import { listOpenapiSources } from '@/lib/queries/openapi'

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const [documents, openapi] = await Promise.all([
    listDocuments(result.ctx.workspaceId, undefined, undefined, 'updated_desc'),
    listOpenapiSources(result.ctx.workspaceId),
  ])

  const documentAccess = await buildDocumentAccessMap(
    documents,
    result.ctx.userId,
    result.ctx.role,
  )

  const visibleDocuments = documents
    .filter((document) => documentAccess.get(document.id)?.canView)
    .map((document) => ({
      id: document.id,
      title: document.title,
      slug: document.slug,
      status: document.status,
      preview: document.preview,
      updatedAt: document.updatedAt,
    }))

  return NextResponse.json({
    documents: visibleDocuments,
    openapiSources: openapi.map((source) => ({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl ?? null,
      parsedVersion: source.parsedVersion,
      openapiVersion: source.openapiVersion ?? null,
      createdAt: source.createdAt,
      lastSyncedAt: source.lastSyncedAt ?? null,
    })),
  })
}

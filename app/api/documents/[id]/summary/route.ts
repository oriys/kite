import type { NextRequest } from 'next/server'
import { NextResponse, after } from 'next/server'

import { forbidden, notFound, withWorkspaceAuth } from '@/lib/api-utils'
import { generateDocumentMetadata } from '@/lib/document-summary'
import {
  getDocumentByIdentifier,
  updateDocumentSummaryIfUnchanged,
} from '@/lib/queries/documents'
import { buildDocumentAccessMap } from '@/lib/queries/document-permissions'
import { logServerError } from '@/lib/server-errors'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocumentByIdentifier(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const access = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)
  if (!access?.canEdit) return forbidden()

  after(async () => {
    try {
      const metadata = await generateDocumentMetadata({
        workspaceId: result.ctx.workspaceId,
        title: doc.title,
        content: doc.content,
      })

      await updateDocumentSummaryIfUnchanged(
        doc.id,
        result.ctx.workspaceId,
        metadata,
        doc.updatedAt,
      )
    } catch (error) {
      logServerError('Failed to refresh summary for document.', error, {
        documentId: doc.id,
        workspaceId: result.ctx.workspaceId,
        userId: result.ctx.userId,
      })
    }
  })

  return NextResponse.json(
    {
      id: doc.id,
      queued: true,
    },
    { status: 202 },
  )
}

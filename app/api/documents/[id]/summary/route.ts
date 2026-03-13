import type { NextRequest } from 'next/server'
import { NextResponse, after } from 'next/server'

import { notFound, withWorkspaceAuth } from '@/lib/api-utils'
import { generateDocumentMetadata } from '@/lib/document-summary'
import {
  getDocument,
  updateDocumentSummaryIfUnchanged,
} from '@/lib/queries/documents'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  after(async () => {
    try {
      const metadata = await generateDocumentMetadata({
        title: doc.title,
        content: doc.content,
      })

      await updateDocumentSummaryIfUnchanged(
        id,
        result.ctx.workspaceId,
        metadata,
        doc.updatedAt,
      )
    } catch (error) {
      console.error(`Failed to refresh summary for document ${id}`, error)
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

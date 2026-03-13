import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { withWorkspaceAuth, notFound, forbidden } from '@/lib/api-utils'
import { getDocument } from '@/lib/queries/documents'
import { buildDocumentAccessMap } from '@/lib/queries/document-permissions'
import { db } from '@/lib/db'
import { documentVersions } from '@/lib/schema'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const { id } = await context.params
  const doc = await getDocument(id, result.ctx.workspaceId)
  if (!doc) return notFound()

  const access = (
    await buildDocumentAccessMap([doc], result.ctx.userId, result.ctx.role)
  ).get(doc.id)
  if (!access?.canView) return forbidden()

  const versions = await db
    .select({
      id: documentVersions.id,
      content: documentVersions.content,
      wordCount: documentVersions.wordCount,
      savedAt: documentVersions.savedAt,
    })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, id))
    .orderBy(desc(documentVersions.savedAt))

  return NextResponse.json(versions)
}

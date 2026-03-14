import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound, badRequest } from '@/lib/api-utils'
import {
  getApiVersion,
  cloneVersionDocuments,
} from '@/lib/queries/api-versions'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id: sourceId } = await context.params
  const sourceVersion = await getApiVersion(sourceId, result.ctx.workspaceId)
  if (!sourceVersion) return notFound()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const targetVersionId =
    typeof body.targetVersionId === 'string'
      ? body.targetVersionId.trim()
      : ''
  if (!targetVersionId) return badRequest('targetVersionId is required')

  const targetVersion = await getApiVersion(targetVersionId, result.ctx.workspaceId)
  if (!targetVersion) return badRequest('Target version not found in this workspace')

  const cloned = await cloneVersionDocuments(
    sourceId,
    targetVersionId,
    result.ctx.workspaceId,
  )

  return NextResponse.json(
    { clonedCount: cloned.length, documents: cloned },
    { status: 201 },
  )
}

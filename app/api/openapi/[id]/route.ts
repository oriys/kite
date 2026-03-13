import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import {
  getOpenapiSource,
  deleteOpenapiSource,
} from '@/lib/queries/openapi'

/**
 * GET /api/openapi/[id] — Get a single OpenAPI source with recent snapshots.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params
  const source = await getOpenapiSource(id)

  if (!source || source.workspaceId !== ctx.workspaceId) {
    return notFound()
  }

  return NextResponse.json(source)
}

/**
 * DELETE /api/openapi/[id] — Delete an OpenAPI source and all related data.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params
  const source = await getOpenapiSource(id)

  if (!source || source.workspaceId !== ctx.workspaceId) {
    return notFound()
  }

  await deleteOpenapiSource(id)
  return NextResponse.json({ success: true })
}

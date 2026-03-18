import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { getGrpcSource, deleteGrpcSource } from '@/lib/queries/grpc'

/**
 * GET /api/grpc/[id] — Get a single gRPC source.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params
  const source = await getGrpcSource(id)

  if (!source || source.workspaceId !== ctx.workspaceId) {
    return notFound()
  }

  return NextResponse.json({
    id: source.id,
    name: source.name,
    sourceType: source.sourceType,
    sourceConfig: source.sourceConfig,
    createdAt: source.createdAt,
    lastSyncedAt: source.lastSyncedAt,
  })
}

/**
 * DELETE /api/grpc/[id] — Delete a gRPC source.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params
  const source = await getGrpcSource(id)

  if (!source || source.workspaceId !== ctx.workspaceId) {
    return notFound()
  }

  await deleteGrpcSource(id)
  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound, badRequest } from '@/lib/api-utils'
import { getGrpcSource, syncGrpcSource } from '@/lib/queries/grpc'
import { parseProtoContent, parseProtoZip, computeChecksum } from '@/lib/grpc/proto-parser'

/**
 * POST /api/grpc/[id]/sync — Re-sync a gRPC source from registry or re-upload.
 */
export async function POST(
  req: NextRequest,
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

  // For registry sources, the sync would discover services from the registry.
  // For now, accept updated proto content in the body.
  const body = await req.json().catch(() => null)
  if (!body?.rawContent) {
    return badRequest('rawContent is required for sync')
  }

  let spec
  try {
    if (source.sourceType === 'proto_zip') {
      const buffer = Buffer.from(body.rawContent, 'base64')
      spec = await parseProtoZip(new Uint8Array(buffer))
    } else {
      spec = await parseProtoContent(body.rawContent)
    }
  } catch (err) {
    return badRequest(
      `Invalid proto content: ${err instanceof Error ? err.message : 'Parse error'}`,
    )
  }

  const checksum = computeChecksum(body.rawContent)
  const updated = await syncGrpcSource(id, body.rawContent, checksum, spec)

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    lastSyncedAt: updated.lastSyncedAt,
    serviceCount: spec.services.length,
  })
}

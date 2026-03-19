import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { getGrpcSource, listGrpcServices } from '@/lib/queries/grpc'

/**
 * GET /api/grpc/[id]/services — List services and methods for a source.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params
  const source = await getGrpcSource(ctx.workspaceId, id)

  if (!source) {
    return notFound()
  }

  const services = await listGrpcServices(id)
  return NextResponse.json(services)
}

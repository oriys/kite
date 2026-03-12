import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import {
  getOpenapiSource,
  getEndpointsBySource,
} from '@/lib/queries/openapi'

/**
 * GET /api/openapi/[id]/endpoints — List parsed endpoints for a source.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('viewer')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params
  const source = await getOpenapiSource(id)

  if (!source || source.workspaceId !== ctx.workspaceId) {
    return notFound()
  }

  const endpoints = await getEndpointsBySource(id)

  return NextResponse.json({
    sourceId: id,
    sourceName: source.name,
    endpointCount: endpoints.length,
    endpoints,
  })
}

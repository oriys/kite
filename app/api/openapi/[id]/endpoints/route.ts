import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { parseOpenAPISpec } from '@/lib/openapi/parser'
import {
  getOpenapiSourceWithContent,
  getEndpointsBySource,
  replaceOpenapiSourceEndpoints,
} from '@/lib/queries/openapi'
import { logServerError } from '@/lib/server-errors'

/**
 * GET /api/openapi/[id]/endpoints — List parsed endpoints for a source.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params
  const source = await getOpenapiSourceWithContent(ctx.workspaceId, id)

  if (!source) {
    return notFound()
  }

  let endpoints = await getEndpointsBySource(ctx.workspaceId, id)

  if (endpoints.length === 0) {
    try {
      const spec = await parseOpenAPISpec(source.rawContent)
      endpoints = await replaceOpenapiSourceEndpoints(ctx.workspaceId, id, spec.endpoints)
    } catch (error) {
      logServerError('Failed to hydrate OpenAPI endpoints from stored source.', error, {
        sourceId: id,
        workspaceId: ctx.workspaceId,
      })

      return NextResponse.json(
        { error: 'Failed to load OpenAPI endpoints' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({
    sourceId: id,
    sourceName: source.name,
    endpointCount: endpoints.length,
    endpoints,
  })
}

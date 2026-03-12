import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { parseOpenAPISpec, computeChecksum } from '@/lib/openapi/parser'
import {
  createOpenapiSource,
  listOpenapiSources,
} from '@/lib/queries/openapi'

/**
 * POST /api/openapi — Create a new OpenAPI source (upload or URL).
 */
export async function POST(req: NextRequest) {
  const authResult = await withWorkspaceAuth('editor')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { name, rawContent, sourceUrl } = body as {
    name?: string
    rawContent?: string
    sourceUrl?: string
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return badRequest('name is required')
  }

  let content: string

  if (sourceUrl && typeof sourceUrl === 'string') {
    // Fetch content from URL
    try {
      const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) {
        return badRequest(`Failed to fetch URL: ${res.status} ${res.statusText}`)
      }
      content = await res.text()
    } catch (err) {
      return badRequest(
        `Failed to fetch URL: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
    }
  } else if (rawContent && typeof rawContent === 'string') {
    content = rawContent
  } else {
    return badRequest('Either rawContent or sourceUrl is required')
  }

  // Parse and validate the spec
  let spec
  try {
    spec = await parseOpenAPISpec(content)
  } catch (err) {
    return badRequest(
      `Invalid OpenAPI spec: ${err instanceof Error ? err.message : 'Parse error'}`,
    )
  }

  const checksum = computeChecksum(content)

  const source = await createOpenapiSource({
    workspaceId: ctx.workspaceId,
    name: name.trim(),
    sourceType: sourceUrl ? 'url' : 'upload',
    sourceUrl: sourceUrl || null,
    rawContent: content,
    parsedVersion: spec.version,
    openapiVersion: spec.openapiVersion,
    checksum,
  })

  return NextResponse.json(
    {
      ...source,
      endpointCount: spec.endpoints.length,
      title: spec.title,
    },
    { status: 201 },
  )
}

/**
 * GET /api/openapi — List all OpenAPI sources for the workspace.
 */
export async function GET() {
  const authResult = await withWorkspaceAuth('viewer')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const sources = await listOpenapiSources(ctx.workspaceId)
  return NextResponse.json(sources)
}

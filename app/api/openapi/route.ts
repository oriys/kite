import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { parseOpenAPISpec, computeChecksum } from '@/lib/openapi/parser'
import {
  getOpenapiSpecTooLargeMessage,
  isOpenapiContentTooLarge,
  parseOpenapiCreateRequestPayload,
} from '@/lib/openapi/upload'
import {
  createOpenapiSource,
  listOpenapiSources,
} from '@/lib/queries/openapi'
import { fetchTextFromUrl, parsePublicHttpUrl } from '@/lib/outbound-http'

function serializeOpenapiSourceSummary(source: {
  id: string
  name: string
  sourceType: 'upload' | 'url'
  parsedVersion: string | null
  openapiVersion?: string | null
  createdAt: Date
  lastSyncedAt?: Date | null
}) {
  return {
    id: source.id,
    name: source.name,
    sourceType: source.sourceType,
    currentVersion: source.parsedVersion,
    parsedVersion: source.parsedVersion,
    openapiVersion: source.openapiVersion ?? null,
    createdAt: source.createdAt,
    lastSyncedAt: source.lastSyncedAt ?? null,
  }
}

function payloadTooLarge(message = getOpenapiSpecTooLargeMessage()) {
  return NextResponse.json({ error: message }, { status: 413 })
}

/**
 * POST /api/openapi — Create a new OpenAPI source (upload or URL).
 */
export async function POST(req: NextRequest) {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const body = await parseOpenapiCreateRequestPayload(req)
  if (!body) return badRequest('Invalid request payload')

  const { name, rawContent, sourceUrl } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return badRequest('name is required')
  }

  let content: string
  let normalizedSourceUrl: string | null = null

  if (sourceUrl && typeof sourceUrl === 'string') {
    try {
      const targetUrl = parsePublicHttpUrl(sourceUrl)
      normalizedSourceUrl = targetUrl.toString()
      content = await fetchTextFromUrl(targetUrl, { timeoutMs: 15_000 })
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : 'Failed to fetch URL')
    }
  } else if (rawContent && typeof rawContent === 'string') {
    content = rawContent
  } else {
    return badRequest('Either rawContent or sourceUrl is required')
  }

  if (isOpenapiContentTooLarge(content)) {
    return payloadTooLarge()
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
    sourceType: normalizedSourceUrl ? 'url' : 'upload',
    sourceUrl: normalizedSourceUrl,
    rawContent: content,
    parsedVersion: spec.version,
    openapiVersion: spec.openapiVersion,
    checksum,
  })

  return NextResponse.json(
    {
      ...serializeOpenapiSourceSummary(source),
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
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const sources = await listOpenapiSources(ctx.workspaceId)
  return NextResponse.json(sources.map((source) => serializeOpenapiSourceSummary(source)))
}

import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { recordDomainEvent } from '@/lib/observability/metrics'
import { withRouteObservability } from '@/lib/observability/route-handler'
import { parseOpenAPISpec, computeChecksum } from '@/lib/openapi/parser'
import { diffEndpoints } from '@/lib/openapi/differ'
import {
  getOpenapiSpecTooLargeMessage,
  isOpenapiContentTooLarge,
} from '@/lib/openapi/upload'
import {
  getOpenapiSourceWithContent,
  syncOpenapiSource,
} from '@/lib/queries/openapi'
import { fetchTextFromUrl, parsePublicHttpUrl } from '@/lib/outbound-http'
import { logServerError } from '@/lib/server-errors'

function serializeOpenapiSourceSummary(source: {
  id: string
  name: string
  sourceType: 'upload' | 'url'
  sourceUrl?: string | null
  parsedVersion: string | null
  openapiVersion?: string | null
  createdAt: Date
  lastSyncedAt?: Date | null
}) {
  return {
    id: source.id,
    name: source.name,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl ?? null,
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
 * POST /api/openapi/[id]/sync — Re-sync an OpenAPI source from its URL.
 * Compares checksums, saves a snapshot if changed, and returns the diff.
 */
async function syncOpenapiRoute(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params
  const source = await getOpenapiSourceWithContent(ctx.workspaceId, id)

  if (!source) {
    return notFound()
  }

  // Determine new content: from body or fetch from URL
  let newContent: string
  const body = await req.json().catch(() => null)

  if (body?.rawContent && typeof body.rawContent === 'string') {
    newContent = body.rawContent
  } else if (source.sourceType === 'url' && source.sourceUrl) {
    try {
      const targetUrl = parsePublicHttpUrl(source.sourceUrl)
      newContent = await fetchTextFromUrl(targetUrl, { timeoutMs: 15_000 })
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : 'Failed to fetch URL')
    }
  } else {
    return badRequest(
      'No sourceUrl configured and no rawContent provided. Supply rawContent in the request body.',
    )
  }

  if (isOpenapiContentTooLarge(newContent)) {
    return payloadTooLarge()
  }

  const newChecksum = computeChecksum(newContent)

  // If unchanged, skip sync
  if (newChecksum === source.checksum) {
    recordDomainEvent('openapi_sync', 'unchanged')
    return NextResponse.json({
      changed: false,
      message: 'Content unchanged since last sync',
    })
  }

  // Parse old spec for diffing
  let oldSpec
  try {
    oldSpec = await parseOpenAPISpec(source.rawContent)
  } catch {
    oldSpec = { endpoints: [] }
  }

  // Parse new spec to validate
  let newSpec
  try {
    newSpec = await parseOpenAPISpec(newContent)
  } catch (err) {
    return badRequest(
      `Invalid OpenAPI spec: ${err instanceof Error ? err.message : 'Parse error'}`,
    )
  }

  // Perform the sync (snapshot + update + re-extract endpoints)
  let updated: Awaited<ReturnType<typeof syncOpenapiSource>>['source']

  try {
    const syncResult = await syncOpenapiSource(ctx.workspaceId, id, newContent, newChecksum)
    updated = syncResult.source
  } catch (error) {
    logServerError('Failed to sync OpenAPI source.', error, {
      sourceId: id,
      workspaceId: ctx.workspaceId,
    })

    return NextResponse.json(
      { error: 'Failed to sync OpenAPI source' },
      { status: 500 },
    )
  }

  // Compute diff
  const diff = diffEndpoints(oldSpec.endpoints, newSpec.endpoints)

  recordDomainEvent('openapi_sync')
  return NextResponse.json({
    changed: true,
    source: serializeOpenapiSourceSummary(updated),
    diff,
    stats: {
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
      totalEndpoints: newSpec.endpoints.length,
    },
  })
}

export const POST = withRouteObservability(syncOpenapiRoute, {
  route: '/api/openapi/:id/sync',
})

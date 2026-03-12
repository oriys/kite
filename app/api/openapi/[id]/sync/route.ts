import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { parseOpenAPISpec, computeChecksum } from '@/lib/openapi/parser'
import { diffEndpoints } from '@/lib/openapi/differ'
import {
  getOpenapiSource,
  syncOpenapiSource,
} from '@/lib/queries/openapi'

/**
 * POST /api/openapi/[id]/sync — Re-sync an OpenAPI source from its URL.
 * Compares checksums, saves a snapshot if changed, and returns the diff.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('editor')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params
  const source = await getOpenapiSource(id)

  if (!source || source.workspaceId !== ctx.workspaceId) {
    return notFound()
  }

  // Determine new content: from body or fetch from URL
  let newContent: string
  const body = await req.json().catch(() => null)

  if (body?.rawContent && typeof body.rawContent === 'string') {
    newContent = body.rawContent
  } else if (source.sourceType === 'url' && source.sourceUrl) {
    try {
      const res = await fetch(source.sourceUrl, {
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        return badRequest(`Failed to fetch URL: ${res.status} ${res.statusText}`)
      }
      newContent = await res.text()
    } catch (err) {
      return badRequest(
        `Failed to fetch URL: ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
    }
  } else {
    return badRequest(
      'No sourceUrl configured and no rawContent provided. Supply rawContent in the request body.',
    )
  }

  const newChecksum = computeChecksum(newContent)

  // If unchanged, skip sync
  if (newChecksum === source.checksum) {
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
  const { source: updated } = await syncOpenapiSource(id, newContent, newChecksum)

  // Compute diff
  const diff = diffEndpoints(oldSpec.endpoints, newSpec.endpoints)

  return NextResponse.json({
    changed: true,
    source: updated,
    diff,
    stats: {
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
      totalEndpoints: newSpec.endpoints.length,
    },
  })
}

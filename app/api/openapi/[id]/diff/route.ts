import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound, badRequest } from '@/lib/api-utils'
import { parseOpenAPISpec } from '@/lib/openapi/parser'
import { diffEndpoints } from '@/lib/openapi/differ'
import {
  getOpenapiSource,
  getLatestSnapshot,
} from '@/lib/queries/openapi'

/**
 * GET /api/openapi/[id]/diff — Get diff between current spec and latest snapshot.
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

  const snapshot = await getLatestSnapshot(id)

  if (!snapshot) {
    return badRequest('No previous snapshot available for comparison')
  }

  let oldSpec
  try {
    oldSpec = await parseOpenAPISpec(snapshot.rawContent)
  } catch {
    return badRequest('Failed to parse previous snapshot')
  }

  let currentSpec
  try {
    currentSpec = await parseOpenAPISpec(source.rawContent)
  } catch {
    return badRequest('Failed to parse current spec')
  }

  const diff = diffEndpoints(oldSpec.endpoints, currentSpec.endpoints)

  return NextResponse.json({
    diff,
    stats: {
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
    },
    snapshotAt: snapshot.snapshotAt,
    currentVersion: source.parsedVersion,
    snapshotVersion: snapshot.parsedVersion,
  })
}

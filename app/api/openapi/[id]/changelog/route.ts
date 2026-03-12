import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, desc, and } from 'drizzle-orm'
import { withWorkspaceAuth, notFound, badRequest } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { openapiSources, openapiSnapshots, documents } from '@/lib/schema'
import { parseOpenAPISpec } from '@/lib/openapi/parser'
import { diffEndpoints } from '@/lib/openapi/differ'
import {
  generateChangelog,
  type ChangelogInput,
  type EndpointChange,
} from '@/lib/openapi/changelog-generator'

function toEndpointChange(ep: {
  path: string
  method: string
  summary?: string | null
  changes?: { field: string; from: unknown; to: unknown }[]
}): EndpointChange {
  return {
    path: ep.path,
    method: ep.method,
    summary: ep.summary ?? undefined,
    changes: ep.changes,
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const { id } = await context.params

  // Fetch the OpenAPI source
  const source = await db.query.openapiSources.findFirst({
    where: and(
      eq(openapiSources.id, id),
      eq(openapiSources.workspaceId, result.ctx.workspaceId),
    ),
  })
  if (!source) return notFound()

  // Get the latest snapshot to compare against
  const snapshot = await db.query.openapiSnapshots.findFirst({
    where: eq(openapiSnapshots.sourceId, id),
    orderBy: [desc(openapiSnapshots.snapshotAt)],
  })
  if (!snapshot) return badRequest('No previous snapshot to compare against')

  // Parse both current and snapshot specs
  const currentSpec = await parseOpenAPISpec(source.rawContent)
  const previousSpec = await parseOpenAPISpec(snapshot.rawContent)

  // Diff the endpoints
  const diff = diffEndpoints(previousSpec.endpoints, currentSpec.endpoints)

  // Generate changelog
  const changelogInput: ChangelogInput = {
    version: source.parsedVersion ?? 'current',
    previousVersion: snapshot.parsedVersion ?? 'previous',
    added: diff.added.map(toEndpointChange),
    removed: diff.removed.map(toEndpointChange),
    changed: diff.changed.map(toEndpointChange),
    generatedAt: new Date(),
  }
  const markdown = generateChangelog(changelogInput)

  // Optionally create a document
  const { searchParams } = request.nextUrl
  let documentId: string | null = null

  if (searchParams.get('createDoc') === 'true') {
    const title = `Changelog — ${changelogInput.version} (${new Date().toISOString().split('T')[0]})`
    const [doc] = await db
      .insert(documents)
      .values({
        workspaceId: result.ctx.workspaceId,
        title,
        content: markdown,
        createdBy: result.ctx.userId,
      })
      .returning()
    documentId = doc.id
  }

  return NextResponse.json({
    markdown,
    summary: {
      added: diff.added.length,
      changed: diff.changed.length,
      removed: diff.removed.length,
    },
    documentId,
  })
}

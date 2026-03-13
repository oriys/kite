import { db } from '@/lib/db'
import {
  openapiSources,
  openapiSnapshots,
  apiEndpoints,
} from '@/lib/schema'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { parseOpenAPISpec } from '@/lib/openapi/parser'
import type { ParsedEndpoint } from '@/lib/openapi/parser'

type NewOpenapiSource = typeof openapiSources.$inferInsert
type OpenapiSource = typeof openapiSources.$inferSelect

export async function createOpenapiSource(
  data: Omit<NewOpenapiSource, 'id' | 'createdAt' | 'lastSyncedAt'>,
): Promise<OpenapiSource> {
  const [source] = await db
    .insert(openapiSources)
    .values(data)
    .returning()
  return source
}

export async function getOpenapiSource(id: string) {
  return db.query.openapiSources.findFirst({
    where: and(eq(openapiSources.id, id), isNull(openapiSources.deletedAt)),
    with: {
      snapshots: {
        orderBy: [desc(openapiSnapshots.snapshotAt)],
        limit: 5,
      },
    },
  })
}

export async function listOpenapiSources(workspaceId: string) {
  return db.query.openapiSources.findMany({
    where: and(
      eq(openapiSources.workspaceId, workspaceId),
      isNull(openapiSources.deletedAt),
    ),
    orderBy: [desc(openapiSources.createdAt)],
  })
}

/**
 * Re-sync an OpenAPI source: snapshot the old version, update content,
 * and re-extract endpoints — all inside a transaction.
 */
export async function syncOpenapiSource(
  id: string,
  newContent: string,
  checksum: string,
) {
  return db.transaction(async (tx) => {
    // Fetch current source
    const [current] = await tx
      .select()
      .from(openapiSources)
      .where(and(eq(openapiSources.id, id), isNull(openapiSources.deletedAt)))

    if (!current) throw new Error('Source not found')

    // Save current state as a snapshot
    await tx.insert(openapiSnapshots).values({
      sourceId: id,
      rawContent: current.rawContent,
      parsedVersion: current.parsedVersion,
      checksum: current.checksum,
    })

    // Parse the new spec
    const spec = await parseOpenAPISpec(newContent)

    // Update the source
    await tx
      .update(openapiSources)
      .set({
        rawContent: newContent,
        checksum,
        parsedVersion: spec.version,
        openapiVersion: spec.openapiVersion,
        lastSyncedAt: new Date(),
      })
      .where(eq(openapiSources.id, id))

    // Replace endpoints: delete old, insert new
    await tx
      .delete(apiEndpoints)
      .where(eq(apiEndpoints.sourceId, id))

    if (spec.endpoints.length > 0) {
      await tx.insert(apiEndpoints).values(
        spec.endpoints.map((ep: ParsedEndpoint) => ({
          sourceId: id,
          path: ep.path,
          method: ep.method,
          operationId: ep.operationId ?? null,
          summary: ep.summary ?? null,
          description: ep.description ?? null,
          tags: ep.tags,
          parameters: ep.parameters,
          requestBody: ep.requestBody,
          responses: ep.responses,
          deprecated: ep.deprecated,
        })),
      )
    }

    // Fetch and return updated source
    const [updated] = await tx
      .select()
      .from(openapiSources)
      .where(and(eq(openapiSources.id, id), isNull(openapiSources.deletedAt)))

    return { source: updated, spec }
  })
}

export async function deleteOpenapiSource(id: string) {
  const result = await db
    .update(openapiSources)
    .set({ deletedAt: new Date() })
    .where(and(eq(openapiSources.id, id), isNull(openapiSources.deletedAt)))
    .returning()
  return result.length > 0
}

export async function getEndpointsBySource(sourceId: string) {
  const source = await db.query.openapiSources.findFirst({
    where: and(eq(openapiSources.id, sourceId), isNull(openapiSources.deletedAt)),
  })
  if (!source) return []

  return db.query.apiEndpoints.findMany({
    where: eq(apiEndpoints.sourceId, sourceId),
    orderBy: [apiEndpoints.path, apiEndpoints.method],
  })
}

export async function getLatestSnapshot(sourceId: string) {
  const source = await db.query.openapiSources.findFirst({
    where: and(eq(openapiSources.id, sourceId), isNull(openapiSources.deletedAt)),
  })
  if (!source) return null

  return db.query.openapiSnapshots.findFirst({
    where: eq(openapiSnapshots.sourceId, sourceId),
    orderBy: [desc(openapiSnapshots.snapshotAt)],
  })
}

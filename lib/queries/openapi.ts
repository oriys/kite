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
type NewApiEndpoint = typeof apiEndpoints.$inferInsert

function buildApiEndpointValues(
  sourceId: string,
  endpoints: ParsedEndpoint[],
): NewApiEndpoint[] {
  return endpoints.map((ep) => ({
    sourceId,
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
  }))
}

async function hasOpenapiSource(workspaceId: string, id: string) {
  const [source] = await db
    .select({ id: openapiSources.id })
    .from(openapiSources)
    .where(and(
      eq(openapiSources.id, id),
      eq(openapiSources.workspaceId, workspaceId),
      isNull(openapiSources.deletedAt),
    ))
    .limit(1)

  return Boolean(source)
}

export async function createOpenapiSource(
  data: Omit<NewOpenapiSource, 'id' | 'createdAt' | 'lastSyncedAt'>,
  endpoints: ParsedEndpoint[] = [],
): Promise<OpenapiSource> {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .insert(openapiSources)
      .values(data)
      .returning()

    if (endpoints.length > 0) {
      await tx.insert(apiEndpoints).values(buildApiEndpointValues(source.id, endpoints))
    }

    return source
  })
}

export async function getOpenapiSource(workspaceId: string, id: string) {
  return db.query.openapiSources.findFirst({
    where: and(
      eq(openapiSources.id, id),
      eq(openapiSources.workspaceId, workspaceId),
      isNull(openapiSources.deletedAt),
    ),
    columns: {
      id: true,
      workspaceId: true,
      name: true,
      sourceType: true,
      sourceUrl: true,
      parsedVersion: true,
      openapiVersion: true,
      lastSyncedAt: true,
      createdAt: true,
    },
    with: {
      snapshots: {
        orderBy: [desc(openapiSnapshots.snapshotAt)],
        limit: 5,
        columns: {
          id: true,
          sourceId: true,
          parsedVersion: true,
          checksum: true,
          snapshotAt: true,
        },
      },
    },
  })
}

export async function getOpenapiSourceWithContent(workspaceId: string, id: string) {
  return db.query.openapiSources.findFirst({
    where: and(
      eq(openapiSources.id, id),
      eq(openapiSources.workspaceId, workspaceId),
      isNull(openapiSources.deletedAt),
    ),
  })
}

export async function listOpenapiSources(workspaceId: string) {
  return db
    .select({
      id: openapiSources.id,
      name: openapiSources.name,
      sourceType: openapiSources.sourceType,
      sourceUrl: openapiSources.sourceUrl,
      parsedVersion: openapiSources.parsedVersion,
      openapiVersion: openapiSources.openapiVersion,
      createdAt: openapiSources.createdAt,
      lastSyncedAt: openapiSources.lastSyncedAt,
    })
    .from(openapiSources)
    .where(
      and(
        eq(openapiSources.workspaceId, workspaceId),
        isNull(openapiSources.deletedAt),
      ),
    )
    .orderBy(desc(openapiSources.createdAt))
}

/**
 * Re-sync an OpenAPI source: snapshot the old version, update content,
 * and re-extract endpoints — all inside a transaction.
 */
export async function syncOpenapiSource(
  workspaceId: string,
  id: string,
  newContent: string,
  checksum: string,
) {
  return db.transaction(async (tx) => {
    // Fetch current source, scoped to workspace
    const [current] = await tx
      .select()
      .from(openapiSources)
      .where(and(
        eq(openapiSources.id, id),
        eq(openapiSources.workspaceId, workspaceId),
        isNull(openapiSources.deletedAt),
      ))

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
      await tx
        .insert(apiEndpoints)
        .values(buildApiEndpointValues(id, spec.endpoints))
    }

    // Fetch and return updated source
    const [updated] = await tx
      .select()
      .from(openapiSources)
      .where(and(eq(openapiSources.id, id), isNull(openapiSources.deletedAt)))

    return { source: updated, spec }
  })
}

export async function deleteOpenapiSource(workspaceId: string, id: string) {
  const result = await db
    .update(openapiSources)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(openapiSources.id, id),
      eq(openapiSources.workspaceId, workspaceId),
      isNull(openapiSources.deletedAt),
    ))
    .returning()
  return result.length > 0
}

export async function getEndpointsBySource(workspaceId: string, sourceId: string) {
  if (!(await hasOpenapiSource(workspaceId, sourceId))) return []

  return db.query.apiEndpoints.findMany({
    where: eq(apiEndpoints.sourceId, sourceId),
    orderBy: [apiEndpoints.path, apiEndpoints.method],
  })
}

export async function replaceOpenapiSourceEndpoints(
  workspaceId: string,
  sourceId: string,
  endpoints: ParsedEndpoint[],
) {
  if (!(await hasOpenapiSource(workspaceId, sourceId))) return []

  return db.transaction(async (tx) => {
    await tx
      .delete(apiEndpoints)
      .where(eq(apiEndpoints.sourceId, sourceId))

    if (endpoints.length > 0) {
      await tx.insert(apiEndpoints).values(buildApiEndpointValues(sourceId, endpoints))
    }

    return tx.query.apiEndpoints.findMany({
      where: eq(apiEndpoints.sourceId, sourceId),
      orderBy: [apiEndpoints.path, apiEndpoints.method],
    })
  })
}

export async function getLatestSnapshot(workspaceId: string, sourceId: string) {
  if (!(await hasOpenapiSource(workspaceId, sourceId))) return null

  return db.query.openapiSnapshots.findFirst({
    where: eq(openapiSnapshots.sourceId, sourceId),
    orderBy: [desc(openapiSnapshots.snapshotAt)],
  })
}

import { eq, and, asc, ne, isNull } from 'drizzle-orm'
import { db } from '../db'
import { apiVersions, documents } from '../schema'

export async function listApiVersions(workspaceId: string) {
  return db.query.apiVersions.findMany({
    where: and(eq(apiVersions.workspaceId, workspaceId), isNull(apiVersions.deletedAt)),
    orderBy: [asc(apiVersions.sortOrder), asc(apiVersions.createdAt)],
  })
}

export async function getApiVersion(id: string) {
  const version = await db.query.apiVersions.findFirst({
    where: and(eq(apiVersions.id, id), isNull(apiVersions.deletedAt)),
  })
  return version ?? null
}

export async function createApiVersion(data: {
  workspaceId: string
  label: string
  slug: string
  baseUrl?: string
  status?: 'active' | 'beta' | 'deprecated' | 'retired'
}) {
  const [version] = await db
    .insert(apiVersions)
    .values({
      workspaceId: data.workspaceId,
      label: data.label,
      slug: data.slug,
      baseUrl: data.baseUrl,
      status: data.status ?? 'active',
    })
    .returning()

  return version
}

export async function updateApiVersion(
  id: string,
  data: Partial<{
    label: string
    slug: string
    baseUrl: string
    status: 'active' | 'beta' | 'deprecated' | 'retired'
    isDefault: boolean
    sortOrder: number
  }>,
) {
  const [updated] = await db
    .update(apiVersions)
    .set(data)
    .where(and(eq(apiVersions.id, id), isNull(apiVersions.deletedAt)))
    .returning()

  return updated ?? null
}

export async function deleteApiVersion(id: string) {
  const result = await db
    .update(apiVersions)
    .set({ deletedAt: new Date() })
    .where(and(eq(apiVersions.id, id), isNull(apiVersions.deletedAt)))
    .returning()

  return result.length > 0
}

export async function setDefaultVersion(
  workspaceId: string,
  versionId: string,
) {
  return db.transaction(async (tx) => {
    await tx
      .update(apiVersions)
      .set({ isDefault: false })
      .where(
        and(
          eq(apiVersions.workspaceId, workspaceId),
          ne(apiVersions.id, versionId),
          isNull(apiVersions.deletedAt),
        ),
      )

    const [updated] = await tx
      .update(apiVersions)
      .set({ isDefault: true })
      .where(
        and(
          eq(apiVersions.id, versionId),
          eq(apiVersions.workspaceId, workspaceId),
          isNull(apiVersions.deletedAt),
        ),
      )
      .returning()

    return updated ?? null
  })
}

export async function cloneVersionDocuments(
  sourceVersionId: string,
  targetVersionId: string,
  workspaceId: string,
) {
  const sourceDocs = await db.query.documents.findMany({
    where: and(
      eq(documents.apiVersionId, sourceVersionId),
      eq(documents.workspaceId, workspaceId),
      isNull(documents.deletedAt),
    ),
  })

  if (sourceDocs.length === 0) return []

  const cloned = await db
    .insert(documents)
    .values(
      sourceDocs.map((doc) => ({
        workspaceId: doc.workspaceId,
        title: doc.title,
        content: doc.content,
        summary: doc.summary,
        status: doc.status,
        visibility: doc.visibility,
        apiVersionId: targetVersionId,
        createdBy: doc.createdBy,
      })),
    )
    .returning()

  return cloned
}

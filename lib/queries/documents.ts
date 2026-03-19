import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'

import { db } from '../db'
import { rebuildWorkspaceDocumentRelations } from '../document-relations'
import {
  MAX_DOCUMENT_SLUG_LENGTH,
  normalizeDocumentSlug,
  normalizeDocumentTags,
  type DocumentSort,
} from '../documents'
import {
  documents,
  documentVersions,
  publishedSnapshots,
  type docStatusEnum,
  type visibilityEnum,
} from '../schema'
import { logServerError } from '../server-errors'
import { wordCount } from '../utils'
import { verifyWorkspaceMembership } from './workspaces'

type DocStatusValue = (typeof docStatusEnum.enumValues)[number]
type VisibilityValue = (typeof visibilityEnum.enumValues)[number]

interface ImportDocumentVersionInput {
  content: string
  savedAt?: string
  wordCount?: number
}

interface ImportDocumentInput {
  title: string
  slug?: string
  content: string
  summary?: string
  category?: string
  tags?: string[]
  status?: DocStatusValue
  createdAt?: string
  updatedAt?: string
  versions?: ImportDocumentVersionInput[]
}

async function refreshWorkspaceRelationsAfterMutation(
  workspaceId: string,
  mutation: string,
) {
  try {
    await rebuildWorkspaceDocumentRelations(workspaceId)
  } catch (error) {
    logServerError('Failed to rebuild document relations after document mutation.', error, {
      workspaceId,
      mutation,
    })
  }
}

function buildDocumentSlugCandidate(baseSlug: string, suffix: number) {
  if (suffix <= 1) {
    return baseSlug
  }

  const suffixToken = `-${suffix}`
  const maxBaseLength = Math.max(1, MAX_DOCUMENT_SLUG_LENGTH - suffixToken.length)
  const trimmedBase = baseSlug.slice(0, maxBaseLength).replace(/-+$/g, '') || 'document'
  return `${trimmedBase}${suffixToken}`
}

export async function createDocumentSlugAllocator(
  workspaceId: string,
  options: {
    excludeDocumentId?: string
  } = {},
) {
  const filters: SQL<unknown>[] = [
    eq(documents.workspaceId, workspaceId),
    isNull(documents.deletedAt),
    isNotNull(documents.slug),
  ]

  if (options.excludeDocumentId) {
    filters.push(ne(documents.id, options.excludeDocumentId))
  }

  const rows = await db
    .select({ slug: documents.slug })
    .from(documents)
    .where(and(...filters))

  const usedSlugs = new Set(
    rows
      .map((row) => row.slug)
      .filter((slug): slug is string => Boolean(slug)),
  )

  return (value: string) => {
    const baseSlug = normalizeDocumentSlug(value)
    let suffix = 1
    let candidate = baseSlug

    while (usedSlugs.has(candidate)) {
      suffix += 1
      candidate = buildDocumentSlugCandidate(baseSlug, suffix)
    }

    usedSlugs.add(candidate)
    return candidate
  }
}

export async function listDocuments(
  workspaceId: string,
  apiVersionId?: string,
  searchQuery?: string,
  sort: DocumentSort = 'updated_desc',
) {
  const conditions: SQL<unknown>[] = [
    eq(documents.workspaceId, workspaceId),
    isNull(documents.deletedAt),
  ]
  if (apiVersionId) {
    conditions.push(eq(documents.apiVersionId, apiVersionId))
  }
  if (searchQuery?.trim()) {
    const pattern = `%${searchQuery.trim()}%`
    conditions.push(
      or(
        ilike(documents.title, pattern),
        ilike(documents.summary, pattern),
        ilike(documents.content, pattern),
        sql<boolean>`exists (
          select 1
          from unnest(${documents.tags}) as document_tag(tag)
          where tag ilike ${pattern}
        )`,
      )!,
    )
  }

  const orderBy = (() => {
    switch (sort) {
      case 'updated_asc':
        return [asc(documents.updatedAt), asc(documents.title)]
      case 'created_desc':
        return [desc(documents.createdAt), asc(documents.title)]
      case 'created_asc':
        return [asc(documents.createdAt), asc(documents.title)]
      case 'title_asc':
        return [asc(documents.title), desc(documents.updatedAt)]
      case 'title_desc':
        return [desc(documents.title), desc(documents.updatedAt)]
      case 'updated_desc':
      default:
        return [desc(documents.updatedAt), asc(documents.title)]
    }
  })()

  return db
    .select({
      id: documents.id,
      title: documents.title,
      slug: documents.slug,
      category: documents.category,
      tags: documents.tags,
      content: sql<string>`''`,
      summary: documents.summary,
      preview:
        sql<string>`coalesce(nullif(${documents.summary}, ''), left(${documents.content}, 240))`,
      status: documents.status,
      visibility: documents.visibility,
      locale: documents.locale,
      apiVersionId: documents.apiVersionId,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      workspaceId: documents.workspaceId,
      createdBy: documents.createdBy,
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(...orderBy)
}

async function loadDocument(where: SQL<unknown>) {
  const doc = await db.query.documents.findFirst({
    where,
    with: {
      versions: {
        orderBy: [desc(documentVersions.savedAt)],
        limit: 6,
      },
    },
  })

  if (!doc) return null

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, doc.id))

  return {
    ...doc,
    versionCount: Number(count),
  }
}

export async function getDocument(id: string, workspaceId: string) {
  return loadDocument(
    and(
      eq(documents.id, id),
      eq(documents.workspaceId, workspaceId),
      isNull(documents.deletedAt),
    )!,
  )
}

export async function getDocumentBySlug(slug: string, workspaceId: string) {
  return loadDocument(
    and(
      eq(documents.slug, slug),
      eq(documents.workspaceId, workspaceId),
      isNull(documents.deletedAt),
    )!,
  )
}

export async function getDocumentByIdentifier(identifier: string, workspaceId: string) {
  return (await getDocument(identifier, workspaceId))
    ?? (await getDocumentBySlug(identifier, workspaceId))
}

export async function createDocument(
  workspaceId: string,
  title: string,
  content: string,
  createdBy: string,
  summary = '',
  category = '',
  tags: readonly string[] = [],
) {
  const allocateSlug = await createDocumentSlugAllocator(workspaceId)
  const [doc] = await db
    .insert(documents)
    .values({
      workspaceId,
        title,
        slug: allocateSlug(title),
        category,
        tags: normalizeDocumentTags(tags),
        content,
        summary,
        createdBy,
    })
    .returning()

  await refreshWorkspaceRelationsAfterMutation(workspaceId, 'createDocument')

  return { ...doc, versions: [] }
}

export async function importDocuments(
  workspaceId: string,
  createdBy: string,
  sourceDocs: ImportDocumentInput[],
) {
  if (sourceDocs.length === 0) return []

  const allocateSlug = await createDocumentSlugAllocator(workspaceId)
  const inserted = await db.transaction(async (tx) => {
    const docValues = sourceDocs.map((sourceDoc) => {
      const createdAt = sourceDoc.createdAt ? new Date(sourceDoc.createdAt) : new Date()
      const updatedAt = sourceDoc.updatedAt ? new Date(sourceDoc.updatedAt) : createdAt

      return {
        workspaceId,
        title: sourceDoc.title,
        slug: allocateSlug(sourceDoc.slug?.trim() || sourceDoc.title),
        category: sourceDoc.category ?? '',
        content: sourceDoc.content,
        summary: sourceDoc.summary ?? '',
        tags: normalizeDocumentTags(sourceDoc.tags),
        status: (sourceDoc.status ?? 'draft') as DocStatusValue,
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
        createdBy,
      }
    })

    const inserted = await tx.insert(documents).values(docValues).returning()

    const allVersionValues: {
      documentId: string
      content: string
      wordCount: number
      savedAt: Date
    }[] = []

    for (let i = 0; i < inserted.length; i += 1) {
      const versions = sourceDocs[i].versions ?? []
      for (const version of versions) {
        const savedAt = version.savedAt ? new Date(version.savedAt) : new Date()
        allVersionValues.push({
          documentId: inserted[i].id,
          content: version.content,
          wordCount:
            typeof version.wordCount === 'number'
              ? version.wordCount
              : wordCount(version.content),
          savedAt: Number.isNaN(savedAt.getTime()) ? new Date() : savedAt,
        })
      }
    }

    if (allVersionValues.length > 0) {
      await tx.insert(documentVersions).values(allVersionValues)
    }

    return inserted.map((doc) => ({ ...doc, versions: [] }))
  })

  await refreshWorkspaceRelationsAfterMutation(workspaceId, 'importDocuments')

  return inserted
}

export async function updateDocument(
  id: string,
  workspaceId: string,
  patch: {
    title?: string
    slug?: string
    category?: string
    tags?: string[]
    content?: string
    visibility?: VisibilityValue
  },
) {
  const [existing] = await db
    .select({
      content: documents.content,
      title: documents.title,
      slug: documents.slug,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.workspaceId, workspaceId),
        isNull(documents.deletedAt),
      ),
    )
    .limit(1)

  if (!existing) return null

  const nextSlug =
    patch.slug !== undefined || !existing.slug
      ? (
          await createDocumentSlugAllocator(workspaceId, {
            excludeDocumentId: id,
          })
        )(patch.slug?.trim() || patch.title || existing.title)
      : undefined

  if (patch.content !== undefined && patch.content !== existing.content) {
    await db.insert(documentVersions).values({
      documentId: id,
      content: existing.content,
      wordCount: wordCount(existing.content),
    })

    const keepIds = db
      .select({ id: documentVersions.id })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, id))
      .orderBy(desc(documentVersions.savedAt))
      .limit(50)

    await db
      .delete(documentVersions)
      .where(
        and(
          eq(documentVersions.documentId, id),
          notInArray(documentVersions.id, sql`(${keepIds})`),
        ),
      )
  }

  const documentPatch: {
    title?: string
    category?: string
    tags?: string[]
    content?: string
    visibility?: VisibilityValue
  } = { ...patch }
  if (patch.tags !== undefined) {
    documentPatch.tags = normalizeDocumentTags(patch.tags)
  }
  const [updated] = await db
    .update(documents)
    .set({
      ...documentPatch,
      ...(nextSlug ? { slug: nextSlug } : {}),
      ...(patch.content !== undefined && patch.content !== existing.content
        ? { summary: '' }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documents.id, id),
        eq(documents.workspaceId, workspaceId),
        isNull(documents.deletedAt),
      ),
    )
    .returning()

  if (!updated) return null

  if (patch.content !== undefined || patch.title !== undefined) {
    await refreshWorkspaceRelationsAfterMutation(workspaceId, 'updateDocument')
  }

  return await getDocument(id, workspaceId)
}

export async function transitionDocument(
  id: string,
  workspaceId: string,
  newStatus: DocStatusValue,
  actorId?: string,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.workspaceId, workspaceId),
          isNull(documents.deletedAt),
        ),
      )
      .limit(1)

    if (!existing) return null

    const previousStatus = existing.status as string

    const [updated] = await tx
      .update(documents)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(
        and(
          eq(documents.id, id),
          eq(documents.workspaceId, workspaceId),
          isNull(documents.deletedAt),
        ),
      )
      .returning()

    if (!updated) return null

    if (newStatus === 'published') {
      // Deactivate any existing active snapshot
      await tx
        .update(publishedSnapshots)
        .set({ isActive: false })
        .where(
          and(
            eq(publishedSnapshots.documentId, id),
            eq(publishedSnapshots.isActive, true),
          ),
        )

      // Compute next version number
      const [maxVersion] = await tx
        .select({ max: sql<number>`coalesce(max(${publishedSnapshots.version}), 0)` })
        .from(publishedSnapshots)
        .where(eq(publishedSnapshots.documentId, id))

      // Create new active snapshot
      await tx.insert(publishedSnapshots).values({
        workspaceId,
        documentId: id,
        version: (maxVersion?.max ?? 0) + 1,
        title: existing.title,
        slug: existing.slug,
        publishedSlug: existing.publishedSlug,
        content: existing.content,
        summary: existing.summary,
        category: existing.category,
        tags: existing.tags,
        locale: existing.locale,
        navSection: existing.navSection,
        publishOrder: existing.publishOrder,
        visibility: existing.visibility,
        publishedBy: actorId ?? null,
        isActive: true,
      })
    } else if (previousStatus === 'published') {
      // Deactivate active snapshot when leaving published state
      await tx
        .update(publishedSnapshots)
        .set({ isActive: false })
        .where(
          and(
            eq(publishedSnapshots.documentId, id),
            eq(publishedSnapshots.isActive, true),
          ),
        )
    }

    return updated
  }).then(async (updated) => {
    if (!updated) return null
    return getDocument(id, workspaceId)
  })
}

export async function deleteDocument(id: string, workspaceId: string, actorId?: string) {
  const result = await db
    .update(documents)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(documents.id, id),
        eq(documents.workspaceId, workspaceId),
        isNull(documents.deletedAt),
      ),
    )
    .returning()

  if (result.length > 0) {
    await refreshWorkspaceRelationsAfterMutation(workspaceId, 'deleteDocument')

    if (actorId) {
      const { emitAuditEvent } = await import('./audit-logs')
      emitAuditEvent({
        workspaceId,
        actorId,
        action: 'delete',
        resourceType: 'document',
        resourceId: id,
        resourceTitle: result[0].title,
      }).catch(() => {})
    }
  }

  return result.length > 0
}

export async function duplicateDocument(
  id: string,
  workspaceId: string,
  userId: string,
) {
  const source = await getDocument(id, workspaceId)
  if (!source) return null

  return createDocument(
    workspaceId,
    `${source.title} (copy)`,
    source.content,
    userId,
    source.summary,
    source.category,
    source.tags,
  )
}

export async function updateDocumentSummary(
  id: string,
  workspaceId: string,
  summary: string,
) {
  const [updated] = await db
    .update(documents)
    .set({ summary })
    .where(
      and(
        eq(documents.id, id),
        eq(documents.workspaceId, workspaceId),
        isNull(documents.deletedAt),
      ),
    )
    .returning()

  return updated ? await getDocument(id, workspaceId) : null
}

export async function backfillMissingDocumentSlugs(input: {
  workspaceId?: string
} = {}) {
  const filters: SQL<unknown>[] = [
    isNull(documents.deletedAt),
    or(isNull(documents.slug), eq(documents.slug, ''))!,
  ]

  if (input.workspaceId) {
    filters.push(eq(documents.workspaceId, input.workspaceId))
  }

  const pendingDocuments = await db
    .select({
      id: documents.id,
      title: documents.title,
      workspaceId: documents.workspaceId,
    })
    .from(documents)
    .where(and(...filters))
    .orderBy(asc(documents.workspaceId), asc(documents.createdAt), asc(documents.id))

  if (pendingDocuments.length === 0) {
    return []
  }

  const allocators = new Map<
    string,
    Awaited<ReturnType<typeof createDocumentSlugAllocator>>
  >()
  const updates: Array<{ id: string; slug: string }> = []

  for (const document of pendingDocuments) {
    let allocateSlug = allocators.get(document.workspaceId)
    if (!allocateSlug) {
      allocateSlug = await createDocumentSlugAllocator(document.workspaceId)
      allocators.set(document.workspaceId, allocateSlug)
    }

    updates.push({
      id: document.id,
      slug: allocateSlug(document.title),
    })
  }

  for (const update of updates) {
    await db
      .update(documents)
      .set({ slug: update.slug })
      .where(eq(documents.id, update.id))
  }

  return updates
}

export async function updateDocumentSummaryIfUnchanged(
  id: string,
  workspaceId: string,
  input: {
    summary: string
    title?: string
  },
  expectedUpdatedAt: Date,
) {
  const patch = {
    summary: input.summary,
    ...(input.title ? { title: input.title } : {}),
  }

  const [updated] = await db
    .update(documents)
    .set(patch)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.workspaceId, workspaceId),
        eq(documents.updatedAt, expectedUpdatedAt),
        isNull(documents.deletedAt),
      ),
    )
    .returning()

  if (!updated) return null

  if (input.title) {
    await refreshWorkspaceRelationsAfterMutation(workspaceId, 'updateDocumentSummaryIfUnchanged')
  }

  return await getDocument(id, workspaceId)
}

export { verifyWorkspaceMembership }

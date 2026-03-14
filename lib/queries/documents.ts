import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNull,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { db } from '../db'
import { rebuildWorkspaceDocumentRelations } from '../document-relations'
import {
  documents,
  documentVersions,
  type docStatusEnum,
  type visibilityEnum,
} from '../schema'
import { logServerError } from '../server-errors'
import { verifyWorkspaceMembership } from './workspaces'
import { wordCount } from '../utils'
import type { DocumentSort } from '../documents'

type DocStatusValue = (typeof docStatusEnum.enumValues)[number]
type VisibilityValue = (typeof visibilityEnum.enumValues)[number]

interface ImportDocumentVersionInput {
  content: string
  savedAt?: string
  wordCount?: number
}

interface ImportDocumentInput {
  title: string
  content: string
  summary?: string
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
      category: documents.category,
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

export async function getDocument(id: string, workspaceId: string) {
  const doc = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, id),
      eq(documents.workspaceId, workspaceId),
      isNull(documents.deletedAt),
    ),
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
    .where(eq(documentVersions.documentId, id))

  return {
    ...doc,
    versionCount: Number(count),
  }
}

export async function createDocument(
  workspaceId: string,
  title: string,
  content: string,
  createdBy: string,
  summary = '',
  category = '',
) {
  const [doc] = await db
    .insert(documents)
    .values({ workspaceId, title, category, content, summary, createdBy })
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

  const inserted = await db.transaction(async (tx) => {
    const docValues = sourceDocs.map((sourceDoc) => {
      const createdAt = sourceDoc.createdAt ? new Date(sourceDoc.createdAt) : new Date()
      const updatedAt = sourceDoc.updatedAt ? new Date(sourceDoc.updatedAt) : createdAt

      return {
        workspaceId,
        title: sourceDoc.title,
        content: sourceDoc.content,
        summary: sourceDoc.summary ?? '',
        status: (sourceDoc.status ?? 'draft') as DocStatusValue,
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
        createdBy,
      }
    })

    const inserted = await tx.insert(documents).values(docValues).returning()

    // Collect all versions across all documents into a single batch
    const allVersionValues: {
      documentId: string
      content: string
      wordCount: number
      savedAt: Date
    }[] = []

    for (let i = 0; i < inserted.length; i++) {
      const versions = Array.isArray(sourceDocs[i].versions) ? sourceDocs[i].versions! : []
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
    category?: string
    content?: string
    visibility?: VisibilityValue
  },
) {
  // Light read: only fetch the content needed for version diffing
  const [existing] = await db
    .select({ content: documents.content })
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

  // Version the old content when content changes
  if (patch.content !== undefined && patch.content !== existing.content) {
    await db.insert(documentVersions).values({
      documentId: id,
      content: existing.content,
      wordCount: wordCount(existing.content),
    })

    // Keep last 50 versions — single SQL delete
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
          notInArray(documentVersions.id, sql`(${keepIds})`)
        )
      )
  }

  const [updated] = await db
    .update(documents)
    .set({
      ...patch,
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

  if (
    patch.content !== undefined ||
    patch.title !== undefined
  ) {
    await refreshWorkspaceRelationsAfterMutation(workspaceId, 'updateDocument')
  }

  return await getDocument(id, workspaceId)
}

export async function transitionDocument(
  id: string,
  workspaceId: string,
  newStatus: DocStatusValue,
) {
  const [updated] = await db
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

  return updated ? await getDocument(id, workspaceId) : null
}

export async function deleteDocument(id: string, workspaceId: string) {
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

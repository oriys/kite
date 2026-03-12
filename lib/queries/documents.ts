import { eq, and, desc, notInArray, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  documents,
  documentVersions,
  type docStatusEnum,
} from '../schema'
import { verifyWorkspaceMembership } from './workspaces'
import { wordCount } from '../utils'

type DocStatusValue = (typeof docStatusEnum.enumValues)[number]

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

export async function listDocuments(
  workspaceId: string,
  statusFilter?: DocStatusValue,
  limit = 100,
  offset = 0,
  apiVersionId?: string,
) {
  const conditions = [eq(documents.workspaceId, workspaceId)]
  if (statusFilter) {
    conditions.push(eq(documents.status, statusFilter))
  }
  if (apiVersionId) {
    conditions.push(eq(documents.apiVersionId, apiVersionId))
  }

  const docs = await db.query.documents.findMany({
    where: and(...conditions),
    orderBy: [desc(documents.updatedAt)],
    limit,
    offset,
    with: {
      versions: {
        orderBy: [desc(documentVersions.savedAt)],
      },
    },
  })

  return docs
}

export async function getDocument(id: string, workspaceId: string) {
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, id), eq(documents.workspaceId, workspaceId)),
    with: {
      versions: {
        orderBy: [desc(documentVersions.savedAt)],
      },
    },
  })

  return doc ?? null
}

export async function createDocument(
  workspaceId: string,
  title: string,
  content: string,
  createdBy: string,
  summary = '',
) {
  const [doc] = await db
    .insert(documents)
    .values({ workspaceId, title, content, summary, createdBy })
    .returning()

  return { ...doc, versions: [] }
}

export async function importDocuments(
  workspaceId: string,
  createdBy: string,
  sourceDocs: ImportDocumentInput[],
) {
  if (sourceDocs.length === 0) return []

  return db.transaction(async (tx) => {
    const imported = []

    for (const sourceDoc of sourceDocs) {
      const createdAt = sourceDoc.createdAt ? new Date(sourceDoc.createdAt) : new Date()
      const updatedAt = sourceDoc.updatedAt ? new Date(sourceDoc.updatedAt) : createdAt
      const status = sourceDoc.status ?? 'draft'

      const [doc] = await tx
        .insert(documents)
        .values({
          workspaceId,
          title: sourceDoc.title,
          content: sourceDoc.content,
          summary: sourceDoc.summary ?? '',
          status,
          createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
          updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
          createdBy,
        })
        .returning()

      const versions = Array.isArray(sourceDoc.versions) ? sourceDoc.versions : []
      if (versions.length > 0) {
        await tx.insert(documentVersions).values(
          versions.map((version) => {
            const savedAt = version.savedAt ? new Date(version.savedAt) : new Date()

            return {
              documentId: doc.id,
              content: version.content,
              wordCount:
                typeof version.wordCount === 'number'
                  ? version.wordCount
                  : wordCount(version.content),
              savedAt: Number.isNaN(savedAt.getTime()) ? new Date() : savedAt,
            }
          }),
        )
      }

      imported.push({ ...doc, versions: [] })
    }

    return imported
  })
}

export async function updateDocument(
  id: string,
  workspaceId: string,
  patch: { title?: string; content?: string },
) {
  const existing = await getDocument(id, workspaceId)
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
    .where(and(eq(documents.id, id), eq(documents.workspaceId, workspaceId)))
    .returning()

  return updated ? await getDocument(id, workspaceId) : null
}

export async function transitionDocument(
  id: string,
  workspaceId: string,
  newStatus: DocStatusValue,
) {
  const [updated] = await db
    .update(documents)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(and(eq(documents.id, id), eq(documents.workspaceId, workspaceId)))
    .returning()

  return updated ? await getDocument(id, workspaceId) : null
}

export async function deleteDocument(id: string, workspaceId: string) {
  const result = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.workspaceId, workspaceId)))
    .returning()

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
    .where(and(eq(documents.id, id), eq(documents.workspaceId, workspaceId)))
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
      ),
    )
    .returning()

  return updated ? await getDocument(id, workspaceId) : null
}

export { verifyWorkspaceMembership }

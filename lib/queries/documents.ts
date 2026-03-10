import { eq, and, desc, notInArray, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  documents,
  documentVersions,
  type docStatusEnum,
} from '../schema'
import { verifyWorkspaceMembership } from './workspaces'

type DocStatusValue = (typeof docStatusEnum.enumValues)[number]

function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const cjk = trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)?.length ?? 0
  const latin = trimmed
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, '')
    .split(/\s+/)
    .filter(Boolean).length
  return cjk + latin
}

export async function listDocuments(
  workspaceId: string,
  statusFilter?: DocStatusValue,
) {
  const conditions = [eq(documents.workspaceId, workspaceId)]
  if (statusFilter) {
    conditions.push(eq(documents.status, statusFilter))
  }

  const docs = await db.query.documents.findMany({
    where: and(...conditions),
    orderBy: [desc(documents.updatedAt)],
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
) {
  const [doc] = await db
    .insert(documents)
    .values({ workspaceId, title, content, createdBy })
    .returning()

  return { ...doc, versions: [] }
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
    .set({ ...patch, updatedAt: new Date() })
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
  )
}

export { verifyWorkspaceMembership }

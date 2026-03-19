import { eq, asc, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inlineComments } from '@/lib/schema'

export interface CommentWithAuthor {
  id: string
  documentId: string
  authorId: string
  authorName: string | null
  authorImage: string | null
  anchorType: string
  anchorFrom: number | null
  anchorTo: number | null
  anchorBlockId: string | null
  quotedText: string | null
  body: string
  parentId: string | null
  threadResolved: boolean
  resolvedBy: string | null
  resolvedAt: Date | null
  createdAt: Date
  replies: CommentWithAuthor[]
}

type CommentRow = typeof inlineComments.$inferSelect & {
  author: { name: string | null; image: string | null } | null
}

function toCommentWithAuthor(
  row: CommentRow,
  replies: CommentWithAuthor[] = [],
): CommentWithAuthor {
  return {
    id: row.id,
    documentId: row.documentId,
    authorId: row.authorId,
    authorName: row.author?.name ?? null,
    authorImage: row.author?.image ?? null,
    anchorType: row.anchorType,
    anchorFrom: row.anchorFrom,
    anchorTo: row.anchorTo,
    anchorBlockId: row.anchorBlockId,
    quotedText: row.quotedText,
    body: row.body,
    parentId: row.parentId,
    threadResolved: row.threadResolved,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    replies,
  }
}

export async function listDocumentComments(
  documentId: string,
): Promise<CommentWithAuthor[]> {
  const rows = await db.query.inlineComments.findMany({
    where: and(
      eq(inlineComments.documentId, documentId),
      isNull(inlineComments.deletedAt),
    ),
    orderBy: [asc(inlineComments.createdAt)],
    limit: 1000,
    with: {
      author: {
        columns: { name: true, image: true },
      },
    },
  })

  const topLevel: CommentRow[] = []
  const repliesByParent = new Map<string, CommentRow[]>()

  for (const row of rows) {
    if (row.parentId === null) {
      topLevel.push(row as CommentRow)
    } else {
      const list = repliesByParent.get(row.parentId) ?? []
      list.push(row as CommentRow)
      repliesByParent.set(row.parentId, list)
    }
  }

  return topLevel.map((row) => {
    const childRows = repliesByParent.get(row.id) ?? []
    const replies = childRows.map((r) => toCommentWithAuthor(r))
    return toCommentWithAuthor(row, replies)
  })
}

export async function createComment(data: {
  documentId: string
  authorId: string
  anchorType: string
  anchorFrom?: number
  anchorTo?: number
  anchorBlockId?: string
  quotedText?: string
  body: string
  parentId?: string
}): Promise<typeof inlineComments.$inferSelect> {
  const [comment] = await db
    .insert(inlineComments)
    .values({
      documentId: data.documentId,
      authorId: data.authorId,
      anchorType: data.anchorType,
      anchorFrom: data.anchorFrom ?? null,
      anchorTo: data.anchorTo ?? null,
      anchorBlockId: data.anchorBlockId ?? null,
      quotedText: data.quotedText ?? null,
      body: data.body,
      parentId: data.parentId ?? null,
    })
    .returning()

  return comment
}

export async function resolveThread(
  commentId: string,
  resolvedBy: string,
  documentId: string,
): Promise<void> {
  await db
    .update(inlineComments)
    .set({
      threadResolved: true,
      resolvedBy,
      resolvedAt: new Date(),
    })
    .where(and(eq(inlineComments.id, commentId), eq(inlineComments.documentId, documentId)))
}

export async function unresolveThread(commentId: string, documentId: string): Promise<void> {
  await db
    .update(inlineComments)
    .set({
      threadResolved: false,
      resolvedBy: null,
      resolvedAt: null,
    })
    .where(and(eq(inlineComments.id, commentId), eq(inlineComments.documentId, documentId)))
}

export async function deleteComment(commentId: string, documentId: string): Promise<boolean> {
  const result = await db
    .update(inlineComments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(inlineComments.id, commentId), eq(inlineComments.documentId, documentId), isNull(inlineComments.deletedAt)))
    .returning({ id: inlineComments.id })

  return result.length > 0
}

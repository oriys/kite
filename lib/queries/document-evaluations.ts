import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { documentEvaluations } from '@/lib/schema'

async function getDocumentEvaluation(id: string, documentId: string) {
  const evaluation = await db.query.documentEvaluations.findFirst({
    where: and(
      eq(documentEvaluations.id, id),
      eq(documentEvaluations.documentId, documentId),
    ),
    with: {
      creator: true,
    },
  })

  return evaluation ?? null
}

export async function listDocumentEvaluations(documentId: string) {
  return db.query.documentEvaluations.findMany({
    where: eq(documentEvaluations.documentId, documentId),
    orderBy: [desc(documentEvaluations.createdAt)],
    with: {
      creator: true,
    },
  })
}

export async function createDocumentEvaluation(
  documentId: string,
  createdBy: string,
  input: {
    score: number
    body: string
  },
) {
  const [created] = await db
    .insert(documentEvaluations)
    .values({
      documentId,
      score: input.score,
      body: input.body,
      createdBy,
    })
    .returning({ id: documentEvaluations.id })

  if (!created) return null

  return getDocumentEvaluation(created.id, documentId)
}

export async function updateDocumentEvaluation(
  id: string,
  documentId: string,
  patch: {
    score?: number
    body?: string
  },
) {
  const [updated] = await db
    .update(documentEvaluations)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentEvaluations.id, id),
        eq(documentEvaluations.documentId, documentId),
      ),
    )
    .returning({ id: documentEvaluations.id })

  if (!updated) return null

  return getDocumentEvaluation(updated.id, documentId)
}

export async function deleteDocumentEvaluation(id: string, documentId: string) {
  const deleted = await db
    .delete(documentEvaluations)
    .where(
      and(
        eq(documentEvaluations.id, id),
        eq(documentEvaluations.documentId, documentId),
      ),
    )
    .returning({ id: documentEvaluations.id })

  return deleted.length > 0
}

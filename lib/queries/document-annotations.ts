import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  documentAnnotations,
  type docAnnotationStatusEnum,
} from '@/lib/schema'

type AnnotationStatusValue = (typeof docAnnotationStatusEnum.enumValues)[number]

async function getDocumentAnnotation(id: string, documentId: string) {
  const annotation = await db.query.documentAnnotations.findFirst({
    where: and(
      eq(documentAnnotations.id, id),
      eq(documentAnnotations.documentId, documentId),
    ),
    with: {
      creator: true,
    },
  })

  return annotation ?? null
}

export async function listDocumentAnnotations(documentId: string) {
  return db.query.documentAnnotations.findMany({
    where: eq(documentAnnotations.documentId, documentId),
    orderBy: [desc(documentAnnotations.createdAt)],
    with: {
      creator: true,
    },
  })
}

export async function createDocumentAnnotation(
  documentId: string,
  createdBy: string,
  input: {
    body: string
    quote?: string
  },
) {
  const [created] = await db
    .insert(documentAnnotations)
    .values({
      documentId,
      body: input.body,
      quote: input.quote ?? '',
      createdBy,
    })
    .returning({ id: documentAnnotations.id })

  if (!created) return null

  return getDocumentAnnotation(created.id, documentId)
}

export async function updateDocumentAnnotation(
  id: string,
  documentId: string,
  patch: {
    body?: string
    status?: AnnotationStatusValue
  },
) {
  const [updated] = await db
    .update(documentAnnotations)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentAnnotations.id, id),
        eq(documentAnnotations.documentId, documentId),
      ),
    )
    .returning({ id: documentAnnotations.id })

  if (!updated) return null

  return getDocumentAnnotation(updated.id, documentId)
}

export async function deleteDocumentAnnotation(id: string, documentId: string) {
  const deleted = await db
    .delete(documentAnnotations)
    .where(
      and(
        eq(documentAnnotations.id, id),
        eq(documentAnnotations.documentId, documentId),
      ),
    )
    .returning({ id: documentAnnotations.id })

  return deleted.length > 0
}

import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db'
import { documentPermissions, documentTranslations, documents } from '../schema'

export async function createTranslationLink(
  sourceDocumentId: string,
  translatedDocumentId: string,
  sourceLocale: string,
  targetLocale: string,
) {
  const [link] = await db
    .insert(documentTranslations)
    .values({ sourceDocumentId, translatedDocumentId, sourceLocale, targetLocale })
    .returning()
  return link
}

export async function createTranslatedDocument(input: {
  sourceDocumentId: string
  workspaceId: string
  actorId: string
  targetLocale: string
  sourceSnapshot?: {
    title?: string
    content?: string
    visibility?: 'public' | 'partner' | 'private'
    apiVersionId?: string | null
    sourceLocale?: string
  }
}) {
  const existing = await db
    .select({
      documentId: documentTranslations.translatedDocumentId,
    })
    .from(documentTranslations)
    .where(
      and(
        eq(documentTranslations.sourceDocumentId, input.sourceDocumentId),
        eq(documentTranslations.targetLocale, input.targetLocale),
        isNull(documentTranslations.deletedAt),
      ),
    )
    .limit(1)

  if (existing[0]) {
    return {
      created: false,
      documentId: existing[0].documentId,
    }
  }

  return db.transaction(async (tx) => {
    const [sourceDocument] = await tx
      .select({
        id: documents.id,
        workspaceId: documents.workspaceId,
        title: documents.title,
        content: documents.content,
        visibility: documents.visibility,
        apiVersionId: documents.apiVersionId,
        locale: documents.locale,
      })
      .from(documents)
      .where(
        and(
          eq(documents.id, input.sourceDocumentId),
          eq(documents.workspaceId, input.workspaceId),
          isNull(documents.deletedAt),
        ),
      )

    if (!sourceDocument) {
      return null
    }

    const permissionRows = await tx
      .select({
        userId: documentPermissions.userId,
        level: documentPermissions.level,
        grantedBy: documentPermissions.grantedBy,
      })
      .from(documentPermissions)
      .where(eq(documentPermissions.documentId, input.sourceDocumentId))

    const [document] = await tx
      .insert(documents)
      .values({
        workspaceId: sourceDocument.workspaceId,
        title: input.sourceSnapshot?.title?.trim() || sourceDocument.title,
        content: input.sourceSnapshot?.content ?? sourceDocument.content,
        summary: '',
        visibility: input.sourceSnapshot?.visibility ?? sourceDocument.visibility,
        apiVersionId:
          input.sourceSnapshot?.apiVersionId === undefined
            ? sourceDocument.apiVersionId
            : input.sourceSnapshot.apiVersionId,
        locale: input.targetLocale,
        createdBy: input.actorId,
      })
      .returning()

    if (permissionRows.length > 0) {
      await tx.insert(documentPermissions).values(
        permissionRows.map((permission) => ({
          documentId: document.id,
          userId: permission.userId,
          level: permission.level,
          grantedBy: permission.grantedBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      )
    }

    await tx.insert(documentTranslations).values({
      sourceDocumentId: input.sourceDocumentId,
      translatedDocumentId: document.id,
      sourceLocale: input.sourceSnapshot?.sourceLocale ?? sourceDocument.locale,
      targetLocale: input.targetLocale,
    })

    return {
      created: true,
      documentId: document.id,
    }
  })
}

export async function getTranslationsForDocument(documentId: string) {
  const asSource = await db
    .select({
      id: documentTranslations.id,
      documentId: documentTranslations.translatedDocumentId,
      locale: documentTranslations.targetLocale,
      status: documentTranslations.translationStatus,
      documentTitle: documents.title,
    })
    .from(documentTranslations)
    .innerJoin(
      documents,
      eq(documentTranslations.translatedDocumentId, documents.id),
    )
    .where(
      and(
        eq(documentTranslations.sourceDocumentId, documentId),
        isNull(documentTranslations.deletedAt),
        isNull(documents.deletedAt),
      ),
    )

  const asTarget = await db
    .select({
      id: documentTranslations.id,
      documentId: documentTranslations.sourceDocumentId,
      locale: documentTranslations.sourceLocale,
      status: documentTranslations.translationStatus,
      documentTitle: documents.title,
    })
    .from(documentTranslations)
    .innerJoin(
      documents,
      eq(documentTranslations.sourceDocumentId, documents.id),
    )
    .where(
      and(
        eq(documentTranslations.translatedDocumentId, documentId),
        isNull(documentTranslations.deletedAt),
        isNull(documents.deletedAt),
      ),
    )

  return [...asSource, ...asTarget]
}

export async function updateTranslationStatus(
  id: string,
  status: string,
) {
  const [result] = await db
    .update(documentTranslations)
    .set({ translationStatus: status })
    .where(and(eq(documentTranslations.id, id), isNull(documentTranslations.deletedAt)))
    .returning()
  return result ?? null
}

export async function deleteTranslationLink(id: string) {
  await db
    .update(documentTranslations)
    .set({ deletedAt: new Date() })
    .where(and(eq(documentTranslations.id, id), isNull(documentTranslations.deletedAt)))
}

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
] as const

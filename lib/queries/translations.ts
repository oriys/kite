import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db'
import { documentTranslations, documents } from '../schema'

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

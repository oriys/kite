import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  documentTranslations,
  documentTranslationVersions,
} from '../schema'

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

// --- Queries ---

export async function getTranslationsForDocument(documentId: string) {
  const rows = await db
    .select({
      id: documentTranslations.id,
      locale: documentTranslations.locale,
      status: documentTranslations.status,
      createdAt: documentTranslations.createdAt,
      updatedAt: documentTranslations.updatedAt,
      versionId: documentTranslationVersions.id,
      versionTitle: documentTranslationVersions.title,
      versionTranslatedBy: documentTranslationVersions.translatedBy,
      versionCreatedAt: documentTranslationVersions.createdAt,
    })
    .from(documentTranslations)
    .leftJoin(
      documentTranslationVersions,
      and(
        eq(
          documentTranslationVersions.translationId,
          documentTranslations.id,
        ),
        eq(
          documentTranslationVersions.id,
          sql`(
            SELECT v.id FROM document_translation_versions v
            WHERE v.translation_id = ${documentTranslations.id}
            ORDER BY v.created_at DESC, v.id DESC
            LIMIT 1
          )`,
        ),
      ),
    )
    .where(
      and(
        eq(documentTranslations.documentId, documentId),
        isNull(documentTranslations.deletedAt),
      ),
    )

  return rows.map((row) => ({
    id: row.id,
    locale: row.locale,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    latestVersion: row.versionId
      ? {
          id: row.versionId,
          title: row.versionTitle!,
          translatedBy: row.versionTranslatedBy,
          createdAt: row.versionCreatedAt!,
        }
      : null,
  }))
}

export async function getTranslation(translationId: string) {
  const [translation] = await db
    .select()
    .from(documentTranslations)
    .where(
      and(
        eq(documentTranslations.id, translationId),
        isNull(documentTranslations.deletedAt),
      ),
    )
    .limit(1)

  return translation ?? null
}

export async function getTranslationByLocale(
  documentId: string,
  locale: string,
) {
  const [translation] = await db
    .select()
    .from(documentTranslations)
    .where(
      and(
        eq(documentTranslations.documentId, documentId),
        eq(documentTranslations.locale, locale),
        isNull(documentTranslations.deletedAt),
      ),
    )
    .limit(1)

  return translation ?? null
}

export async function getLatestTranslationVersion(translationId: string) {
  const [version] = await db
    .select()
    .from(documentTranslationVersions)
    .where(eq(documentTranslationVersions.translationId, translationId))
    .orderBy(
      desc(documentTranslationVersions.createdAt),
      desc(documentTranslationVersions.id),
    )
    .limit(1)

  return version ?? null
}

export async function getTranslationVersions(translationId: string) {
  return db
    .select()
    .from(documentTranslationVersions)
    .where(eq(documentTranslationVersions.translationId, translationId))
    .orderBy(
      desc(documentTranslationVersions.createdAt),
      desc(documentTranslationVersions.id),
    )
}

// --- Mutations ---

export async function createTranslation(input: {
  documentId: string
  locale: string
  title: string
  content: string
  translatedBy: string
}) {
  // Check for existing translation
  const existing = await getTranslationByLocale(input.documentId, input.locale)
  if (existing) {
    // Add a new version to the existing translation
    const [version] = await db
      .insert(documentTranslationVersions)
      .values({
        translationId: existing.id,
        title: input.title,
        content: input.content,
        translatedBy: input.translatedBy,
      })
      .returning()

    await db
      .update(documentTranslations)
      .set({ updatedAt: new Date() })
      .where(eq(documentTranslations.id, existing.id))

    return {
      created: false,
      translationId: existing.id,
      versionId: version.id,
    }
  }

  // Create new translation + first version
  return db.transaction(async (tx) => {
    const [translation] = await tx
      .insert(documentTranslations)
      .values({
        documentId: input.documentId,
        locale: input.locale,
      })
      .returning()

    const [version] = await tx
      .insert(documentTranslationVersions)
      .values({
        translationId: translation.id,
        title: input.title,
        content: input.content,
        translatedBy: input.translatedBy,
      })
      .returning()

    return {
      created: true,
      translationId: translation.id,
      versionId: version.id,
    }
  })
}

export async function addTranslationVersion(input: {
  translationId: string
  title: string
  content: string
  translatedBy: string
}) {
  const [version] = await db
    .insert(documentTranslationVersions)
    .values({
      translationId: input.translationId,
      title: input.title,
      content: input.content,
      translatedBy: input.translatedBy,
    })
    .returning()

  await db
    .update(documentTranslations)
    .set({ updatedAt: new Date() })
    .where(eq(documentTranslations.id, input.translationId))

  return version
}

export async function updateTranslationStatus(id: string, status: string) {
  const [result] = await db
    .update(documentTranslations)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(documentTranslations.id, id),
        isNull(documentTranslations.deletedAt),
      ),
    )
    .returning()
  return result ?? null
}

export async function deleteTranslation(id: string) {
  await db
    .update(documentTranslations)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(documentTranslations.id, id),
        isNull(documentTranslations.deletedAt),
      ),
    )
}

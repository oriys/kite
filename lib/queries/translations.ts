import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  documents,
  documentTranslations,
  documentTranslationVersions,
  publishedTranslationSnapshots,
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

export async function getTranslationsForDocument(workspaceId: string, documentId: string) {
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
    .innerJoin(documents, and(
      eq(documents.id, documentTranslations.documentId),
      eq(documents.workspaceId, workspaceId),
    ))
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

export async function getTranslation(workspaceId: string, translationId: string) {
  const rows = await db
    .select({
      id: documentTranslations.id,
      documentId: documentTranslations.documentId,
      locale: documentTranslations.locale,
      status: documentTranslations.status,
      createdAt: documentTranslations.createdAt,
      updatedAt: documentTranslations.updatedAt,
      deletedAt: documentTranslations.deletedAt,
    })
    .from(documentTranslations)
    .innerJoin(documents, and(
      eq(documents.id, documentTranslations.documentId),
      eq(documents.workspaceId, workspaceId),
    ))
    .where(
      and(
        eq(documentTranslations.id, translationId),
        isNull(documentTranslations.deletedAt),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}

export async function getTranslationByLocale(
  workspaceId: string,
  documentId: string,
  locale: string,
) {
  const rows = await db
    .select({
      id: documentTranslations.id,
      documentId: documentTranslations.documentId,
      locale: documentTranslations.locale,
      status: documentTranslations.status,
      createdAt: documentTranslations.createdAt,
      updatedAt: documentTranslations.updatedAt,
      deletedAt: documentTranslations.deletedAt,
    })
    .from(documentTranslations)
    .innerJoin(documents, and(
      eq(documents.id, documentTranslations.documentId),
      eq(documents.workspaceId, workspaceId),
    ))
    .where(
      and(
        eq(documentTranslations.documentId, documentId),
        eq(documentTranslations.locale, locale),
        isNull(documentTranslations.deletedAt),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}

export async function getLatestTranslationVersion(workspaceId: string, translationId: string) {
  const rows = await db
    .select({
      id: documentTranslationVersions.id,
      translationId: documentTranslationVersions.translationId,
      title: documentTranslationVersions.title,
      content: documentTranslationVersions.content,
      translatedBy: documentTranslationVersions.translatedBy,
      createdAt: documentTranslationVersions.createdAt,
    })
    .from(documentTranslationVersions)
    .innerJoin(documentTranslations, eq(documentTranslations.id, documentTranslationVersions.translationId))
    .innerJoin(documents, and(
      eq(documents.id, documentTranslations.documentId),
      eq(documents.workspaceId, workspaceId),
    ))
    .where(eq(documentTranslationVersions.translationId, translationId))
    .orderBy(
      desc(documentTranslationVersions.createdAt),
      desc(documentTranslationVersions.id),
    )
    .limit(1)

  return rows[0] ?? null
}

export async function getTranslationVersions(workspaceId: string, translationId: string) {
  return db
    .select({
      id: documentTranslationVersions.id,
      translationId: documentTranslationVersions.translationId,
      title: documentTranslationVersions.title,
      content: documentTranslationVersions.content,
      translatedBy: documentTranslationVersions.translatedBy,
      createdAt: documentTranslationVersions.createdAt,
    })
    .from(documentTranslationVersions)
    .innerJoin(documentTranslations, eq(documentTranslations.id, documentTranslationVersions.translationId))
    .innerJoin(documents, and(
      eq(documents.id, documentTranslations.documentId),
      eq(documents.workspaceId, workspaceId),
    ))
    .where(eq(documentTranslationVersions.translationId, translationId))
    .orderBy(
      desc(documentTranslationVersions.createdAt),
      desc(documentTranslationVersions.id),
    )
}

// --- Mutations ---

export async function createTranslation(workspaceId: string, input: {
  documentId: string
  locale: string
  title: string
  content: string
  translatedBy: string
}) {
  // Check for existing translation
  const existing = await getTranslationByLocale(workspaceId, input.documentId, input.locale)
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

export async function addTranslationVersion(workspaceId: string, input: {
  translationId: string
  title: string
  content: string
  translatedBy: string
}) {
  // Verify translation belongs to workspace
  const translation = await getTranslation(workspaceId, input.translationId)
  if (!translation) throw new Error('Translation not found')

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

export async function updateTranslationStatus(workspaceId: string, id: string, status: string) {
  // Verify translation belongs to workspace
  const translation = await getTranslation(workspaceId, id)
  if (!translation) return null

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

export async function deleteTranslation(workspaceId: string, id: string) {
  // Verify translation belongs to workspace
  const translation = await getTranslation(workspaceId, id)
  if (!translation) return

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

export async function publishTranslation(
  workspaceId: string,
  translationId: string,
  actorId: string,
) {
  const translation = await getTranslation(workspaceId, translationId)
  if (!translation) return null

  const latestVersion = await getLatestTranslationVersion(workspaceId, translationId)
  if (!latestVersion) return null

  return db.transaction(async (tx) => {
    // Deactivate existing active snapshot for this doc+locale
    await tx
      .update(publishedTranslationSnapshots)
      .set({ isActive: false })
      .where(
        and(
          eq(publishedTranslationSnapshots.documentId, translation.documentId),
          eq(publishedTranslationSnapshots.locale, translation.locale),
          eq(publishedTranslationSnapshots.isActive, true),
        ),
      )

    // Get next version
    const [maxVersion] = await tx
      .select({ max: sql<number>`coalesce(max(${publishedTranslationSnapshots.version}), 0)` })
      .from(publishedTranslationSnapshots)
      .where(
        and(
          eq(publishedTranslationSnapshots.documentId, translation.documentId),
          eq(publishedTranslationSnapshots.locale, translation.locale),
        ),
      )

    const [snapshot] = await tx
      .insert(publishedTranslationSnapshots)
      .values({
        workspaceId,
        documentId: translation.documentId,
        locale: translation.locale,
        version: (maxVersion?.max ?? 0) + 1,
        title: latestVersion.title,
        content: latestVersion.content,
        publishedBy: actorId,
        isActive: true,
      })
      .returning()

    // Update translation status
    await tx
      .update(documentTranslations)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(documentTranslations.id, translationId))

    return snapshot
  })
}

export async function rollbackTranslation(
  workspaceId: string,
  documentId: string,
  locale: string,
  targetVersion: number,
  actorId: string,
) {
  const target = await db.query.publishedTranslationSnapshots.findFirst({
    where: and(
      eq(publishedTranslationSnapshots.documentId, documentId),
      eq(publishedTranslationSnapshots.locale, locale),
      eq(publishedTranslationSnapshots.version, targetVersion),
    ),
  })

  if (!target) return null

  return db.transaction(async (tx) => {
    await tx
      .update(publishedTranslationSnapshots)
      .set({ isActive: false })
      .where(
        and(
          eq(publishedTranslationSnapshots.documentId, documentId),
          eq(publishedTranslationSnapshots.locale, locale),
          eq(publishedTranslationSnapshots.isActive, true),
        ),
      )

    const [maxVersion] = await tx
      .select({ max: sql<number>`coalesce(max(${publishedTranslationSnapshots.version}), 0)` })
      .from(publishedTranslationSnapshots)
      .where(
        and(
          eq(publishedTranslationSnapshots.documentId, documentId),
          eq(publishedTranslationSnapshots.locale, locale),
        ),
      )

    const [snapshot] = await tx
      .insert(publishedTranslationSnapshots)
      .values({
        workspaceId,
        documentId,
        locale,
        version: (maxVersion?.max ?? 0) + 1,
        title: target.title,
        content: target.content,
        publishedBy: actorId,
        isActive: true,
      })
      .returning()

    return snapshot
  })
}

export async function getTranslationCompleteness(workspaceId: string, documentId: string) {
  const translations = await getTranslationsForDocument(workspaceId, documentId)
  const total = translations.length
  const published = translations.filter((t) => t.status === 'published').length
  const approved = translations.filter((t) => t.status === 'approved' || t.status === 'published').length

  return {
    total,
    published,
    approved,
    completionRate: total > 0 ? Math.round((approved / total) * 100) : 100,
    locales: translations.map((t) => ({ locale: t.locale, status: t.status })),
  }
}

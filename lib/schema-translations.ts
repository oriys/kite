import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { users } from './schema-auth'
import { documents } from './schema-documents'

export const documentTranslations = pgTable(
  'document_translations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    uniqueIndex('doc_translations_doc_locale_idx')
      .on(t.documentId, t.locale)
      .where(sql`${t.deletedAt} is null`),
  ],
)

export const documentTranslationVersions = pgTable(
  'document_translation_versions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    translationId: text('translation_id')
      .notNull()
      .references(() => documentTranslations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    translatedBy: text('translated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('doc_translation_versions_translation_idx').on(t.translationId),
    index('doc_translation_versions_created_idx').on(
      t.translationId,
      t.createdAt,
    ),
  ],
)

export const documentTranslationsRelations = relations(
  documentTranslations,
  ({ one, many }) => ({
    document: one(documents, {
      fields: [documentTranslations.documentId],
      references: [documents.id],
    }),
    versions: many(documentTranslationVersions),
  }),
)

export const documentTranslationVersionsRelations = relations(
  documentTranslationVersions,
  ({ one }) => ({
    translation: one(documentTranslations, {
      fields: [documentTranslationVersions.translationId],
      references: [documentTranslations.id],
    }),
    translator: one(users, {
      fields: [documentTranslationVersions.translatedBy],
      references: [users.id],
    }),
  }),
)

import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { users } from './schema-auth'
import { workspaces } from './schema-workspace'
import { documents, visibilityEnum } from './schema-documents'

export const publishedSnapshots = pgTable(
  'published_snapshots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    slug: text('slug'),
    publishedSlug: text('published_slug'),
    content: text('content').notNull(),
    summary: text('summary').notNull().default(''),
    category: text('category').notNull().default(''),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    locale: text('locale').notNull().default('en'),
    navSection: text('nav_section'),
    publishOrder: integer('publish_order').default(0),
    visibility: visibilityEnum('visibility').notNull().default('public'),
    publishedAt: timestamp('published_at', { mode: 'date' }).notNull().defaultNow(),
    publishedBy: text('published_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    isActive: boolean('is_active').notNull().default(true),
    rolloutPercentage: integer('rollout_percentage').notNull().default(100),
    rolloutChannels: jsonb('rollout_channels').$type<string[]>().default([]),
    rollbackOf: integer('rollback_of'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (t) => [
    index('published_snapshots_workspace_idx').on(t.workspaceId),
    index('published_snapshots_document_idx').on(t.documentId),
    index('published_snapshots_document_version_idx').on(t.documentId, t.version),
    uniqueIndex('published_snapshots_active_idx')
      .on(t.documentId)
      .where(sql`${t.isActive} = true`),
    check('rollout_percentage_range', sql`${t.rolloutPercentage} >= 0 AND ${t.rolloutPercentage} <= 100`),
  ],
)

export const scheduledPublications = pgTable(
  'scheduled_publications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    scheduledAt: timestamp('scheduled_at', { mode: 'date' }).notNull(),
    status: text('status').notNull().default('pending'),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('scheduled_publications_workspace_idx').on(t.workspaceId),
    index('scheduled_publications_document_idx').on(t.documentId),
    index('scheduled_publications_status_scheduled_idx').on(t.status, t.scheduledAt),
  ],
)

export const publishedTranslationSnapshots = pgTable(
  'published_translation_snapshots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    publishedAt: timestamp('published_at', { mode: 'date' }).notNull().defaultNow(),
    publishedBy: text('published_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (t) => [
    index('pub_translation_snapshots_workspace_idx').on(t.workspaceId),
    index('pub_translation_snapshots_document_idx').on(t.documentId),
    uniqueIndex('pub_translation_snapshots_active_idx')
      .on(t.documentId, t.locale)
      .where(sql`${t.isActive} = true`),
  ],
)

export const publishedSnapshotsRelations = relations(publishedSnapshots, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [publishedSnapshots.workspaceId],
    references: [workspaces.id],
  }),
  document: one(documents, {
    fields: [publishedSnapshots.documentId],
    references: [documents.id],
  }),
  publisher: one(users, {
    fields: [publishedSnapshots.publishedBy],
    references: [users.id],
  }),
}))

export const scheduledPublicationsRelations = relations(scheduledPublications, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [scheduledPublications.workspaceId],
    references: [workspaces.id],
  }),
  document: one(documents, {
    fields: [scheduledPublications.documentId],
    references: [documents.id],
  }),
  creator: one(users, {
    fields: [scheduledPublications.createdBy],
    references: [users.id],
  }),
}))

export const publishedTranslationSnapshotsRelations = relations(
  publishedTranslationSnapshots,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [publishedTranslationSnapshots.workspaceId],
      references: [workspaces.id],
    }),
    document: one(documents, {
      fields: [publishedTranslationSnapshots.documentId],
      references: [documents.id],
    }),
    publisher: one(users, {
      fields: [publishedTranslationSnapshots.publishedBy],
      references: [users.id],
    }),
  }),
)

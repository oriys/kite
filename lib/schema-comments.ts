import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './schema-auth'
import { documents } from './schema-documents'
import { workspaces } from './schema-workspace'

export const inlineComments = pgTable(
  'inline_comments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    anchorType: text('anchor_type').notNull(),
    anchorFrom: integer('anchor_from'),
    anchorTo: integer('anchor_to'),
    anchorBlockId: text('anchor_block_id'),
    quotedText: text('quoted_text'),
    body: text('body').notNull(),
    parentId: text('parent_id'),
    threadResolved: boolean('thread_resolved').notNull().default(false),
    resolvedBy: text('resolved_by'),
    resolvedAt: timestamp('resolved_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('inline_comments_parent_id_idx').on(t.parentId),
    index('inline_comments_document_deleted_created_idx').on(
      t.documentId,
      t.deletedAt,
      t.createdAt,
    ),
    index('inline_comments_parent_deleted_idx').on(t.parentId, t.deletedAt),
  ],
)

export const linkChecks = pgTable(
  'link_checks',
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
    url: text('url').notNull(),
    statusCode: integer('status_code'),
    isAlive: boolean('is_alive'),
    errorMessage: text('error_message'),
    lastCheckedAt: timestamp('last_checked_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('link_checks_document_url_idx').on(t.documentId, t.url),
    index('link_checks_workspace_id_idx').on(t.workspaceId),
  ],
)

export const documentFeedback = pgTable(
  'document_feedback',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    isHelpful: boolean('is_helpful').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('document_feedback_document_id_idx').on(t.documentId),
  ],
)

export const inlineCommentsRelations = relations(inlineComments, ({ one }) => ({
  document: one(documents, {
    fields: [inlineComments.documentId],
    references: [documents.id],
  }),
  author: one(users, {
    fields: [inlineComments.authorId],
    references: [users.id],
  }),
}))

export const documentFeedbackRelations = relations(documentFeedback, ({ one }) => ({
  document: one(documents, {
    fields: [documentFeedback.documentId],
    references: [documents.id],
  }),
}))

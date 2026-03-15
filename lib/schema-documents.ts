import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { DOC_SNIPPET_CATEGORIES, type DocSnippetCategory } from './doc-snippets'
import { users } from './schema-auth'
import { workspaces } from './schema-workspace'

export const docStatusEnum = pgEnum('doc_status', [
  'draft',
  'review',
  'published',
  'archived',
])

export const visibilityEnum = pgEnum('visibility_level', [
  'public',
  'partner',
  'private',
])

export const documentPermissionLevelEnum = pgEnum('document_permission_level', [
  'view',
  'edit',
  'manage',
])

export const documentRelationTypeEnum = pgEnum('document_relation_type', [
  'reference',
])

export const documents = pgTable(
  'documents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Untitled'),
    slug: text('slug'),
    category: text('category').notNull().default(''),
    content: text('content').notNull().default(''),
    summary: text('summary').notNull().default(''),
    status: docStatusEnum('status').notNull().default('draft'),
    visibility: visibilityEnum('visibility').notNull().default('public'),
    apiVersionId: text('api_version_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
    locale: text('locale').notNull().default('en'),
    publishedSlug: text('published_slug'),
    publishOrder: integer('publish_order').default(0),
    navSection: text('nav_section'),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    uniqueIndex('documents_workspace_slug_idx')
      .on(t.workspaceId, t.slug)
      .where(sql`${t.deletedAt} is null and ${t.slug} is not null`),
    index('documents_workspace_active_updated_idx')
      .on(t.workspaceId, t.updatedAt)
      .where(sql`${t.deletedAt} is null`),
    index('documents_status_idx').on(t.status),
    index('documents_created_by_idx').on(t.createdBy),
    index('documents_category_idx').on(t.category),
    index('documents_api_version_id_idx').on(t.apiVersionId),
    index('documents_locale_idx').on(t.locale),
  ],
)

export const documentPermissions = pgTable(
  'document_permissions',
  {
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    level: documentPermissionLevelEnum('level').notNull(),
    grantedBy: text('granted_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.userId] }),
    index('document_permissions_document_id_idx').on(t.documentId),
    index('document_permissions_user_id_idx').on(t.userId),
  ],
)

export const docSnippetCategoryEnum = pgEnum(
  'doc_snippet_category',
  [...DOC_SNIPPET_CATEGORIES] as [DocSnippetCategory, ...DocSnippetCategory[]],
)

export const docSnippets = pgTable(
  'doc_snippets',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    label: text('label').notNull(),
    description: text('description').notNull(),
    category: docSnippetCategoryEnum('category').notNull(),
    keywords: text('keywords').array().notNull(),
    template: text('template').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    index('doc_snippets_workspace_id_idx').on(t.workspaceId),
    index('doc_snippets_category_idx').on(t.category),
  ],
)

export const documentVersions = pgTable(
  'document_versions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    wordCount: integer('word_count').notNull().default(0),
    savedAt: timestamp('saved_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('document_versions_document_id_idx').on(t.documentId),
    index('document_versions_document_saved_at_idx').on(t.documentId, t.savedAt),
  ],
)

export const documentRelations = pgTable(
  'document_relations',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceDocumentId: text('source_document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    targetDocumentId: text('target_document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    relationType: documentRelationTypeEnum('relation_type').notNull(),
    relationLabel: text('relation_label').notNull().default(''),
    matchScore: integer('match_score').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [t.sourceDocumentId, t.targetDocumentId, t.relationType],
    }),
    index('document_relations_workspace_source_idx').on(
      t.workspaceId,
      t.sourceDocumentId,
      t.relationType,
    ),
    index('document_relations_workspace_target_idx').on(
      t.workspaceId,
      t.targetDocumentId,
      t.relationType,
    ),
  ],
)

export const documentsRelations = relations(documents, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [documents.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [documents.createdBy],
    references: [users.id],
  }),
  versions: many(documentVersions),
  outgoingRelations: many(documentRelations, {
    relationName: 'documentRelationSource',
  }),
  incomingRelations: many(documentRelations, {
    relationName: 'documentRelationTarget',
  }),
}))

export const docSnippetsRelations = relations(docSnippets, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [docSnippets.workspaceId],
    references: [workspaces.id],
  }),
}))

export const documentVersionsRelations = relations(
  documentVersions,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentVersions.documentId],
      references: [documents.id],
    }),
  }),
)

export const documentRelationsRelations = relations(
  documentRelations,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [documentRelations.workspaceId],
      references: [workspaces.id],
    }),
    sourceDocument: one(documents, {
      fields: [documentRelations.sourceDocumentId],
      references: [documents.id],
      relationName: 'documentRelationSource',
    }),
    targetDocument: one(documents, {
      fields: [documentRelations.targetDocumentId],
      references: [documents.id],
      relationName: 'documentRelationTarget',
    }),
  }),
)

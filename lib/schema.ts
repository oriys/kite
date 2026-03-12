import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { AdapterAccountType } from 'next-auth/adapters'
import { DOC_SNIPPET_CATEGORIES, type DocSnippetCategory } from './doc-snippets'

// ─── Auth.js tables ─────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
})

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
)

// ─── Application tables ─────────────────────────────────────────

export const workspaces = pgTable('workspaces', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

export const memberRoleEnum = pgEnum('member_role', [
  'owner',
  'editor',
  'viewer',
])

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('editor'),
    joinedAt: timestamp('joined_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (wm) => [primaryKey({ columns: [wm.userId, wm.workspaceId] })],
)

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
    content: text('content').notNull().default(''),
    summary: text('summary').notNull().default(''),
    status: docStatusEnum('status').notNull().default('draft'),
    visibility: visibilityEnum('visibility').notNull().default('public'),
    apiVersionId: text('api_version_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('documents_workspace_id_idx').on(t.workspaceId),
    index('documents_status_idx').on(t.status),
    index('documents_created_by_idx').on(t.createdBy),
    index('documents_api_version_id_idx').on(t.apiVersionId),
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
  ],
)

// ─── Relations ──────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  workspaceMembers: many(workspaceMembers),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  documents: many(documents),
  docSnippets: many(docSnippets),
}))

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
  }),
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

// ─── F1: OpenAPI Sources ────────────────────────────────────────

export const openapiSourceTypeEnum = pgEnum('openapi_source_type', [
  'upload',
  'url',
])

export const openapiSources = pgTable(
  'openapi_sources',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sourceType: openapiSourceTypeEnum('source_type').notNull(),
    sourceUrl: text('source_url'),
    rawContent: text('raw_content').notNull(),
    parsedVersion: text('parsed_version'),
    openapiVersion: text('openapi_version'),
    checksum: text('checksum').notNull(),
    lastSyncedAt: timestamp('last_synced_at', { mode: 'date' }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('openapi_sources_workspace_id_idx').on(t.workspaceId),
  ],
)

export const openapiSnapshots = pgTable(
  'openapi_snapshots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => openapiSources.id, { onDelete: 'cascade' }),
    rawContent: text('raw_content').notNull(),
    parsedVersion: text('parsed_version'),
    checksum: text('checksum').notNull(),
    snapshotAt: timestamp('snapshot_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('openapi_snapshots_source_id_idx').on(t.sourceId),
  ],
)

export const apiEndpoints = pgTable(
  'api_endpoints',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => openapiSources.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    method: text('method').notNull(),
    operationId: text('operation_id'),
    summary: text('summary'),
    description: text('description'),
    tags: jsonb('tags').$type<string[]>().default([]),
    parameters: jsonb('parameters').$type<Record<string, unknown>[]>().default([]),
    requestBody: jsonb('request_body').$type<Record<string, unknown> | null>(),
    responses: jsonb('responses').$type<Record<string, unknown>>().default({}),
    deprecated: boolean('deprecated').notNull().default(false),
    visibility: visibilityEnum('visibility').notNull().default('public'),
    documentId: text('document_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('api_endpoints_source_id_idx').on(t.sourceId),
    index('api_endpoints_method_path_idx').on(t.method, t.path),
  ],
)

// ─── F2: API Versions ───────────────────────────────────────────

export const apiVersionStatusEnum = pgEnum('api_version_status', [
  'active',
  'beta',
  'deprecated',
  'retired',
])

export const apiVersions = pgTable(
  'api_versions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    slug: text('slug').notNull(),
    baseUrl: text('base_url'),
    status: apiVersionStatusEnum('status').notNull().default('active'),
    isDefault: boolean('is_default').notNull().default(false),
    sourceId: text('source_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('api_versions_workspace_slug_idx').on(t.workspaceId, t.slug),
    index('api_versions_workspace_id_idx').on(t.workspaceId),
  ],
)

// ─── F3: Search Logs ────────────────────────────────────────────

export const searchLogs = pgTable(
  'search_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id').notNull(),
    userId: text('user_id'),
    query: text('query').notNull(),
    resultCount: integer('result_count').notNull(),
    clickedDocumentId: text('clicked_document_id'),
    searchedAt: timestamp('searched_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('search_logs_workspace_id_idx').on(t.workspaceId),
    index('search_logs_searched_at_idx').on(t.searchedAt),
  ],
)

// ─── F5: Partner Groups ─────────────────────────────────────────

export const partnerGroups = pgTable(
  'partner_groups',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('partner_groups_workspace_id_idx').on(t.workspaceId),
  ],
)

export const partnerGroupMembers = pgTable(
  'partner_group_members',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => partnerGroups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
)

// ─── F7: Inline Comments ────────────────────────────────────────

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
  },
  (t) => [
    index('inline_comments_document_id_idx').on(t.documentId),
    index('inline_comments_parent_id_idx').on(t.parentId),
  ],
)

// ─── F8: Link Checks ────────────────────────────────────────────

export const linkChecks = pgTable(
  'link_checks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id').notNull(),
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

// ─── F9: Document Feedback ──────────────────────────────────────

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

// ─── New Relations ──────────────────────────────────────────────

export const openapiSourcesRelations = relations(openapiSources, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [openapiSources.workspaceId],
    references: [workspaces.id],
  }),
  snapshots: many(openapiSnapshots),
  endpoints: many(apiEndpoints),
}))

export const openapiSnapshotsRelations = relations(openapiSnapshots, ({ one }) => ({
  source: one(openapiSources, {
    fields: [openapiSnapshots.sourceId],
    references: [openapiSources.id],
  }),
}))

export const apiEndpointsRelations = relations(apiEndpoints, ({ one }) => ({
  source: one(openapiSources, {
    fields: [apiEndpoints.sourceId],
    references: [openapiSources.id],
  }),
}))

export const apiVersionsRelations = relations(apiVersions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiVersions.workspaceId],
    references: [workspaces.id],
  }),
}))

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

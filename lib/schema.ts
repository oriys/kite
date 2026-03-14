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
  customType,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
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
  'admin',
  'member',
  'guest',
])

export const memberStatusEnum = pgEnum('member_status', [
  'active',
  'disabled',
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
    role: memberRoleEnum('role').notNull().default('member'),
    status: memberStatusEnum('status').notNull().default('active'),
    invitedBy: text('invited_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    joinedAt: timestamp('joined_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (wm) => [
    primaryKey({ columns: [wm.userId, wm.workspaceId] }),
    index('workspace_members_workspace_role_idx').on(wm.workspaceId, wm.role),
    index('workspace_members_workspace_status_idx').on(wm.workspaceId, wm.status),
  ],
)

// ─── Workspace Invites ──────────────────────────────────────────

export const inviteTypeEnum = pgEnum('invite_type', ['email', 'link'])

export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email'),
    role: memberRoleEnum('role').notNull().default('member'),
    token: text('token').notNull().unique(),
    type: inviteTypeEnum('type').notNull(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    acceptedAt: timestamp('accepted_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('workspace_invites_workspace_id_idx').on(t.workspaceId),
    index('workspace_invites_email_idx').on(t.email),
    index('workspace_invites_token_idx').on(t.token),
  ],
)

// ─── Teams ──────────────────────────────────────────────────────

export const teams = pgTable(
  'teams',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    parentId: text('parent_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('teams_workspace_id_idx').on(t.workspaceId),
    index('teams_parent_id_idx').on(t.parentId),
  ],
)

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    index('team_members_team_id_idx').on(t.teamId),
    index('team_members_user_id_idx').on(t.userId),
  ],
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
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
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
  invites: many(workspaceInvites),
  teams: many(teams),
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
    inviter: one(users, {
      fields: [workspaceMembers.invitedBy],
      references: [users.id],
      relationName: 'invitedMembers',
    }),
  }),
)

export const workspaceInvitesRelations = relations(
  workspaceInvites,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceInvites.workspaceId],
      references: [workspaces.id],
    }),
    inviter: one(users, {
      fields: [workspaceInvites.invitedBy],
      references: [users.id],
    }),
  }),
)

export const teamsRelations = relations(teams, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [teams.workspaceId],
    references: [workspaces.id],
  }),
  parent: one(teams, {
    fields: [teams.parentId],
    references: [teams.id],
    relationName: 'children',
  }),
  children: many(teams, { relationName: 'children' }),
  members: many(teamMembers),
}))

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}))

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
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
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
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    uniqueIndex('api_versions_workspace_slug_idx')
      .on(t.workspaceId, t.slug)
      .where(sql`${t.deletedAt} is null`),
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
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
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
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
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
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
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

// ─── F8: Link Checks ────────────────────────────────────────────

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

// ─── F10: Audit Logs ────────────────────────────────────────────

export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'publish',
  'archive',
  'approve',
  'reject',
  'status_change',
  'visibility_change',
  'login',
  'export',
  'invite',
  'member_add',
  'member_remove',
  'role_change',
  'team_create',
  'team_update',
  'team_delete',
])

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: auditActionEnum('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    resourceTitle: text('resource_title'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_resource_idx').on(t.resourceType, t.resourceId),
    index('audit_logs_created_at_idx').on(t.createdAt),
    index('audit_logs_workspace_actor_idx').on(t.workspaceId, t.actorId),
    index('audit_logs_workspace_action_created_idx').on(
      t.workspaceId,
      t.action,
      t.createdAt,
    ),
  ],
)

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [auditLogs.workspaceId],
    references: [workspaces.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}))

// ─── F11: Notifications ─────────────────────────────────────────

export const notificationTypeEnum = pgEnum('notification_type', [
  'comment',
  'mention',
  'approval_request',
  'approval_decision',
  'status_change',
  'webhook_failure',
  'system',
])

export const notifications = pgTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    linkUrl: text('link_url'),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    actorId: text('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_recipient_id_idx').on(t.recipientId),
    index('notifications_workspace_id_idx').on(t.workspaceId),
    index('notifications_created_at_idx').on(t.createdAt),
    index('notifications_recipient_workspace_read_created_idx').on(
      t.recipientId,
      t.workspaceId,
      t.isRead,
      t.createdAt,
    ),
  ],
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
    relationName: 'recipient',
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'actor',
  }),
  workspace: one(workspaces, {
    fields: [notifications.workspaceId],
    references: [workspaces.id],
  }),
}))

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    commentEnabled: boolean('comment_enabled').notNull().default(true),
    mentionEnabled: boolean('mention_enabled').notNull().default(true),
    approvalEnabled: boolean('approval_enabled').notNull().default(true),
    statusChangeEnabled: boolean('status_change_enabled').notNull().default(true),
    webhookFailureEnabled: boolean('webhook_failure_enabled').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId] })],
)

export const userFeaturePreferences = pgTable(
  'user_feature_preferences',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    openApiEnabled: boolean('openapi_enabled').notNull().default(true),
    templatesEnabled: boolean('templates_enabled').notNull().default(true),
    aiWorkspaceEnabled: boolean('ai_workspace_enabled').notNull().default(true),
    analyticsEnabled: boolean('analytics_enabled').notNull().default(true),
    approvalsEnabled: boolean('approvals_enabled').notNull().default(true),
    webhooksEnabled: boolean('webhooks_enabled').notNull().default(true),
    linkHealthEnabled: boolean('link_health_enabled').notNull().default(true),
    quickInsertEnabled: boolean('quick_insert_enabled').notNull().default(true),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId] })],
)

export const aiProviderTypeEnum = pgEnum('ai_provider_type', [
  'openai_compatible',
  'anthropic',
  'gemini',
])

export const aiProviderConfigs = pgTable(
  'ai_provider_configs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    providerType: aiProviderTypeEnum('provider_type').notNull(),
    baseUrl: text('base_url'),
    apiKey: text('api_key').notNull(),
    defaultModelId: text('default_model_id'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [index('ai_provider_configs_workspace_id_idx').on(t.workspaceId)],
)

export const aiWorkspaceSettings = pgTable(
  'ai_workspace_settings',
  {
    workspaceId: text('workspace_id')
      .primaryKey()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    defaultModelId: text('default_model_id'),
    enabledModelIds: jsonb('enabled_model_ids')
      .$type<string[]>()
      .notNull()
      .default([]),
    promptSettings: jsonb('prompt_settings')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    embeddingModelId: text('embedding_model_id'),
    rerankerModelId: text('reranker_model_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
)

// ─── Document Chunks (pgvector embeddings) ──────────────────────

const vector1536 = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return 'vector(1536)'
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`
  },
  fromDriver(value: unknown) {
    return JSON.parse(value as string) as number[]
  },
})

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    chunkText: text('chunk_text').notNull(),
    embedding: vector1536('embedding'),
    tokenCount: integer('token_count').notNull().default(0),
    contentHash: text('content_hash').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('document_chunks_document_id_idx').on(t.documentId),
    index('document_chunks_workspace_id_idx').on(t.workspaceId),
    index('document_chunks_document_chunk_idx').on(t.documentId, t.chunkIndex),
  ],
)

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
  workspace: one(workspaces, {
    fields: [documentChunks.workspaceId],
    references: [workspaces.id],
  }),
}))

// ─── AI Chat ────────────────────────────────────────────────────

export const aiChatRoleEnum = pgEnum('ai_chat_role', [
  'user',
  'assistant',
  'system',
])

export const aiChatSessions = pgTable(
  'ai_chat_sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New conversation'),
    documentId: text('document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_chat_sessions_workspace_user_idx').on(t.workspaceId, t.userId),
    index('ai_chat_sessions_document_id_idx').on(t.documentId),
  ],
)

export const aiChatMessages = pgTable(
  'ai_chat_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: 'cascade' }),
    role: aiChatRoleEnum('role').notNull(),
    content: text('content').notNull(),
    sources: jsonb('sources')
      .$type<
        Array<{
          documentId: string
          chunkId: string
          title: string
          preview: string
          relationType?: 'primary' | 'reference'
          relationDescription?: string
        }>
      >()
      .default([]),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_chat_messages_session_id_idx').on(t.sessionId),
    index('ai_chat_messages_session_created_idx').on(t.sessionId, t.createdAt),
  ],
)

export const aiChatSessionsRelations = relations(
  aiChatSessions,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [aiChatSessions.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [aiChatSessions.userId],
      references: [users.id],
    }),
    document: one(documents, {
      fields: [aiChatSessions.documentId],
      references: [documents.id],
    }),
    messages: many(aiChatMessages),
  }),
)

export const aiChatMessagesRelations = relations(aiChatMessages, ({ one }) => ({
  session: one(aiChatSessions, {
    fields: [aiChatMessages.sessionId],
    references: [aiChatSessions.id],
  }),
}))

// ─── F12: Webhooks ──────────────────────────────────────────────

export const webhookEventEnum = pgEnum('webhook_event', [
  'document.created',
  'document.updated',
  'document.published',
  'document.archived',
  'document.deleted',
  'comment.created',
  'comment.resolved',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'api_version.created',
  'api_version.deprecated',
])

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'success',
  'failed',
])

export const webhooks = pgTable(
  'webhooks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    events: jsonb('events').$type<string[]>().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('webhooks_workspace_id_idx').on(t.workspaceId),
    index('webhooks_workspace_active_idx').on(t.workspaceId, t.isActive),
  ],
)

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    webhookId: text('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: deliveryStatusEnum('status').notNull().default('pending'),
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
    errorMessage: text('error_message'),
    attemptCount: integer('attempt_count').notNull().default(0),
    deliveredAt: timestamp('delivered_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('webhook_deliveries_created_at_idx').on(t.createdAt),
    index('webhook_deliveries_webhook_created_idx').on(t.webhookId, t.createdAt),
  ],
)

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [webhooks.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [webhooks.createdBy],
    references: [users.id],
  }),
  deliveries: many(webhookDeliveries),
}))

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}))

// ─── F13: Approval Workflow ─────────────────────────────────────

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
])

export const approvalDecisionEnum = pgEnum('approval_decision', [
  'approved',
  'rejected',
  'changes_requested',
])

export const approvalRequests = pgTable(
  'approval_requests',
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
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: approvalStatusEnum('status').notNull().default('pending'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    requiredApprovals: integer('required_approvals').notNull().default(1),
    deadline: timestamp('deadline', { mode: 'date' }),
    resolvedAt: timestamp('resolved_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('approval_requests_workspace_id_idx').on(t.workspaceId),
    index('approval_requests_document_id_idx').on(t.documentId),
    index('approval_requests_requester_id_idx').on(t.requesterId),
    index('approval_requests_status_idx').on(t.status),
  ],
)

export const approvalReviewers = pgTable(
  'approval_reviewers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .notNull()
      .references(() => approvalRequests.id, { onDelete: 'cascade' }),
    reviewerId: text('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    decision: approvalDecisionEnum('decision'),
    comment: text('comment'),
    decidedAt: timestamp('decided_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('approval_reviewers_request_id_idx').on(t.requestId),
    index('approval_reviewers_reviewer_id_idx').on(t.reviewerId),
    index('approval_reviewers_reviewer_request_idx').on(t.reviewerId, t.requestId),
    uniqueIndex('approval_reviewers_request_reviewer_idx').on(
      t.requestId,
      t.reviewerId,
    ),
  ],
)

export const approvalRequestsRelations = relations(
  approvalRequests,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [approvalRequests.workspaceId],
      references: [workspaces.id],
    }),
    document: one(documents, {
      fields: [approvalRequests.documentId],
      references: [documents.id],
    }),
    requester: one(users, {
      fields: [approvalRequests.requesterId],
      references: [users.id],
    }),
    reviewers: many(approvalReviewers),
  }),
)

export const approvalReviewersRelations = relations(
  approvalReviewers,
  ({ one }) => ({
    request: one(approvalRequests, {
      fields: [approvalReviewers.requestId],
      references: [approvalRequests.id],
    }),
    reviewer: one(users, {
      fields: [approvalReviewers.reviewerId],
      references: [users.id],
    }),
  }),
)

// ─── F14: Workspace Branding ────────────────────────────────────

export const workspaceBranding = pgTable('workspace_branding', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  primaryColor: text('primary_color'),
  accentColor: text('accent_color'),
  customDomain: text('custom_domain'),
  customCss: text('custom_css'),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  ogImageUrl: text('og_image_url'),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
})

export const workspaceBrandingRelations = relations(
  workspaceBranding,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceBranding.workspaceId],
      references: [workspaces.id],
    }),
  }),
)

// ─── F15: Document Translations (i18n) ──────────────────────────

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

// ─── F16: API Playground Enhancements ───────────────────────────

export const apiAuthTypeEnum = pgEnum('api_auth_type', [
  'none',
  'bearer',
  'api_key',
  'basic',
  'oauth2',
])

export const apiEnvironments = pgTable(
  'api_environments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    baseUrl: text('base_url').notNull(),
    variables: jsonb('variables')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('api_environments_workspace_id_idx').on(t.workspaceId),
  ],
)

export const apiAuthConfigs = pgTable(
  'api_auth_configs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    authType: apiAuthTypeEnum('auth_type').notNull(),
    config: jsonb('config').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('api_auth_configs_workspace_id_idx').on(t.workspaceId),
  ],
)

export const apiRequestHistory = pgTable(
  'api_request_history',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    method: text('method').notNull(),
    url: text('url').notNull(),
    headers: jsonb('headers').$type<Record<string, string>>().default({}),
    body: text('body'),
    responseStatus: integer('response_status'),
    responseHeaders: jsonb('response_headers').$type<Record<string, string>>().default({}),
    responseBody: text('response_body'),
    durationMs: integer('duration_ms'),
    environmentId: text('environment_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('api_request_history_user_id_idx').on(t.userId),
    index('api_request_history_workspace_user_created_idx').on(
      t.workspaceId,
      t.userId,
      t.createdAt,
    ),
  ],
)

export const apiEnvironmentsRelations = relations(apiEnvironments, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiEnvironments.workspaceId],
    references: [workspaces.id],
  }),
}))

export const apiAuthConfigsRelations = relations(apiAuthConfigs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiAuthConfigs.workspaceId],
    references: [workspaces.id],
  }),
}))

export const apiRequestHistoryRelations = relations(apiRequestHistory, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiRequestHistory.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [apiRequestHistory.userId],
    references: [users.id],
  }),
}))

// ─── F17: Document Templates ────────────────────────────────────

export const templateCategoryEnum = pgEnum('template_category', [
  'getting-started',
  'api-reference',
  'changelog',
  'migration-guide',
  'tutorial',
  'troubleshooting',
  'custom',
])

export const documentTemplates = pgTable(
  'document_templates',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: templateCategoryEnum('category').notNull().default('custom'),
    content: text('content').notNull().default(''),
    thumbnail: text('thumbnail'),
    isBuiltIn: boolean('is_built_in').notNull().default(false),
    usageCount: integer('usage_count').notNull().default(0),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('document_templates_workspace_id_idx').on(t.workspaceId),
    index('document_templates_category_idx').on(t.category),
  ],
)

export const documentTemplatesRelations = relations(
  documentTemplates,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [documentTemplates.workspaceId],
      references: [workspaces.id],
    }),
    creator: one(users, {
      fields: [documentTemplates.createdBy],
      references: [users.id],
    }),
  }),
)

// ─── F18: Real-time Presence ────────────────────────────────────

export const activeEditors = pgTable(
  'active_editors',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cursorPosition: integer('cursor_position'),
    lastSeenAt: timestamp('last_seen_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('active_editors_doc_user_idx').on(t.documentId, t.userId),
    index('active_editors_document_id_idx').on(t.documentId),
    index('active_editors_last_seen_at_idx').on(t.lastSeenAt),
  ],
)

export const activeEditorsRelations = relations(activeEditors, ({ one }) => ({
  document: one(documents, {
    fields: [activeEditors.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [activeEditors.userId],
    references: [users.id],
  }),
}))

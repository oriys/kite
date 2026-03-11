import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  primaryKey,
  index,
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
  ],
)

export const docAnnotationStatusEnum = pgEnum('doc_annotation_status', [
  'open',
  'resolved',
])

export const documentAnnotations = pgTable(
  'document_annotations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    quote: text('quote').notNull().default(''),
    body: text('body').notNull(),
    status: docAnnotationStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('document_annotations_document_id_idx').on(t.documentId),
    index('document_annotations_status_idx').on(t.status),
    index('document_annotations_created_by_idx').on(t.createdBy),
  ],
)

export const documentEvaluations = pgTable(
  'document_evaluations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('document_evaluations_document_id_idx').on(t.documentId),
    index('document_evaluations_score_idx').on(t.score),
    index('document_evaluations_created_by_idx').on(t.createdBy),
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
  documentAnnotations: many(documentAnnotations),
  documentEvaluations: many(documentEvaluations),
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
  annotations: many(documentAnnotations),
  evaluations: many(documentEvaluations),
}))

export const documentAnnotationsRelations = relations(
  documentAnnotations,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentAnnotations.documentId],
      references: [documents.id],
    }),
    creator: one(users, {
      fields: [documentAnnotations.createdBy],
      references: [users.id],
    }),
  }),
)

export const documentEvaluationsRelations = relations(
  documentEvaluations,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentEvaluations.documentId],
      references: [documents.id],
    }),
    creator: one(users, {
      fields: [documentEvaluations.createdBy],
      references: [users.id],
    }),
  }),
)

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

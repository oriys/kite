import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './schema-workspace'
import { users } from './schema-auth'

export const knowledgeSourceTypeEnum = pgEnum('knowledge_source_type', [
  'document',
  'pdf',
  'url',
  'markdown',
  'faq',
  'openapi',
  'graphql',
  'zip',
  'asyncapi',
  'protobuf',
  'rst',
  'asciidoc',
  'csv',
  'sql_ddl',
  'typescript_defs',
  'postman',
])

export const knowledgeSourceStatusEnum = pgEnum('knowledge_source_status', [
  'pending',
  'processing',
  'cancelled',
  'ready',
  'error',
  'archived',
])

export const knowledgeSources = pgTable(
  'knowledge_sources',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceType: knowledgeSourceTypeEnum('source_type').notNull(),
    status: knowledgeSourceStatusEnum('status').notNull().default('pending'),
    title: text('title').notNull(),
    sourceUrl: text('source_url'),
    rawContent: text('raw_content').notNull().default(''),
    contentHash: text('content_hash'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    errorMessage: text('error_message'),
    stopRequestedAt: timestamp('stop_requested_at', { mode: 'date' }),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { mode: 'date' }),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('knowledge_sources_workspace_id_idx').on(t.workspaceId),
    index('knowledge_sources_status_idx').on(t.workspaceId, t.status),
    index('knowledge_sources_type_idx').on(t.workspaceId, t.sourceType),
  ],
)

export const knowledgeSourcesRelations = relations(
  knowledgeSources,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [knowledgeSources.workspaceId],
      references: [workspaces.id],
    }),
    creator: one(users, {
      fields: [knowledgeSources.createdBy],
      references: [users.id],
    }),
  }),
)

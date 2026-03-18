import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  customType,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './schema-auth'
import { workspaces } from './schema-workspace'
import { documents } from './schema-documents'
import { knowledgeSources } from './schema-knowledge'
import type { ChatMessageAttribution } from './ai-chat-shared'

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
    ragEnabled: boolean('rag_enabled').notNull().default(true),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
)

// Dimension must match EMBEDDING_VECTOR_DIMENSION in lib/ai-config.ts
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
      .references(() => documents.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    chunkText: text('chunk_text').notNull(),
    sectionPath: text('section_path'),
    heading: text('heading'),
    knowledgeSourceId: text('knowledge_source_id').references(
      () => knowledgeSources.id,
      { onDelete: 'cascade' },
    ),
    embedding: vector1536('embedding'),
    /** Tracks which embedding model generated the vector (for space isolation) */
    embeddingModelId: text('embedding_model_id'),
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
    attribution: jsonb('attribution').$type<ChatMessageAttribution>(),
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

export const mcpTransportTypeEnum = pgEnum('mcp_transport_type', [
  'stdio',
  'sse',
  'streamable_http',
])

export const mcpServerConfigs = pgTable(
  'mcp_server_configs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    transportType: mcpTransportTypeEnum('transport_type').notNull(),
    // stdio transport fields
    command: text('command'),
    args: jsonb('args').$type<string[]>().default([]),
    env: jsonb('env').$type<Record<string, string>>().default({}),
    // SSE / streamable-http transport fields
    url: text('url'),
    headers: jsonb('headers').$type<Record<string, string>>().default({}),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [index('mcp_server_configs_workspace_id_idx').on(t.workspaceId)],
)

export const mcpServerConfigsRelations = relations(
  mcpServerConfigs,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [mcpServerConfigs.workspaceId],
      references: [workspaces.id],
    }),
  }),
)

export const cliSkillSourceTypeEnum = pgEnum('cli_skill_source_type', [
  'github',
  'registry',
  'custom',
])

export const workspaceCliSkills = pgTable(
  'workspace_cli_skills',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    sourceType: cliSkillSourceTypeEnum('source_type').notNull(),
    source: text('source').notNull(),
    ref: text('ref'),
    computedHash: text('computed_hash'),
    prompt: text('prompt'),
    enabled: boolean('enabled').notNull().default(true),
    installedBy: text('installed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('workspace_cli_skills_workspace_slug_idx').on(
      t.workspaceId,
      t.slug,
    ),
    index('workspace_cli_skills_workspace_idx').on(t.workspaceId),
    index('workspace_cli_skills_enabled_idx').on(t.workspaceId, t.enabled),
  ],
)

export const workspaceCliSkillsRelations = relations(
  workspaceCliSkills,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceCliSkills.workspaceId],
      references: [workspaces.id],
    }),
    installer: one(users, {
      fields: [workspaceCliSkills.installedBy],
      references: [users.id],
    }),
  }),
)

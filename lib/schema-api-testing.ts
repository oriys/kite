import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './schema-auth'
import { workspaces } from './schema-workspace'

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

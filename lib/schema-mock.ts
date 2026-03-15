import { pgTable, text, boolean, integer, real, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { workspaces } from './schema-workspace'
import { openapiSources } from './schema-openapi'

export const mockServerConfigs = pgTable('mock_server_configs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  openapiSourceId: text('openapi_source_id').notNull().references(() => openapiSources.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').default(true).notNull(),
  delay: integer('delay').default(0).notNull(),
  errorRate: real('error_rate').default(0).notNull(),
  seed: integer('seed'),
  overrides: jsonb('overrides').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('mock_configs_workspace_idx').on(table.workspaceId),
  index('mock_configs_source_idx').on(table.openapiSourceId),
])

export const mockRequestLogs = pgTable('mock_request_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  configId: text('config_id').notNull().references(() => mockServerConfigs.id, { onDelete: 'cascade' }),
  method: text('method').notNull(),
  path: text('path').notNull(),
  statusCode: integer('status_code').notNull(),
  duration: integer('duration').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('mock_logs_config_idx').on(table.configId),
])

export const mockServerConfigsRelations = relations(mockServerConfigs, ({ one }) => ({
  workspace: one(workspaces, { fields: [mockServerConfigs.workspaceId], references: [workspaces.id] }),
  openapiSource: one(openapiSources, { fields: [mockServerConfigs.openapiSourceId], references: [openapiSources.id] }),
}))

export const mockRequestLogsRelations = relations(mockRequestLogs, ({ one }) => ({
  config: one(mockServerConfigs, { fields: [mockRequestLogs.configId], references: [mockServerConfigs.id] }),
}))

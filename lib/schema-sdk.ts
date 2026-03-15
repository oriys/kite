import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { workspaces } from './schema-workspace'
import { openapiSources } from './schema-openapi'

export const sdkConfigs = pgTable('sdk_configs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  openapiSourceId: text('openapi_source_id').notNull().references(() => openapiSources.id, { onDelete: 'cascade' }),
  language: text('language').notNull(),
  packageName: text('package_name').notNull(),
  version: text('version').default('1.0.0').notNull(),
  config: jsonb('config').default('{}').notNull(),
  generatedAt: timestamp('generated_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('sdk_configs_workspace_idx').on(table.workspaceId),
  index('sdk_configs_source_idx').on(table.openapiSourceId),
])

export const sdkConfigsRelations = relations(sdkConfigs, ({ one }) => ({
  workspace: one(workspaces, { fields: [sdkConfigs.workspaceId], references: [workspaces.id] }),
  openapiSource: one(openapiSources, { fields: [sdkConfigs.openapiSourceId], references: [openapiSources.id] }),
}))

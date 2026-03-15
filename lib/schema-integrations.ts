import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { workspaces } from './schema-workspace'
import { users } from './schema-auth'

export const integrationProviderEnum = pgEnum('integration_provider', [
  'slack',
  'github',
  'jira',
])

export const integrationStatusEnum = pgEnum('integration_status', [
  'connected',
  'disconnected',
  'error',
])

export const integrations = pgTable(
  'integrations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: integrationProviderEnum('provider').notNull(),
    displayName: text('display_name').notNull(),
    config: jsonb('config').notNull(),
    events: jsonb('events').notNull().$type<string[]>(),
    status: integrationStatusEnum('status').default('connected').notNull(),
    statusMessage: text('status_message'),
    enabled: boolean('enabled').default(true).notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('integrations_workspace_idx').on(table.workspaceId),
    index('integrations_provider_idx').on(table.provider),
  ],
)

export const integrationLogs = pgTable(
  'integration_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    integrationId: text('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    direction: text('direction').notNull(),
    payload: jsonb('payload'),
    status: text('status').notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('integration_logs_integration_idx').on(table.integrationId),
  ],
)

export const integrationsRelations = relations(integrations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [integrations.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [integrations.createdBy],
    references: [users.id],
  }),
}))

export const integrationLogsRelations = relations(
  integrationLogs,
  ({ one }) => ({
    integration: one(integrations, {
      fields: [integrationLogs.integrationId],
      references: [integrations.id],
    }),
  }),
)

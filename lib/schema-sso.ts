import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './schema-workspace'

export const ssoProviderEnum = pgEnum('sso_provider_type', ['oidc', 'saml'])

export const ssoConfigs = pgTable(
  'sso_configs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: ssoProviderEnum('provider').notNull(),
    displayName: text('display_name').notNull(),
    // OIDC fields
    issuerUrl: text('issuer_url'),
    clientId: text('client_id'),
    clientSecret: text('client_secret'),
    // SAML fields (future)
    metadataUrl: text('metadata_url'),
    metadataXml: text('metadata_xml'),
    entityId: text('entity_id'),
    acsUrl: text('acs_url'),
    // Behavior
    defaultRole: text('default_role').default('member').notNull(),
    autoProvision: boolean('auto_provision').default(true).notNull(),
    enforced: boolean('enforced').default(false).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('sso_configs_workspace_idx').on(table.workspaceId)],
)

export const ssoConfigsRelations = relations(ssoConfigs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [ssoConfigs.workspaceId],
    references: [workspaces.id],
  }),
}))

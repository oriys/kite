import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { workspaces } from './schema-workspace'
import { users } from './schema-auth'

export const apiTokens = pgTable('api_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull(),
  tokenPrefix: text('token_prefix').notNull(),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('api_tokens_workspace_idx').on(table.workspaceId),
  index('api_tokens_user_idx').on(table.userId),
  index('api_tokens_hash_idx').on(table.tokenHash),
])

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  workspace: one(workspaces, { fields: [apiTokens.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [apiTokens.userId], references: [users.id] }),
}))

import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './schema-workspace'

export const approvalPolicies = pgTable(
  'approval_policies',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    policyType: text('policy_type').notNull().default('standard'),
    config: jsonb('config').$type<{
      requiredApprovals?: number
      autoApproveMinorChanges?: boolean
      riskLevels?: { low: number; medium: number; high: number }
    }>().notNull().default({}),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('approval_policies_workspace_idx').on(t.workspaceId),
  ],
)

export const approvalPoliciesRelations = relations(approvalPolicies, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [approvalPolicies.workspaceId],
    references: [workspaces.id],
  }),
}))

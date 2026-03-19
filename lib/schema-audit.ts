import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './schema-auth'
import { workspaces } from './schema-workspace'

export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'publish',
  'archive',
  'approve',
  'reject',
  'request_changes',
  'status_change',
  'visibility_change',
  'login',
  'export',
  'invite',
  'member_add',
  'member_remove',
  'role_change',
  'team_create',
  'team_update',
  'team_delete',
])

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: auditActionEnum('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    resourceTitle: text('resource_title'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_resource_idx').on(t.resourceType, t.resourceId),
    index('audit_logs_created_at_idx').on(t.createdAt),
    index('audit_logs_workspace_actor_idx').on(t.workspaceId, t.actorId),
    index('audit_logs_workspace_action_created_idx').on(
      t.workspaceId,
      t.action,
      t.createdAt,
    ),
  ],
)

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [auditLogs.workspaceId],
    references: [workspaces.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}))

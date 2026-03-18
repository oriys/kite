import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  jsonb,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './schema-auth'
import { workspaces } from './schema-workspace'

export const notificationTypeEnum = pgEnum('notification_type', [
  'comment',
  'mention',
  'approval_request',
  'approval_decision',
  'status_change',
  'webhook_failure',
  'system',
])

export const notifications = pgTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    linkUrl: text('link_url'),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    actorId: text('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_recipient_id_idx').on(t.recipientId),
    index('notifications_workspace_id_idx').on(t.workspaceId),
    index('notifications_created_at_idx').on(t.createdAt),
    index('notifications_recipient_workspace_read_created_idx').on(
      t.recipientId,
      t.workspaceId,
      t.isRead,
      t.createdAt,
    ),
  ],
)

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
    relationName: 'recipient',
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'actor',
  }),
  workspace: one(workspaces, {
    fields: [notifications.workspaceId],
    references: [workspaces.id],
  }),
}))

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    commentEnabled: boolean('comment_enabled').notNull().default(true),
    mentionEnabled: boolean('mention_enabled').notNull().default(true),
    approvalEnabled: boolean('approval_enabled').notNull().default(true),
    statusChangeEnabled: boolean('status_change_enabled').notNull().default(true),
    webhookFailureEnabled: boolean('webhook_failure_enabled').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId] })],
)

export const userFeaturePreferences = pgTable(
  'user_feature_preferences',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    openApiEnabled: boolean('openapi_enabled').notNull().default(true),
    templatesEnabled: boolean('templates_enabled').notNull().default(true),
    aiWorkspaceEnabled: boolean('ai_workspace_enabled').notNull().default(true),
    analyticsEnabled: boolean('analytics_enabled').notNull().default(true),
    approvalsEnabled: boolean('approvals_enabled').notNull().default(true),
    webhooksEnabled: boolean('webhooks_enabled').notNull().default(true),
    linkHealthEnabled: boolean('link_health_enabled').notNull().default(true),
    quickInsertEnabled: boolean('quick_insert_enabled').notNull().default(true),
    navOrder: jsonb('nav_order').$type<string[]>(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId] })],
)

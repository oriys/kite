import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  integer,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './schema-workspace'
import { users } from './schema-auth'

export const channelTypeEnum = pgEnum('channel_type', [
  'email',
  'slack_webhook',
])

export const notificationChannels = pgTable(
  'notification_channels',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channelType: channelTypeEnum('channel_type').notNull(),
    name: text('name').notNull(),
    config: jsonb('config').notNull(),
    events: jsonb('events').$type<string[]>().notNull().default([]),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('notification_channels_workspace_idx').on(t.workspaceId),
    index('notification_channels_creator_idx').on(t.createdBy),
  ],
)

export const channelDeliveryStatusEnum = pgEnum('channel_delivery_status', [
  'pending',
  'sent',
  'failed',
])

export const channelDeliveries = pgTable(
  'channel_deliveries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    channelId: text('channel_id')
      .notNull()
      .references(() => notificationChannels.id, { onDelete: 'cascade' }),
    notificationType: text('notification_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: channelDeliveryStatusEnum('status').notNull().default('pending'),
    statusCode: integer('status_code'),
    errorMessage: text('error_message'),
    attemptCount: integer('attempt_count').notNull().default(0),
    deliveredAt: timestamp('delivered_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('channel_deliveries_channel_idx').on(t.channelId),
    index('channel_deliveries_status_idx').on(t.status),
  ],
)

export const notificationChannelsRelations = relations(
  notificationChannels,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [notificationChannels.workspaceId],
      references: [workspaces.id],
    }),
    creator: one(users, {
      fields: [notificationChannels.createdBy],
      references: [users.id],
    }),
    deliveries: many(channelDeliveries),
  }),
)

export const channelDeliveriesRelations = relations(
  channelDeliveries,
  ({ one }) => ({
    channel: one(notificationChannels, {
      fields: [channelDeliveries.channelId],
      references: [notificationChannels.id],
    }),
  }),
)

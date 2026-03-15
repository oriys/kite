import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './schema-auth'
import { workspaces } from './schema-workspace'

export const partnerGroups = pgTable(
  'partner_groups',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('partner_groups_workspace_id_idx').on(t.workspaceId),
  ],
)

export const partnerGroupMembers = pgTable(
  'partner_group_members',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => partnerGroups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
)

import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './schema-auth'
import { documents, docSnippets } from './schema-documents'

export const workspaces = pgTable('workspaces', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

export const memberRoleEnum = pgEnum('member_role', [
  'owner',
  'admin',
  'member',
  'guest',
])

export const memberStatusEnum = pgEnum('member_status', [
  'active',
  'disabled',
])

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull().default('member'),
    status: memberStatusEnum('status').notNull().default('active'),
    invitedBy: text('invited_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    joinedAt: timestamp('joined_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (wm) => [
    primaryKey({ columns: [wm.userId, wm.workspaceId] }),
    index('workspace_members_workspace_role_idx').on(wm.workspaceId, wm.role),
    index('workspace_members_workspace_status_idx').on(wm.workspaceId, wm.status),
  ],
)

export const inviteTypeEnum = pgEnum('invite_type', ['email', 'link'])

export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email'),
    role: memberRoleEnum('role').notNull().default('member'),
    token: text('token').notNull().unique(),
    type: inviteTypeEnum('type').notNull(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    acceptedAt: timestamp('accepted_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('workspace_invites_workspace_id_idx').on(t.workspaceId),
    index('workspace_invites_email_idx').on(t.email),
    index('workspace_invites_token_idx').on(t.token),
  ],
)

export const teams = pgTable(
  'teams',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    parentId: text('parent_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('teams_workspace_id_idx').on(t.workspaceId),
    index('teams_parent_id_idx').on(t.parentId),
  ],
)

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    index('team_members_team_id_idx').on(t.teamId),
    index('team_members_user_id_idx').on(t.userId),
  ],
)

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  invites: many(workspaceInvites),
  teams: many(teams),
  documents: many(documents),
  docSnippets: many(docSnippets),
}))

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    inviter: one(users, {
      fields: [workspaceMembers.invitedBy],
      references: [users.id],
      relationName: 'invitedMembers',
    }),
  }),
)

export const workspaceInvitesRelations = relations(
  workspaceInvites,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceInvites.workspaceId],
      references: [workspaces.id],
    }),
    inviter: one(users, {
      fields: [workspaceInvites.invitedBy],
      references: [users.id],
    }),
  }),
)

export const teamsRelations = relations(teams, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [teams.workspaceId],
    references: [workspaces.id],
  }),
  parent: one(teams, {
    fields: [teams.parentId],
    references: [teams.id],
    relationName: 'children',
  }),
  children: many(teams, { relationName: 'children' }),
  members: many(teamMembers),
}))

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}))

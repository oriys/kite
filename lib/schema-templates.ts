import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './schema-auth'
import { workspaces } from './schema-workspace'

export const templateCategoryEnum = pgEnum('template_category', [
  'getting-started',
  'api-reference',
  'changelog',
  'migration-guide',
  'tutorial',
  'troubleshooting',
  'custom',
])

export const documentTemplates = pgTable(
  'document_templates',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: templateCategoryEnum('category').notNull().default('custom'),
    content: text('content').notNull().default(''),
    thumbnail: text('thumbnail'),
    isBuiltIn: boolean('is_built_in').notNull().default(false),
    usageCount: integer('usage_count').notNull().default(0),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('document_templates_workspace_id_idx').on(t.workspaceId),
    index('document_templates_category_idx').on(t.category),
  ],
)

export const documentTemplatesRelations = relations(
  documentTemplates,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [documentTemplates.workspaceId],
      references: [workspaces.id],
    }),
    creator: one(users, {
      fields: [documentTemplates.createdBy],
      references: [users.id],
    }),
  }),
)

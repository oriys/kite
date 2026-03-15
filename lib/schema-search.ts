import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core'
import { workspaces } from './schema-workspace'

export const searchLogs = pgTable(
  'search_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    query: text('query').notNull(),
    resultCount: integer('result_count').notNull(),
    clickedDocumentId: text('clicked_document_id'),
    searchedAt: timestamp('searched_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('search_logs_workspace_id_idx').on(t.workspaceId),
    index('search_logs_searched_at_idx').on(t.searchedAt),
  ],
)

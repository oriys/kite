import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { workspaces } from './schema-workspace'
import { documents } from './schema-documents'

export const pageViews = pgTable(
  'page_views',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    documentId: text('document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    path: text('path').notNull(),
    referrer: text('referrer'),
    userAgent: text('user_agent'),
    sessionId: text('session_id'),
    userId: text('user_id'),
    country: text('country'),
    source: text('source').default('internal'),
    viewedAt: timestamp('viewed_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('page_views_workspace_doc_idx').on(
      t.workspaceId,
      t.documentId,
      t.viewedAt,
    ),
    index('page_views_workspace_date_idx').on(t.workspaceId, t.viewedAt),
    index('page_views_session_idx').on(t.sessionId),
  ],
)

export const pageViewsDaily = pgTable(
  'page_views_daily',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    documentId: text('document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    date: text('date').notNull(),
    views: integer('views').default(0).notNull(),
    uniqueSessions: integer('unique_sessions').default(0).notNull(),
    source: text('source').default('internal'),
  },
  (t) => [
    index('page_views_daily_workspace_date_idx').on(t.workspaceId, t.date),
    index('page_views_daily_doc_date_idx').on(t.documentId, t.date),
  ],
)

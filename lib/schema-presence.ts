import {
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './schema-auth'
import { documents } from './schema-documents'

export const activeEditors = pgTable(
  'active_editors',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cursorPosition: integer('cursor_position'),
    lastSeenAt: timestamp('last_seen_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('active_editors_doc_user_idx').on(t.documentId, t.userId),
    index('active_editors_document_id_idx').on(t.documentId),
    index('active_editors_last_seen_at_idx').on(t.lastSeenAt),
  ],
)

export const activeEditorsRelations = relations(activeEditors, ({ one }) => ({
  document: one(documents, {
    fields: [activeEditors.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [activeEditors.userId],
    references: [users.id],
  }),
}))

import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './schema-workspace'
import { openapiSources } from './schema-openapi'

export const lintSeverityEnum = pgEnum('lint_severity', [
  'error',
  'warning',
  'info',
  'hint',
])

export const lintRulesets = pgTable(
  'lint_rulesets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').default(''),
    rules: jsonb('rules').notNull(),
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('lint_rulesets_workspace_idx').on(table.workspaceId)],
)

export const lintResults = pgTable(
  'lint_results',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    openapiSourceId: text('openapi_source_id')
      .notNull()
      .references(() => openapiSources.id, { onDelete: 'cascade' }),
    rulesetId: text('ruleset_id').references(() => lintRulesets.id, {
      onDelete: 'set null',
    }),
    results: jsonb('results').notNull(),
    errorCount: integer('error_count').default(0).notNull(),
    warningCount: integer('warning_count').default(0).notNull(),
    infoCount: integer('info_count').default(0).notNull(),
    hintCount: integer('hint_count').default(0).notNull(),
    ranAt: timestamp('ran_at').defaultNow().notNull(),
  },
  (table) => [
    index('lint_results_source_idx').on(table.openapiSourceId),
    index('lint_results_ran_at_idx').on(table.ranAt),
  ],
)

export const lintRulesetsRelations = relations(lintRulesets, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [lintRulesets.workspaceId],
    references: [workspaces.id],
  }),
}))

export const lintResultsRelations = relations(lintResults, ({ one }) => ({
  openapiSource: one(openapiSources, {
    fields: [lintResults.openapiSourceId],
    references: [openapiSources.id],
  }),
  ruleset: one(lintRulesets, {
    fields: [lintResults.rulesetId],
    references: [lintRulesets.id],
  }),
}))

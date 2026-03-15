import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { workspaces } from './schema-workspace'
import { visibilityEnum } from './schema-documents'

export const openapiSourceTypeEnum = pgEnum('openapi_source_type', [
  'upload',
  'url',
])

export const openapiSources = pgTable(
  'openapi_sources',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sourceType: openapiSourceTypeEnum('source_type').notNull(),
    sourceUrl: text('source_url'),
    rawContent: text('raw_content').notNull(),
    parsedVersion: text('parsed_version'),
    openapiVersion: text('openapi_version'),
    checksum: text('checksum').notNull(),
    lastSyncedAt: timestamp('last_synced_at', { mode: 'date' }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('openapi_sources_workspace_id_idx').on(t.workspaceId),
  ],
)

export const openapiSnapshots = pgTable(
  'openapi_snapshots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => openapiSources.id, { onDelete: 'cascade' }),
    rawContent: text('raw_content').notNull(),
    parsedVersion: text('parsed_version'),
    checksum: text('checksum').notNull(),
    snapshotAt: timestamp('snapshot_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('openapi_snapshots_source_id_idx').on(t.sourceId),
  ],
)

export const apiEndpoints = pgTable(
  'api_endpoints',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => openapiSources.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    method: text('method').notNull(),
    operationId: text('operation_id'),
    summary: text('summary'),
    description: text('description'),
    tags: jsonb('tags').$type<string[]>().default([]),
    parameters: jsonb('parameters').$type<Record<string, unknown>[]>().default([]),
    requestBody: jsonb('request_body').$type<Record<string, unknown> | null>(),
    responses: jsonb('responses').$type<Record<string, unknown>>().default({}),
    deprecated: boolean('deprecated').notNull().default(false),
    visibility: visibilityEnum('visibility').notNull().default('public'),
    documentId: text('document_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('api_endpoints_source_id_idx').on(t.sourceId),
    index('api_endpoints_method_path_idx').on(t.method, t.path),
  ],
)

export const apiVersionStatusEnum = pgEnum('api_version_status', [
  'active',
  'beta',
  'deprecated',
  'retired',
])

export const apiVersions = pgTable(
  'api_versions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    slug: text('slug').notNull(),
    baseUrl: text('base_url'),
    status: apiVersionStatusEnum('status').notNull().default('active'),
    isDefault: boolean('is_default').notNull().default(false),
    sourceId: text('source_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    uniqueIndex('api_versions_workspace_slug_idx')
      .on(t.workspaceId, t.slug)
      .where(sql`${t.deletedAt} is null`),
    index('api_versions_workspace_id_idx').on(t.workspaceId),
  ],
)

export const openapiSourcesRelations = relations(openapiSources, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [openapiSources.workspaceId],
    references: [workspaces.id],
  }),
  snapshots: many(openapiSnapshots),
  endpoints: many(apiEndpoints),
}))

export const openapiSnapshotsRelations = relations(openapiSnapshots, ({ one }) => ({
  source: one(openapiSources, {
    fields: [openapiSnapshots.sourceId],
    references: [openapiSources.id],
  }),
}))

export const apiEndpointsRelations = relations(apiEndpoints, ({ one }) => ({
  source: one(openapiSources, {
    fields: [apiEndpoints.sourceId],
    references: [openapiSources.id],
  }),
}))

export const apiVersionsRelations = relations(apiVersions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiVersions.workspaceId],
    references: [workspaces.id],
  }),
}))

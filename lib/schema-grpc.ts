import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './schema-workspace'

export const grpcSourceTypeEnum = pgEnum('grpc_source_type', [
  'proto_file',
  'proto_zip',
  'nacos',
  'etcd',
])

export const grpcSources = pgTable(
  'grpc_sources',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sourceType: grpcSourceTypeEnum('source_type').notNull(),
    sourceConfig: jsonb('source_config').$type<Record<string, unknown>>(),
    rawContent: text('raw_content').notNull(),
    checksum: text('checksum').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { mode: 'date' }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
  },
  (t) => [
    index('grpc_sources_workspace_id_idx').on(t.workspaceId),
  ],
)

export const grpcServices = pgTable(
  'grpc_services',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceId: text('source_id')
      .notNull()
      .references(() => grpcSources.id, { onDelete: 'cascade' }),
    packageName: text('package_name').notNull(),
    serviceName: text('service_name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('grpc_services_source_id_idx').on(t.sourceId),
  ],
)

export const grpcMethods = pgTable(
  'grpc_methods',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    serviceId: text('service_id')
      .notNull()
      .references(() => grpcServices.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => grpcSources.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    inputType: jsonb('input_type').$type<Record<string, unknown>>().notNull(),
    outputType: jsonb('output_type').$type<Record<string, unknown>>().notNull(),
    clientStreaming: boolean('client_streaming').notNull().default(false),
    serverStreaming: boolean('server_streaming').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('grpc_methods_service_id_idx').on(t.serviceId),
    index('grpc_methods_source_id_idx').on(t.sourceId),
  ],
)

export const grpcSourcesRelations = relations(grpcSources, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [grpcSources.workspaceId],
    references: [workspaces.id],
  }),
  services: many(grpcServices),
  methods: many(grpcMethods),
}))

export const grpcServicesRelations = relations(grpcServices, ({ one, many }) => ({
  source: one(grpcSources, {
    fields: [grpcServices.sourceId],
    references: [grpcSources.id],
  }),
  methods: many(grpcMethods),
}))

export const grpcMethodsRelations = relations(grpcMethods, ({ one }) => ({
  service: one(grpcServices, {
    fields: [grpcMethods.serviceId],
    references: [grpcServices.id],
  }),
  source: one(grpcSources, {
    fields: [grpcMethods.sourceId],
    references: [grpcSources.id],
  }),
}))

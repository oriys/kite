import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  real,
  customType,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './schema-workspace'

// Reuse the same vector type from schema-ai.ts
const vector1536 = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return 'vector(1536)'
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`
  },
  fromDriver(value: unknown) {
    return JSON.parse(value as string) as number[]
  },
})

/**
 * Entity types relevant to API documentation.
 */
export const kgEntityTypeEnum = pgEnum('kg_entity_type', [
  'endpoint',
  'parameter',
  'schema',
  'permission',
  'error_code',
  'webhook',
  'resource',
  'data_type',
  'concept',
  'other',
])

/**
 * Knowledge graph entities extracted from documents.
 * Each entity has a unified description (merged from all chunk mentions)
 * and a vector embedding for semantic search.
 */
export const kgEntities = pgTable(
  'kg_entities',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    entityType: kgEntityTypeEnum('entity_type').notNull().default('other'),
    description: text('description').notNull().default(''),
    embedding: vector1536('embedding'),
    /** Tracks which embedding model generated the vector */
    embeddingModelId: text('embedding_model_id'),
    /** Chunk IDs that reference this entity (semicolon-separated) */
    sourceChunkIds: text('source_chunk_ids').notNull().default(''),
    /** Full chunk ID list before capping/truncation (semicolon-separated) */
    allSourceChunkIds: text('all_source_chunk_ids').notNull().default(''),
    /** Document IDs that contain this entity (semicolon-separated) */
    sourceDocumentIds: text('source_document_ids').notNull().default(''),
    /** Full document ID list before capping/truncation (semicolon-separated) */
    allSourceDocumentIds: text('all_source_document_ids').notNull().default(''),
    /** Number of distinct chunks referencing this entity */
    mentionCount: integer('mention_count').notNull().default(1),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('kg_entities_workspace_id_idx').on(t.workspaceId),
    uniqueIndex('kg_entities_workspace_name_idx').on(t.workspaceId, t.nameNormalized),
    index('kg_entities_entity_type_idx').on(t.workspaceId, t.entityType),
  ],
)

export const kgEntitiesRelations = relations(kgEntities, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [kgEntities.workspaceId],
    references: [workspaces.id],
  }),
}))

/**
 * Knowledge graph relations between entities.
 * Each relation has a description and vector embedding.
 * Stored as undirected: sourceEntity < targetEntity (alphabetically normalized).
 */
export const kgRelations = pgTable(
  'kg_relations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sourceEntityId: text('source_entity_id')
      .notNull()
      .references(() => kgEntities.id, { onDelete: 'cascade' }),
    targetEntityId: text('target_entity_id')
      .notNull()
      .references(() => kgEntities.id, { onDelete: 'cascade' }),
    description: text('description').notNull().default(''),
    keywords: text('keywords').notNull().default(''),
    embedding: vector1536('embedding'),
    /** Tracks which embedding model generated the vector */
    embeddingModelId: text('embedding_model_id'),
    weight: real('weight').notNull().default(1.0),
    /** Chunk IDs that reference this relation (semicolon-separated) */
    sourceChunkIds: text('source_chunk_ids').notNull().default(''),
    /** Full chunk ID list before capping/truncation (semicolon-separated) */
    allSourceChunkIds: text('all_source_chunk_ids').notNull().default(''),
    mentionCount: integer('mention_count').notNull().default(1),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('kg_relations_workspace_id_idx').on(t.workspaceId),
    index('kg_relations_source_entity_idx').on(t.sourceEntityId),
    index('kg_relations_target_entity_idx').on(t.targetEntityId),
    uniqueIndex('kg_relations_workspace_pair_idx').on(
      t.workspaceId,
      t.sourceEntityId,
      t.targetEntityId,
    ),
  ],
)

export const kgRelationsRelations = relations(kgRelations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [kgRelations.workspaceId],
    references: [workspaces.id],
  }),
  sourceEntity: one(kgEntities, {
    fields: [kgRelations.sourceEntityId],
    references: [kgEntities.id],
    relationName: 'sourceEntity',
  }),
  targetEntity: one(kgEntities, {
    fields: [kgRelations.targetEntityId],
    references: [kgEntities.id],
    relationName: 'targetEntity',
  }),
}))

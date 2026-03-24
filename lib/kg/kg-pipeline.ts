/**
 * Knowledge Graph construction pipeline.
 *
 * Orchestrates entity extraction, merging, and storage during document embedding.
 * Integrates with the existing embedding pipeline.
 */

import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { kgEntities, kgRelations, type kgEntityTypeEnum } from '@/lib/schema-kg'
import {
  extractEntitiesFromChunk,
  normalizeEntityName,
  type ExtractionResult,
} from './entity-extraction'
import {
  mergeEntityDescriptions,
  mergeRelationDescriptions,
  mergeSourceIds,
} from './entity-merging'
import {
  requestAiEmbedding,
  resolveEmbeddingProvider,
  type ResolvedAiProviderConfig,
} from '@/lib/ai-server'
import { logServerError } from '@/lib/server-errors'
import type { DocumentChunk } from '@/lib/chunker'

const KG_EXTRACTION_BATCH_SIZE = 4
const PUBLIC_SOURCE_ID_LIMIT = 300

/**
 * Extract entities/relations from document chunks and merge into knowledge graph.
 */
export async function buildKnowledgeGraph(input: {
  workspaceId: string
  documentId: string
  chunks: DocumentChunk[]
  provider: ResolvedAiProviderConfig
  modelId: string
  embeddingProvider?: { provider: ResolvedAiProviderConfig; modelId: string }
}) {
  if (input.chunks.length === 0) return { entities: 0, relations: 0 }

  // 1. Extract entities and relations from all chunks (in batches)
  const allExtractions: Array<{ chunkIndex: number; result: ExtractionResult }> = []

  for (let i = 0; i < input.chunks.length; i += KG_EXTRACTION_BATCH_SIZE) {
    const batch = input.chunks.slice(i, i + KG_EXTRACTION_BATCH_SIZE)
    const results = await Promise.all(
      batch.map((chunk) =>
        extractEntitiesFromChunk({
          chunkText: chunk.chunkText,
          provider: input.provider,
          modelId: input.modelId,
        }).then((result) => ({ chunkIndex: chunk.chunkIndex, result })),
      ),
    )
    allExtractions.push(...results)
  }

  // 2. Aggregate: group entities/relations by name
  const entityMap = new Map<
    string,
    {
      name: string
      entityType: string
      descriptions: string[]
      chunkIds: string[]
      documentIds: Set<string>
    }
  >()

  const relationMap = new Map<
    string,
    {
      sourceEntityName: string
      targetEntityName: string
      descriptions: string[]
      allKeywords: string[]
      chunkIds: string[]
    }
  >()

  for (const extraction of allExtractions) {
    const chunkId = `${input.documentId}:${extraction.chunkIndex}`

    for (const entity of extraction.result.entities) {
      const key = normalizeEntityName(entity.name)
      const existing = entityMap.get(key)
      if (existing) {
        existing.descriptions.push(entity.description)
        existing.chunkIds.push(chunkId)
        existing.documentIds.add(input.documentId)
      } else {
        entityMap.set(key, {
          name: entity.name,
          entityType: entity.entityType,
          descriptions: [entity.description],
          chunkIds: [chunkId],
          documentIds: new Set([input.documentId]),
        })
      }
    }

    for (const relation of extraction.result.relations) {
      const srcKey = normalizeEntityName(relation.sourceEntity)
      const tgtKey = normalizeEntityName(relation.targetEntity)
      const [normSrc, normTgt] = srcKey <= tgtKey ? [srcKey, tgtKey] : [tgtKey, srcKey]
      const key = `${normSrc}::${normTgt}`

      const existing = relationMap.get(key)
      if (existing) {
        existing.descriptions.push(relation.description)
        existing.allKeywords.push(relation.keywords)
        existing.chunkIds.push(chunkId)
      } else {
        relationMap.set(key, {
          sourceEntityName: relation.sourceEntity,
          targetEntityName: relation.targetEntity,
          descriptions: [relation.description],
          allKeywords: [relation.keywords],
          chunkIds: [chunkId],
        })
      }
    }
  }

  // 3. Upsert entities into DB
  let entityCount = 0
  for (const [normalizedName, data] of entityMap) {
    try {
      const description = data.descriptions.join('\n---\n')
      const chunkIds = data.chunkIds.join(';')
      const documentIds = [...data.documentIds].join(';')

      // Check if entity already exists
      const existing = await db
        .select()
        .from(kgEntities)
        .where(
          and(
            eq(kgEntities.workspaceId, input.workspaceId),
            eq(kgEntities.nameNormalized, normalizedName),
          ),
        )
        .limit(1)

        if (existing.length > 0) {
          const entity = existing[0]
          const mergedDescription = await mergeEntityDescriptions({
            workspaceId: input.workspaceId,
            existingDescription: entity.description,
            newDescription: description,
            entityName: data.name,
            existingMentionCount: entity.mentionCount,
            provider: {
              provider: input.provider,
              modelId: input.modelId,
            },
          })
          const mergedAllSourceChunkIds = mergeSourceIds(
            entity.allSourceChunkIds || entity.sourceChunkIds,
            chunkIds,
            null,
          )
          const mergedAllSourceDocumentIds = mergeSourceIds(
            entity.allSourceDocumentIds || entity.sourceDocumentIds,
            documentIds,
            null,
          )

          await db
            .update(kgEntities)
            .set({
              description: mergedDescription,
              sourceChunkIds: mergeSourceIds(
                entity.sourceChunkIds,
                chunkIds,
                PUBLIC_SOURCE_ID_LIMIT,
              ),
              allSourceChunkIds: mergedAllSourceChunkIds,
              sourceDocumentIds: mergeSourceIds(
                entity.sourceDocumentIds,
                documentIds,
                PUBLIC_SOURCE_ID_LIMIT,
              ),
              allSourceDocumentIds: mergedAllSourceDocumentIds,
              mentionCount: entity.mentionCount + data.chunkIds.length,
              updatedAt: new Date(),
            })
            .where(eq(kgEntities.id, entity.id))
      } else {
        await db.insert(kgEntities).values({
          workspaceId: input.workspaceId,
          name: data.name,
          nameNormalized: normalizedName,
          entityType: data.entityType as (typeof kgEntityTypeEnum.enumValues)[number],
          description,
          sourceChunkIds: chunkIds,
          allSourceChunkIds: chunkIds,
          sourceDocumentIds: documentIds,
          allSourceDocumentIds: documentIds,
          mentionCount: data.chunkIds.length,
        })
      }
      entityCount++
    } catch (error) {
      logServerError('Failed to upsert KG entity', error, {
        workspaceId: input.workspaceId,
        entityName: data.name,
      })
    }
  }

  // 4. Upsert relations into DB
  let relationCount = 0
  for (const [, data] of relationMap) {
    try {
      const srcNorm = normalizeEntityName(data.sourceEntityName)
      const tgtNorm = normalizeEntityName(data.targetEntityName)

      // Find entity IDs
      const [srcEntity, tgtEntity] = await Promise.all([
        db
          .select({ id: kgEntities.id })
          .from(kgEntities)
          .where(
            and(
              eq(kgEntities.workspaceId, input.workspaceId),
              eq(kgEntities.nameNormalized, srcNorm),
            ),
          )
          .limit(1),
        db
          .select({ id: kgEntities.id })
          .from(kgEntities)
          .where(
            and(
              eq(kgEntities.workspaceId, input.workspaceId),
              eq(kgEntities.nameNormalized, tgtNorm),
            ),
          )
          .limit(1),
      ])

      if (!srcEntity[0] || !tgtEntity[0]) continue

      const sourceEntityId = srcEntity[0].id
      const targetEntityId = tgtEntity[0].id
      const description = data.descriptions.join('\n---\n')
      const keywords = [
        ...new Set(
          data.allKeywords
            .flatMap((k) => k.split(',').map((s) => s.trim()))
            .filter(Boolean),
        ),
      ].join(', ')
      const chunkIds = data.chunkIds.join(';')

      // Normalize order for undirected storage
      const [normSrcId, normTgtId] =
        sourceEntityId <= targetEntityId
          ? [sourceEntityId, targetEntityId]
          : [targetEntityId, sourceEntityId]

      const existing = await db
        .select()
        .from(kgRelations)
        .where(
          and(
            eq(kgRelations.workspaceId, input.workspaceId),
            eq(kgRelations.sourceEntityId, normSrcId),
            eq(kgRelations.targetEntityId, normTgtId),
          ),
        )
        .limit(1)

      if (existing.length > 0) {
        const rel = existing[0]
        const mergedDescription = await mergeRelationDescriptions({
          workspaceId: input.workspaceId,
          existingDescription: rel.description,
          newDescription: description,
          relationName: `${data.sourceEntityName} -> ${data.targetEntityName}`,
          existingMentionCount: rel.mentionCount,
          provider: {
            provider: input.provider,
            modelId: input.modelId,
          },
        })
        const mergedAllSourceChunkIds = mergeSourceIds(
          rel.allSourceChunkIds || rel.sourceChunkIds,
          chunkIds,
          null,
        )
        await db
          .update(kgRelations)
          .set({
            description: mergedDescription,
            keywords: [
              ...new Set(
                [...rel.keywords.split(', '), ...keywords.split(', ')].filter(Boolean),
              ),
            ].join(', '),
            sourceChunkIds: mergeSourceIds(
              rel.sourceChunkIds,
              chunkIds,
              PUBLIC_SOURCE_ID_LIMIT,
            ),
            allSourceChunkIds: mergedAllSourceChunkIds,
            mentionCount: rel.mentionCount + data.chunkIds.length,
            weight: rel.weight + data.chunkIds.length * 0.5,
            updatedAt: new Date(),
          })
          .where(eq(kgRelations.id, rel.id))
      } else {
        await db.insert(kgRelations).values({
          workspaceId: input.workspaceId,
          sourceEntityId: normSrcId,
          targetEntityId: normTgtId,
          description,
          keywords,
          sourceChunkIds: chunkIds,
          allSourceChunkIds: chunkIds,
          mentionCount: data.chunkIds.length,
          weight: 1.0 + data.chunkIds.length * 0.5,
        })
      }
      relationCount++
    } catch (error) {
      logServerError('Failed to upsert KG relation', error, {
        workspaceId: input.workspaceId,
      })
    }
  }

  return { entities: entityCount, relations: relationCount }
}

/**
 * Generate embeddings for entities and relations that don't have them yet.
 */
export async function embedKnowledgeGraphEntities(input: {
  workspaceId: string
  batchSize?: number
}) {
  const embeddingConfig = await resolveEmbeddingProvider(input.workspaceId)
  if (!embeddingConfig) return { embedded: 0 }

  const batchSize = input.batchSize ?? 20

  // Find entities without embeddings
  const unembedded = await db
    .select({
      id: kgEntities.id,
      name: kgEntities.name,
      description: kgEntities.description,
    })
    .from(kgEntities)
    .where(
      and(eq(kgEntities.workspaceId, input.workspaceId), sql`${kgEntities.embedding} IS NULL`),
    )
    .limit(batchSize)

  if (unembedded.length === 0) return { embedded: 0 }

  const texts = unembedded.map((e) => `${e.name}: ${e.description}`.slice(0, 2000))
  const { embeddings } = await requestAiEmbedding({
    provider: embeddingConfig.provider,
    texts,
    model: embeddingConfig.modelId,
  })

  let embedded = 0
  for (let i = 0; i < unembedded.length && i < embeddings.length; i++) {
    await db
      .update(kgEntities)
      .set({ embedding: embeddings[i], embeddingModelId: embeddingConfig.modelId, updatedAt: new Date() })
      .where(eq(kgEntities.id, unembedded[i].id))
    embedded++
  }

  // Also embed relations without embeddings
  const unembeddedRelations = await db
    .select({
      id: kgRelations.id,
      description: kgRelations.description,
      keywords: kgRelations.keywords,
    })
    .from(kgRelations)
    .where(
      and(
        eq(kgRelations.workspaceId, input.workspaceId),
        sql`${kgRelations.embedding} IS NULL`,
      ),
    )
    .limit(batchSize)

  if (unembeddedRelations.length > 0) {
    const relTexts = unembeddedRelations.map((r) =>
      `${r.keywords}: ${r.description}`.slice(0, 2000),
    )
    const relResult = await requestAiEmbedding({
      provider: embeddingConfig.provider,
      texts: relTexts,
      model: embeddingConfig.modelId,
    })

    for (
      let i = 0;
      i < unembeddedRelations.length && i < relResult.embeddings.length;
      i++
    ) {
      await db
        .update(kgRelations)
        .set({ embedding: relResult.embeddings[i], embeddingModelId: embeddingConfig.modelId, updatedAt: new Date() })
        .where(eq(kgRelations.id, unembeddedRelations[i].id))
      embedded++
    }
  }

  return { embedded }
}

/**
 * Remove all KG entities and relations for a specific document.
 * Used during document re-embedding to clean up stale graph data.
 */
export async function removeDocumentFromKnowledgeGraph(input: {
  workspaceId: string
  documentId: string
}) {
  // Find entities that reference this document
  const entities = await db
    .select({
      id: kgEntities.id,
      sourceDocumentIds: kgEntities.sourceDocumentIds,
      allSourceDocumentIds: kgEntities.allSourceDocumentIds,
      sourceChunkIds: kgEntities.sourceChunkIds,
      allSourceChunkIds: kgEntities.allSourceChunkIds,
      mentionCount: kgEntities.mentionCount,
    })
    .from(kgEntities)
    .where(
      and(
        eq(kgEntities.workspaceId, input.workspaceId),
        sql`${kgEntities.allSourceDocumentIds} LIKE ${'%' + input.documentId + '%'}`,
      ),
    )

  const chunkPrefix = `${input.documentId}:`
  const orphanedEntityIds: string[] = []

  for (const entity of entities) {
    // Remove this document's chunk references
    const remainingAllChunkIds = (entity.allSourceChunkIds || entity.sourceChunkIds)
      .split(';')
      .filter((id) => !id.startsWith(chunkPrefix))
      .join(';')

    const remainingAllDocIds = (entity.allSourceDocumentIds || entity.sourceDocumentIds)
      .split(';')
      .filter((id) => id !== input.documentId)
      .join(';')

    if (!remainingAllChunkIds && !remainingAllDocIds) {
      // Entity is orphaned — mark for deletion
      orphanedEntityIds.push(entity.id)
    } else {
      // Update references
      const removedCount = (entity.allSourceChunkIds || entity.sourceChunkIds)
        .split(';')
        .filter((id) => id.startsWith(chunkPrefix)).length
      await db
        .update(kgEntities)
        .set({
          sourceChunkIds: mergeSourceIds(
            '',
            remainingAllChunkIds,
            PUBLIC_SOURCE_ID_LIMIT,
          ),
          allSourceChunkIds: remainingAllChunkIds,
          sourceDocumentIds: mergeSourceIds(
            '',
            remainingAllDocIds,
            PUBLIC_SOURCE_ID_LIMIT,
          ),
          allSourceDocumentIds: remainingAllDocIds,
          mentionCount: Math.max(1, entity.mentionCount - removedCount),
          embedding: null, // Force re-embedding with updated description
          updatedAt: new Date(),
        })
        .where(eq(kgEntities.id, entity.id))
    }
  }

  const relations = await db
    .select({
      id: kgRelations.id,
      sourceChunkIds: kgRelations.sourceChunkIds,
      allSourceChunkIds: kgRelations.allSourceChunkIds,
      mentionCount: kgRelations.mentionCount,
    })
    .from(kgRelations)
    .where(
      and(
        eq(kgRelations.workspaceId, input.workspaceId),
        sql`${kgRelations.allSourceChunkIds} LIKE ${'%' + chunkPrefix + '%'}`,
      ),
    )

  for (const relation of relations) {
    const remainingAllChunkIds = (
      relation.allSourceChunkIds || relation.sourceChunkIds
    )
      .split(';')
      .filter((id) => !id.startsWith(chunkPrefix))
      .join(';')

    if (!remainingAllChunkIds) {
      await db.delete(kgRelations).where(eq(kgRelations.id, relation.id))
      continue
    }

    const removedCount = (relation.allSourceChunkIds || relation.sourceChunkIds)
      .split(';')
      .filter((id) => id.startsWith(chunkPrefix)).length

    await db
      .update(kgRelations)
      .set({
        sourceChunkIds: mergeSourceIds(
          '',
          remainingAllChunkIds,
          PUBLIC_SOURCE_ID_LIMIT,
        ),
        allSourceChunkIds: remainingAllChunkIds,
        mentionCount: Math.max(1, relation.mentionCount - removedCount),
        embedding: null,
        updatedAt: new Date(),
      })
      .where(eq(kgRelations.id, relation.id))
  }

  // Delete orphaned entities (cascades to relations via FK)
  if (orphanedEntityIds.length > 0) {
    for (const id of orphanedEntityIds) {
      await db.delete(kgEntities).where(eq(kgEntities.id, id))
    }
  }

  return {
    removedEntities: orphanedEntityIds.length,
    updatedEntities: entities.length - orphanedEntityIds.length,
  }
}

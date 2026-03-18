import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { requestAiEmbedding, resolveEmbeddingProvider } from '@/lib/ai-server'
import { estimateTokens } from '@/lib/chunker'
import { logServerError } from '@/lib/server-errors'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface KgEntityHit {
  id: string
  name: string
  entityType: string
  description: string
  similarity: number
  sourceChunkIds: string
  sourceDocumentIds: string
  mentionCount: number
}

export interface KgRelationHit {
  id: string
  description: string
  keywords: string
  weight: number
  similarity: number
  sourceEntityId: string
  targetEntityId: string
  sourceName: string
  targetName: string
  sourceChunkIds: string
  mentionCount: number
}

export interface ExpandedRelation {
  id: string
  description: string
  keywords: string
  weight: number
  sourceEntityId: string
  targetEntityId: string
  sourceName: string
  sourceDescription: string
  targetName: string
  targetDescription: string
  sourceChunkIds: string
}

export interface KgContextSections {
  entityContext: string
  relationContext: string
}

export interface KgRetrievalResult {
  entityContext: string
  relationContext: string
  entityCount: number
  relationCount: number
  sourceChunkIds: string[]
}

/* -------------------------------------------------------------------------- */
/*  1. searchKgEntities — Entity vector search                                */
/* -------------------------------------------------------------------------- */

export async function searchKgEntities(input: {
  workspaceId: string
  queryEmbedding: number[]
  topK?: number
  minSimilarity?: number
}): Promise<KgEntityHit[]> {
  const topK = input.topK ?? 10
  const minSimilarity = input.minSimilarity ?? 0.25
  const queryVector = `[${input.queryEmbedding.join(',')}]`

  try {
    const results = await db.execute(sql`
      SELECT
        e.id,
        e.name,
        e.entity_type,
        e.description,
        e.source_chunk_ids,
        e.source_document_ids,
        e.mention_count,
        1 - (e.embedding <=> ${queryVector}::vector) AS similarity
      FROM kg_entities e
      WHERE e.workspace_id = ${input.workspaceId}
        AND e.embedding IS NOT NULL
      ORDER BY e.embedding <=> ${queryVector}::vector
      LIMIT ${topK}
    `)

    return (results as unknown as Array<Record<string, unknown>>)
      .filter((row) => Number(row.similarity ?? 0) >= minSimilarity)
      .map((row) => ({
        id: row.id as string,
        name: row.name as string,
        entityType: row.entity_type as string,
        description: row.description as string,
        similarity: Number(row.similarity ?? 0),
        sourceChunkIds: row.source_chunk_ids as string,
        sourceDocumentIds: row.source_document_ids as string,
        mentionCount: Number(row.mention_count ?? 1),
      }))
  } catch (error) {
    logServerError('KG entity search failed', error, {
      workspaceId: input.workspaceId,
    })
    return []
  }
}

/* -------------------------------------------------------------------------- */
/*  2. searchKgRelations — Relation vector search                             */
/* -------------------------------------------------------------------------- */

export async function searchKgRelations(input: {
  workspaceId: string
  queryEmbedding: number[]
  topK?: number
  minSimilarity?: number
}): Promise<KgRelationHit[]> {
  const topK = input.topK ?? 10
  const minSimilarity = input.minSimilarity ?? 0.25
  const queryVector = `[${input.queryEmbedding.join(',')}]`

  try {
    const results = await db.execute(sql`
      SELECT
        r.id,
        r.description,
        r.keywords,
        r.weight,
        r.source_entity_id,
        r.target_entity_id,
        r.source_chunk_ids,
        r.mention_count,
        src.name AS source_name,
        tgt.name AS target_name,
        1 - (r.embedding <=> ${queryVector}::vector) AS similarity
      FROM kg_relations r
      JOIN kg_entities src ON src.id = r.source_entity_id
      JOIN kg_entities tgt ON tgt.id = r.target_entity_id
      WHERE r.workspace_id = ${input.workspaceId}
        AND r.embedding IS NOT NULL
      ORDER BY r.embedding <=> ${queryVector}::vector
      LIMIT ${topK}
    `)

    return (results as unknown as Array<Record<string, unknown>>)
      .filter((row) => Number(row.similarity ?? 0) >= minSimilarity)
      .map((row) => ({
        id: row.id as string,
        description: row.description as string,
        keywords: row.keywords as string,
        weight: Number(row.weight ?? 1),
        similarity: Number(row.similarity ?? 0),
        sourceEntityId: row.source_entity_id as string,
        targetEntityId: row.target_entity_id as string,
        sourceName: row.source_name as string,
        targetName: row.target_name as string,
        sourceChunkIds: row.source_chunk_ids as string,
        mentionCount: Number(row.mention_count ?? 1),
      }))
  } catch (error) {
    logServerError('KG relation search failed', error, {
      workspaceId: input.workspaceId,
    })
    return []
  }
}

/* -------------------------------------------------------------------------- */
/*  3. expandEntityRelations — Graph traversal from entities                  */
/* -------------------------------------------------------------------------- */

export async function expandEntityRelations(input: {
  workspaceId: string
  entityIds: string[]
  maxRelations?: number
}): Promise<ExpandedRelation[]> {
  if (input.entityIds.length === 0) return []
  const maxRelations = input.maxRelations ?? 20

  try {
    const results = await db.execute(sql`
      SELECT
        r.id,
        r.description,
        r.keywords,
        r.weight,
        r.source_entity_id,
        r.target_entity_id,
        r.source_chunk_ids,
        src.name AS source_name,
        src.description AS source_description,
        tgt.name AS target_name,
        tgt.description AS target_description
      FROM kg_relations r
      JOIN kg_entities src ON src.id = r.source_entity_id
      JOIN kg_entities tgt ON tgt.id = r.target_entity_id
      WHERE r.workspace_id = ${input.workspaceId}
        AND (
          r.source_entity_id IN ${sql.raw(`('${input.entityIds.join("','")}')`)}
          OR r.target_entity_id IN ${sql.raw(`('${input.entityIds.join("','")}')`)}
        )
      ORDER BY r.weight DESC
      LIMIT ${maxRelations}
    `)

    return (results as unknown as Array<Record<string, unknown>>).map(
      (row) => ({
        id: row.id as string,
        description: row.description as string,
        keywords: row.keywords as string,
        weight: Number(row.weight ?? 1),
        sourceEntityId: row.source_entity_id as string,
        targetEntityId: row.target_entity_id as string,
        sourceName: row.source_name as string,
        sourceDescription: row.source_description as string,
        targetName: row.target_name as string,
        targetDescription: row.target_description as string,
        sourceChunkIds: row.source_chunk_ids as string,
      }),
    )
  } catch (error) {
    logServerError('KG relation expansion failed', error, {
      workspaceId: input.workspaceId,
      entityCount: input.entityIds.length,
    })
    return []
  }
}

/* -------------------------------------------------------------------------- */
/*  4. buildKgContextSections — Format KG results into context strings        */
/* -------------------------------------------------------------------------- */

export function buildKgContextSections(input: {
  entities: KgEntityHit[]
  relations: Array<KgRelationHit | ExpandedRelation>
  entityTokenBudget: number
  relationTokenBudget: number
}): KgContextSections {
  let entityContext = ''
  let entityTokensUsed = 0

  for (const entity of input.entities) {
    const line = `**${entity.name}** (${entity.entityType}): ${entity.description}\n`
    const lineTokens = estimateTokens(line)
    if (entityTokensUsed + lineTokens > input.entityTokenBudget) break
    entityContext += line
    entityTokensUsed += lineTokens
  }

  let relationContext = ''
  let relationTokensUsed = 0

  for (const rel of input.relations) {
    const srcName =
      'sourceName' in rel ? rel.sourceName : (rel as KgRelationHit).sourceName
    const tgtName =
      'targetName' in rel ? rel.targetName : (rel as KgRelationHit).targetName
    const line = `**${srcName}** → **${tgtName}**: ${rel.description}\n`
    const lineTokens = estimateTokens(line)
    if (relationTokensUsed + lineTokens > input.relationTokenBudget) break
    relationContext += line
    relationTokensUsed += lineTokens
  }

  return {
    entityContext: entityContext.trimEnd(),
    relationContext: relationContext.trimEnd(),
  }
}

/* -------------------------------------------------------------------------- */
/*  5. retrieveKgContext — Main orchestrator                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_ENTITY_TOKEN_BUDGET = 2_000
const DEFAULT_RELATION_TOKEN_BUDGET = 2_000

export async function retrieveKgContext(input: {
  workspaceId: string
  query: string
  highLevelKeywords?: string[]
  lowLevelKeywords?: string[]
  entityTokenBudget?: number
  relationTokenBudget?: number
}): Promise<KgRetrievalResult> {
  const empty: KgRetrievalResult = {
    entityContext: '',
    relationContext: '',
    entityCount: 0,
    relationCount: 0,
    sourceChunkIds: [],
  }

  try {
    /* ---- 1. Resolve embedding provider --------------------------------- */
    const config = await resolveEmbeddingProvider(input.workspaceId)
    if (!config) return empty

    /* ---- 2. Batch embed: query + low-level + high-level keywords ------- */
    const lowText =
      input.lowLevelKeywords && input.lowLevelKeywords.length > 0
        ? input.lowLevelKeywords.join(', ')
        : ''
    const highText =
      input.highLevelKeywords && input.highLevelKeywords.length > 0
        ? input.highLevelKeywords.join(', ')
        : ''

    const textsToEmbed = [
      input.query,
      lowText || input.query,
      highText || input.query,
    ]

    const { embeddings } = await requestAiEmbedding({
      provider: config.provider,
      texts: textsToEmbed,
      model: config.modelId,
    })

    if (embeddings.length < 3) return empty

    // embeddings[0] = query, [1] = low-level keywords (or query fallback), [2] = high-level keywords (or query fallback)
    const lowLevelEmbedding = embeddings[1]
    const highLevelEmbedding = embeddings[2]

    /* ---- 3 & 4. Entity search + Relation search (parallel) ------------- */
    const [entityHits, relationHits] = await Promise.all([
      searchKgEntities({
        workspaceId: input.workspaceId,
        queryEmbedding: lowLevelEmbedding,
      }),
      searchKgRelations({
        workspaceId: input.workspaceId,
        queryEmbedding: highLevelEmbedding,
      }),
    ])

    /* ---- 5. Graph expansion from top entity hits ----------------------- */
    const topEntityIds = entityHits.slice(0, 5).map((e) => e.id)
    const expandedRelations = await expandEntityRelations({
      workspaceId: input.workspaceId,
      entityIds: topEntityIds,
    })

    /* ---- 6. Merge expanded + direct relation hits (deduplicate) -------- */
    const seenRelationIds = new Set(relationHits.map((r) => r.id))
    const mergedRelations: Array<KgRelationHit | ExpandedRelation> = [
      ...relationHits,
    ]
    for (const expanded of expandedRelations) {
      if (!seenRelationIds.has(expanded.id)) {
        seenRelationIds.add(expanded.id)
        mergedRelations.push(expanded)
      }
    }

    /* ---- 7. Build context sections ------------------------------------- */
    const entityTokenBudget =
      input.entityTokenBudget ?? DEFAULT_ENTITY_TOKEN_BUDGET
    const relationTokenBudget =
      input.relationTokenBudget ?? DEFAULT_RELATION_TOKEN_BUDGET

    const { entityContext, relationContext } = buildKgContextSections({
      entities: entityHits,
      relations: mergedRelations,
      entityTokenBudget,
      relationTokenBudget,
    })

    /* ---- 8. Collect source chunk IDs for boosting ---------------------- */
    const chunkIdSet = new Set<string>()

    for (const entity of entityHits) {
      if (entity.sourceChunkIds) {
        for (const id of entity.sourceChunkIds.split(';')) {
          const trimmed = id.trim()
          if (trimmed) chunkIdSet.add(trimmed)
        }
      }
    }

    for (const rel of mergedRelations) {
      if (rel.sourceChunkIds) {
        for (const id of rel.sourceChunkIds.split(';')) {
          const trimmed = id.trim()
          if (trimmed) chunkIdSet.add(trimmed)
        }
      }
    }

    return {
      entityContext,
      relationContext,
      entityCount: entityHits.length,
      relationCount: mergedRelations.length,
      sourceChunkIds: Array.from(chunkIdSet),
    }
  } catch (error) {
    logServerError('KG context retrieval failed', error, {
      workspaceId: input.workspaceId,
    })
    return empty
  }
}

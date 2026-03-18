/**
 * Entity and relation extraction from document chunks using LLM.
 *
 * Extracts entities (names, types, descriptions) and binary relations
 * from markdown content. Supports N-ary decomposition to binary pairs.
 */

import { requestAiTextCompletion, type ResolvedAiProviderConfig } from '@/lib/ai-server'
import { logServerError } from '@/lib/server-errors'

export interface ExtractedEntity {
  name: string
  entityType: string
  description: string
}

export interface ExtractedRelation {
  sourceEntity: string
  targetEntity: string
  description: string
  keywords: string
}

export interface ExtractionResult {
  entities: ExtractedEntity[]
  relations: ExtractedRelation[]
}

const ENTITY_TYPES = [
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
] as const

const ENTITY_EXTRACTION_SYSTEM_PROMPT = `You are a Knowledge Graph extraction specialist for API documentation.
Given a chunk of API documentation, extract entities and their relationships.

ENTITY TYPES: ${ENTITY_TYPES.join(', ')}

OUTPUT FORMAT (strict, one item per line):
ENTITY|name|type|description
RELATION|source_entity|target_entity|description|keywords

RULES:
1. Entity names: use consistent naming. PascalCase for types (MetaObject, AccessScope), lowercase for endpoints (/orders, /products), preserve original for proper nouns.
2. Entity types: classify each entity into one of the allowed types.
3. Descriptions: concise, factual, 3rd person. No pronouns like "this" or "it".
4. Relations: decompose N-ary relationships into binary pairs.
   Example: "A, B, and C collaborate on D" → A-B, A-C, B-C, A-D, B-D, C-D
5. Keywords: comma-separated keywords describing the relationship.
6. Keep entity names in their original language (Chinese stays Chinese, English stays English).
7. Prioritize API-relevant entities: endpoints, schemas, permissions, error codes.
8. Skip generic/obvious entities (e.g., "API", "documentation", "HTTP").
9. Output ONLY the formatted lines, no explanations or extra text.`

const ENTITY_EXTRACTION_USER_PROMPT = `Extract entities and relationships from this API documentation chunk:

---
{content}
---

Output entities and relationships:`

/**
 * Parse LLM extraction response into structured entities and relations.
 */
export function parseExtractionResponse(response: string): ExtractionResult {
  const entities: ExtractedEntity[] = []
  const relations: ExtractedRelation[] = []
  const seenEntities = new Set<string>()
  const seenRelations = new Set<string>()

  for (const line of response.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split('|').map((p) => p.trim())

    if (parts[0] === 'ENTITY' && parts.length >= 4) {
      const name = parts[1]
      const rawType = parts[2].toLowerCase().replace(/\s+/g, '_')
      const entityType = (ENTITY_TYPES as readonly string[]).includes(rawType) ? rawType : 'other'
      const description = parts.slice(3).join('|').trim()

      if (!name || name.length > 200) continue

      const key = name.toLowerCase()
      if (seenEntities.has(key)) continue
      seenEntities.add(key)

      entities.push({ name, entityType, description })
    }

    if (parts[0] === 'RELATION' && parts.length >= 5) {
      const sourceEntity = parts[1]
      const targetEntity = parts[2]
      const description = parts[3]
      const keywords = parts.slice(4).join('|').trim()

      if (!sourceEntity || !targetEntity) continue
      if (sourceEntity.length > 200 || targetEntity.length > 200) continue

      // Normalize to undirected: sort alphabetically
      const [normSrc, normTgt] =
        sourceEntity.toLowerCase() <= targetEntity.toLowerCase()
          ? [sourceEntity, targetEntity]
          : [targetEntity, sourceEntity]

      const key = `${normSrc.toLowerCase()}::${normTgt.toLowerCase()}`
      if (seenRelations.has(key)) continue
      seenRelations.add(key)

      relations.push({
        sourceEntity: normSrc,
        targetEntity: normTgt,
        description,
        keywords,
      })
    }
  }

  return { entities: entities.slice(0, 50), relations: relations.slice(0, 50) }
}

/**
 * Extract entities and relations from a document chunk using LLM.
 */
export async function extractEntitiesFromChunk(input: {
  chunkText: string
  provider: ResolvedAiProviderConfig
  modelId: string
}): Promise<ExtractionResult> {
  try {
    const { result } = await requestAiTextCompletion({
      provider: input.provider,
      model: input.modelId,
      temperature: 0.0,
      systemPrompt: ENTITY_EXTRACTION_SYSTEM_PROMPT,
      userPrompt: ENTITY_EXTRACTION_USER_PROMPT.replace(
        '{content}',
        input.chunkText.slice(0, 8000),
      ),
    })

    return parseExtractionResponse(result)
  } catch (error) {
    logServerError('Entity extraction from chunk failed', error)
    return { entities: [], relations: [] }
  }
}

/**
 * Normalize entity name for consistent storage and lookup.
 */
export function normalizeEntityName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_')
    .replace(/[^a-z0-9_\u4e00-\u9fff\u3400-\u4dbf]/g, '')
}

// For testing
export { ENTITY_EXTRACTION_SYSTEM_PROMPT as _ENTITY_EXTRACTION_SYSTEM_PROMPT }

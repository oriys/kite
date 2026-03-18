/**
 * Entity and relation description merging with LLM summarization.
 *
 * When an entity is mentioned across multiple chunks, descriptions are merged.
 * When merged descriptions exceed a threshold, LLM summarization is triggered.
 */

import {
  RAG_SUMMARY_CACHE_TTL_SECONDS,
} from '@/lib/ai-config'
import { requestAiTextCompletion, type ResolvedAiProviderConfig } from '@/lib/ai-server'
import { estimateTokens } from '@/lib/chunker'
import { createRagCacheKey, getRagCacheEntry, setRagCacheEntry } from '@/lib/rag/cache'
import { logServerError } from '@/lib/server-errors'

const FORCE_SUMMARY_THRESHOLD = 8
const SUMMARY_TOKEN_LIMIT = 1_200
const SUMMARY_FALLBACK_CHAR_LIMIT = 4_000
const SUMMARY_SEPARATOR = '\n---\n'

function buildSummarySystemPrompt(descriptionType: 'entity' | 'relation') {
  return [
    `Summarize the following ${descriptionType} descriptions into a single concise description.`,
    'Preserve the important facts, behavior, relationships, and caveats.',
    'Write in a neutral, factual tone.',
    'Output only the summary text with no preamble or bullets unless the source content truly requires them.',
  ].join(' ')
}

function splitDescriptionFragments(value: string) {
  return value
    .split(/\n---\n/g)
    .map((fragment) => fragment.trim())
    .filter(Boolean)
}

function dedupeDescriptionFragments(fragments: string[]) {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const fragment of fragments) {
    const normalized = fragment.trim()
    if (!normalized) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    deduped.push(normalized)
  }

  return deduped
}

function groupDescriptionFragments(fragments: string[]) {
  if (fragments.length <= 1) return [fragments]

  const groups: string[][] = []
  let currentGroup: string[] = []
  let currentTokens = 0

  for (const fragment of fragments) {
    const fragmentTokens = estimateTokens(fragment)

    if (
      currentGroup.length > 0 &&
      currentTokens + fragmentTokens > SUMMARY_TOKEN_LIMIT
    ) {
      groups.push(currentGroup)
      currentGroup = [fragment]
      currentTokens = fragmentTokens
      continue
    }

    currentGroup.push(fragment)
    currentTokens += fragmentTokens
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  if (groups.length > 1) {
    const lastGroup = groups.at(-1)
    const penultimateGroup = groups.at(-2)
    if (lastGroup && penultimateGroup && lastGroup.length === 1) {
      penultimateGroup.push(lastGroup[0])
      groups.pop()
    }
  }

  return groups
}

async function summarizeDescriptionBatch(input: {
  workspaceId: string
  descriptionType: 'entity' | 'relation'
  name: string
  fragments: string[]
  provider: { provider: ResolvedAiProviderConfig; modelId: string }
}) {
  const cacheKey = createRagCacheKey([
    'summary',
    input.descriptionType,
    input.name,
    input.fragments,
  ])

  const cached = await getRagCacheEntry<{ summary?: string }>({
    workspaceId: input.workspaceId,
    cacheType: 'summary',
    cacheKey,
  })
  if (cached?.summary?.trim()) {
    return cached.summary.trim()
  }

  const userPrompt = [
    `${input.descriptionType === 'entity' ? 'Entity' : 'Relation'}: ${input.name}`,
    '',
    'Descriptions to merge:',
    input.fragments.join(SUMMARY_SEPARATOR),
  ].join('\n')

  const { result } = await requestAiTextCompletion({
    provider: input.provider.provider,
    model: input.provider.modelId,
    temperature: 0.1,
    systemPrompt: buildSummarySystemPrompt(input.descriptionType),
    userPrompt,
  })

  const summary = result.trim() || input.fragments.join(SUMMARY_SEPARATOR)
  void setRagCacheEntry({
    workspaceId: input.workspaceId,
    cacheType: 'summary',
    cacheKey,
    payload: { summary },
    ttlSeconds: RAG_SUMMARY_CACHE_TTL_SECONDS,
  })
  return summary
}

async function mergeDescriptions(input: {
  workspaceId: string
  descriptionType: 'entity' | 'relation'
  existingDescription: string
  newDescription: string
  name: string
  existingMentionCount: number
  provider?: { provider: ResolvedAiProviderConfig; modelId: string }
}) {
  const fragments = dedupeDescriptionFragments([
    ...splitDescriptionFragments(input.existingDescription),
    ...splitDescriptionFragments(input.newDescription),
  ])

  if (fragments.length === 0) return ''
  if (fragments.length === 1) return fragments[0]

  const joined = fragments.join(SUMMARY_SEPARATOR)
  const combinedTokens = estimateTokens(joined)
  const descriptionCount = Math.max(
    fragments.length,
    input.existingMentionCount + splitDescriptionFragments(input.newDescription).length,
  )

  if (
    descriptionCount < FORCE_SUMMARY_THRESHOLD &&
    combinedTokens < SUMMARY_TOKEN_LIMIT
  ) {
    return joined
  }

  if (!input.provider) {
    return joined.slice(0, SUMMARY_FALLBACK_CHAR_LIMIT)
  }

  try {
    let current = fragments

    while (current.length > 1) {
      const currentJoined = current.join(SUMMARY_SEPARATOR)
      const currentTokens = estimateTokens(currentJoined)

      if (
        current.length < FORCE_SUMMARY_THRESHOLD &&
        currentTokens < SUMMARY_TOKEN_LIMIT
      ) {
        return currentJoined
      }

      const groups = groupDescriptionFragments(current)
      const nextPass: string[] = []

      for (const group of groups) {
        if (group.length <= 1) {
          nextPass.push(group[0] ?? '')
          continue
        }

        nextPass.push(
          await summarizeDescriptionBatch({
            workspaceId: input.workspaceId,
            descriptionType: input.descriptionType,
            name: input.name,
            fragments: group,
            provider: input.provider,
          }),
        )
      }

      const dedupedNext = dedupeDescriptionFragments(nextPass)
      if (dedupedNext.length >= current.length) {
        return dedupedNext.join(SUMMARY_SEPARATOR).slice(0, SUMMARY_FALLBACK_CHAR_LIMIT)
      }

      current = dedupedNext
    }

    return current[0] ?? joined.slice(0, SUMMARY_FALLBACK_CHAR_LIMIT)
  } catch (error) {
    logServerError('Description summarization failed', error, {
      name: input.name,
      descriptionType: input.descriptionType,
    })
    return joined.slice(0, SUMMARY_FALLBACK_CHAR_LIMIT)
  }
}

/**
 * Merge two entity descriptions. If the combined description is too long,
 * use LLM to summarize.
 */
export async function mergeEntityDescriptions(input: {
  workspaceId: string
  existingDescription: string
  newDescription: string
  entityName: string
  existingMentionCount: number
  provider?: { provider: ResolvedAiProviderConfig; modelId: string }
}): Promise<string> {
  if (!input.newDescription.trim()) return input.existingDescription
  if (!input.existingDescription.trim()) return input.newDescription.trim()

  return mergeDescriptions({
    workspaceId: input.workspaceId,
    descriptionType: 'entity',
    existingDescription: input.existingDescription,
    newDescription: input.newDescription,
    name: input.entityName,
    existingMentionCount: input.existingMentionCount,
    provider: input.provider,
  })
}

export async function mergeRelationDescriptions(input: {
  workspaceId: string
  existingDescription: string
  newDescription: string
  relationName: string
  existingMentionCount: number
  provider?: { provider: ResolvedAiProviderConfig; modelId: string }
}): Promise<string> {
  if (!input.newDescription.trim()) return input.existingDescription
  if (!input.existingDescription.trim()) return input.newDescription.trim()

  return mergeDescriptions({
    workspaceId: input.workspaceId,
    descriptionType: 'relation',
    existingDescription: input.existingDescription,
    newDescription: input.newDescription,
    name: input.relationName,
    existingMentionCount: input.existingMentionCount,
    provider: input.provider,
  })
}

/**
 * Merge source chunk ID lists (semicolon-separated, deduplicated).
 */
export function mergeSourceIds(
  existing: string,
  newIds: string,
  maxIds?: number | null,
): string {
  const all = new Set<string>()
  for (const id of existing.split(';').filter(Boolean)) all.add(id)
  for (const id of newIds.split(';').filter(Boolean)) all.add(id)
  const arr = [...all]
  if (typeof maxIds === 'number' && maxIds > 0 && arr.length > maxIds) {
    return arr.slice(-maxIds).join(';')
  }
  return arr.join(';')
}

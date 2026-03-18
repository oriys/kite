/**
 * Entity and relation description merging with LLM summarization.
 *
 * When an entity is mentioned across multiple chunks, descriptions are merged.
 * When merged descriptions exceed a threshold, LLM summarization is triggered.
 */

import { requestAiTextCompletion, type ResolvedAiProviderConfig } from '@/lib/ai-server'
import { estimateTokens } from '@/lib/chunker'
import { logServerError } from '@/lib/server-errors'

const FORCE_SUMMARY_THRESHOLD = 8
const SUMMARY_TOKEN_LIMIT = 1200
const SUMMARY_SYSTEM_PROMPT = `Summarize the following entity descriptions into a single concise description.
Preserve all key facts: what the entity is, its properties, relationships, and usage.
Use 3rd person, factual tone. Output only the summary, no explanations.`

/**
 * Merge two entity descriptions. If the combined description is too long,
 * use LLM to summarize.
 */
export async function mergeEntityDescriptions(input: {
  existingDescription: string
  newDescription: string
  entityName: string
  existingMentionCount: number
  provider?: { provider: ResolvedAiProviderConfig; modelId: string }
}): Promise<string> {
  if (!input.newDescription.trim()) return input.existingDescription
  if (!input.existingDescription.trim()) return input.newDescription.trim()

  const combined = `${input.existingDescription}\n---\n${input.newDescription}`
  const combinedTokens = estimateTokens(combined)
  const descriptionCount = input.existingMentionCount + 1

  // Below threshold: just concatenate with separator
  if (descriptionCount < FORCE_SUMMARY_THRESHOLD && combinedTokens < SUMMARY_TOKEN_LIMIT) {
    return combined
  }

  // Above threshold: summarize with LLM if available
  if (!input.provider) {
    // Truncate if no LLM available
    return combined.slice(0, 4000)
  }

  try {
    const { result } = await requestAiTextCompletion({
      provider: input.provider.provider,
      model: input.provider.modelId,
      temperature: 0.1,
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      userPrompt: `Entity: ${input.entityName}\n\nDescriptions to merge:\n${combined}`,
    })

    return result.trim() || combined.slice(0, 4000)
  } catch (error) {
    logServerError('Entity description summarization failed', error, {
      entityName: input.entityName,
    })
    return combined.slice(0, 4000)
  }
}

/**
 * Merge source chunk ID lists (semicolon-separated, deduplicated).
 */
export function mergeSourceIds(existing: string, newIds: string, maxIds = 300): string {
  const all = new Set<string>()
  for (const id of existing.split(';').filter(Boolean)) all.add(id)
  for (const id of newIds.split(';').filter(Boolean)) all.add(id)
  const arr = [...all]
  // FIFO: keep most recent if over limit
  return arr.slice(-maxIds).join(';')
}

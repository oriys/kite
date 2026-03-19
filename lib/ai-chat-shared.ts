export type ChatSourceRelationType = 'primary' | 'reference'
export type ChatSourceType = 'document' | 'knowledge_source'

export interface ChatSource {
  documentId: string
  documentSlug?: string | null
  sourceType?: ChatSourceType
  chunkId: string
  title: string
  preview: string
  relationType?: ChatSourceRelationType
  relationDescription?: string
}

export interface ChatMessageAttribution {
  usedMcp: boolean
  mcpToolNames: string[]
}

function uniqueStrings(values: Iterable<unknown>) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') continue
    const next = value.trim()
    if (!next || seen.has(next)) continue
    seen.add(next)
    result.push(next)
  }

  return result
}

export function collectMcpToolNamesFromSteps(
  steps: Array<{ toolCalls?: Array<{ toolName?: string }> }> | undefined,
) {
  if (!steps?.length) return []

  return uniqueStrings(
    steps.flatMap((step) =>
      Array.isArray(step.toolCalls)
        ? step.toolCalls.map((toolCall) => toolCall.toolName)
        : [],
    ),
  )
}

export function createChatMessageAttribution(input: {
  usedMcp?: boolean
  mcpToolNames?: Iterable<unknown>
}): ChatMessageAttribution | undefined {
  const mcpToolNames = uniqueStrings(input.mcpToolNames ?? [])
  const usedMcp = Boolean(input.usedMcp) || mcpToolNames.length > 0

  if (!usedMcp) {
    return undefined
  }

  return {
    usedMcp: true,
    mcpToolNames,
  }
}

export function normalizeChatMessageAttribution(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  return createChatMessageAttribution({
    usedMcp: record.usedMcp === true,
    mcpToolNames: Array.isArray(record.mcpToolNames)
      ? record.mcpToolNames
      : [],
  })
}

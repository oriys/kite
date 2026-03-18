import { DEFAULT_SERVER_RAG_QUERY_MODE } from '@/lib/ai-config'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'
import { normalizeRagQueryMode, type RagQueryMode } from './types'

export async function resolveWorkspaceRagQueryMode(input: {
  workspaceId: string
  requestedMode?: unknown
}): Promise<RagQueryMode> {
  if (typeof input.requestedMode === 'string' && input.requestedMode.trim()) {
    return normalizeRagQueryMode(input.requestedMode, DEFAULT_SERVER_RAG_QUERY_MODE)
  }

  try {
    const settings = await getAiWorkspaceSettings(input.workspaceId)
    const promptSettings =
      settings?.promptSettings &&
      typeof settings.promptSettings === 'object'
        ? (settings.promptSettings as Record<string, unknown>)
        : null

    return normalizeRagQueryMode(
      promptSettings?.defaultRagQueryMode,
      DEFAULT_SERVER_RAG_QUERY_MODE,
    )
  } catch {
    return DEFAULT_SERVER_RAG_QUERY_MODE
  }
}

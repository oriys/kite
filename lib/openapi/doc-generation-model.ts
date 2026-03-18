import {
  resolveAiModelSelection,
  resolveWorkspaceAiProviders,
} from '@/lib/ai-server'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'

export async function resolveDocGenerationSelection(
  workspaceId: string,
  requestedModelId?: string,
) {
  const [providers, workspaceSettings] = await Promise.all([
    resolveWorkspaceAiProviders(workspaceId),
    getAiWorkspaceSettings(workspaceId),
  ])

  return resolveAiModelSelection({
    requestedModelId,
    defaultModelId: workspaceSettings?.defaultModelId ?? null,
    enabledModelIds: Array.isArray(workspaceSettings?.enabledModelIds)
      ? workspaceSettings.enabledModelIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
    providers,
  })
}

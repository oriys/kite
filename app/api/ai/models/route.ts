import { NextResponse } from 'next/server'

import {
  createAiModelRef,
  createDefaultAiModelPreferences,
  sanitizeAiModelPreferences,
  sortAiCatalogModels,
} from '@/lib/ai'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { loadWorkspaceAiCatalog } from '@/lib/ai-server'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'

export async function GET() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const workspaceSettings = await getAiWorkspaceSettings(result.ctx.workspaceId)
  const catalog = await loadWorkspaceAiCatalog(result.ctx.workspaceId)
  const fetchedAt = new Date().toISOString()

  const providerDefault = catalog.providers.find((provider) => provider.defaultModelId)
  const fallbackDefaultModelId = providerDefault
    ? createAiModelRef(providerDefault.id, providerDefault.defaultModelId)
    : catalog.models[0]?.id ?? ''

  const storedEnabledModelIds = Array.isArray(workspaceSettings?.enabledModelIds)
    ? workspaceSettings.enabledModelIds.filter(
        (value): value is string => typeof value === 'string',
      )
    : []

  const preferences = workspaceSettings
    ? sanitizeAiModelPreferences(
        {
          activeModelId: workspaceSettings.defaultModelId?.trim() ?? '',
          enabledModelIds: storedEnabledModelIds,
        },
        catalog.models,
      )
    : createDefaultAiModelPreferences(
        catalog.models,
        fallbackDefaultModelId,
        storedEnabledModelIds,
      )

  return NextResponse.json({
    configured: catalog.configured,
    defaultModelId: preferences.activeModelId ?? '',
    enabledModelIds: preferences.enabledModelIds,
    fetchedAt,
    error: catalog.error,
    providers: catalog.providers,
    models: sortAiCatalogModels(catalog.models, preferences.activeModelId ?? ''),
  })
}

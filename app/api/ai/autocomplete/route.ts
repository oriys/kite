import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { MAX_AI_MODEL_ID_LENGTH } from '@/lib/ai'
import {
  AI_AUTOCOMPLETE_MAX_LANGUAGE_LENGTH,
  buildAiAutocompleteSystemPrompt,
  buildAiAutocompleteUserPrompt,
  isAiAutocompleteSurface,
  sliceAiAutocompletePrefix,
  sliceAiAutocompleteSuffix,
  type AiAutocompleteContext,
} from '@/lib/ai-autocomplete'
import { MAX_AI_SYSTEM_PROMPT_LENGTH } from '@/lib/ai-prompts'
import {
  AiCompletionError,
  requestAiTextCompletionStream,
  resolveAiModelSelection,
  resolveWorkspaceAiProviders,
} from '@/lib/ai-server'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const prefix = typeof body.prefix === 'string' ? sliceAiAutocompletePrefix(body.prefix) : ''
  const suffix = typeof body.suffix === 'string' ? sliceAiAutocompleteSuffix(body.suffix) : ''
  const requestedModel = typeof body.model === 'string' ? body.model.trim() : ''
  const requestedSystemPrompt =
    typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : ''
  const requestedLanguage = typeof body.language === 'string' ? body.language.trim() : ''
  const surfaceRaw = typeof body.surface === 'string' ? body.surface.trim() : ''

  if (!prefix && !suffix) {
    return badRequest('Autocomplete context is required')
  }
  if (requestedModel.length > MAX_AI_MODEL_ID_LENGTH) {
    return badRequest('Model identifier is too long')
  }
  if (requestedSystemPrompt.length > MAX_AI_SYSTEM_PROMPT_LENGTH) {
    return badRequest(
      `System prompt is too long. Limit is ${MAX_AI_SYSTEM_PROMPT_LENGTH} characters.`,
    )
  }
  if (requestedLanguage.length > AI_AUTOCOMPLETE_MAX_LANGUAGE_LENGTH) {
    return badRequest(
      `Language is too long. Limit is ${AI_AUTOCOMPLETE_MAX_LANGUAGE_LENGTH} characters.`,
    )
  }
  if (surfaceRaw && !isAiAutocompleteSurface(surfaceRaw)) {
    return badRequest('Invalid autocomplete surface')
  }

  const context: AiAutocompleteContext = {
    prefix,
    suffix,
    surface: isAiAutocompleteSurface(surfaceRaw) ? surfaceRaw : 'rich',
    language: requestedLanguage || 'markdown',
  }

  try {
    const [providers, workspaceSettings] = await Promise.all([
      resolveWorkspaceAiProviders(result.ctx.workspaceId),
      getAiWorkspaceSettings(result.ctx.workspaceId),
    ])

    const selection = resolveAiModelSelection({
      requestedModelId: requestedModel,
      defaultModelId: workspaceSettings?.defaultModelId ?? null,
      enabledModelIds: Array.isArray(workspaceSettings?.enabledModelIds)
        ? workspaceSettings.enabledModelIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
      providers,
    })

    if (!selection) {
      return NextResponse.json(
        {
          error:
            'No AI model is configured. Add a provider and choose a default model in AI Models.',
        },
        { status: 503 },
      )
    }

    const completion = await requestAiTextCompletionStream({
      provider: selection.provider,
      systemPrompt: buildAiAutocompleteSystemPrompt(requestedSystemPrompt),
      userPrompt: buildAiAutocompleteUserPrompt(context),
      model: selection.modelId,
      temperature: 0.2,
    })

    return new Response(completion.stream, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-ai-model': completion.model,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'The AI provider request failed.'
    const status = error instanceof AiCompletionError ? error.status : 502

    return NextResponse.json({ error: message }, { status })
  }
}

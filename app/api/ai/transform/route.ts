import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  AI_TRANSFORM_ACTIONS,
  MAX_AI_CUSTOM_PROMPT_LENGTH,
  MAX_AI_MODEL_ID_LENGTH,
  MAX_AI_TARGET_TONE_LENGTH,
  MAX_AI_TRANSFORM_TEXT_LENGTH,
  type AiTransformAction,
} from '@/lib/ai'
import {
  MAX_AI_ACTION_PROMPT_LENGTH,
  MAX_AI_SYSTEM_PROMPT_LENGTH,
  createDefaultAiPromptSettings,
  resolveAiPromptTemplate,
} from '@/lib/ai-prompts'
import {
  AiCompletionError,
  requestAiTextCompletionStream,
  requestAiTextCompletion,
  resolveAiModelSelection,
  resolveWorkspaceAiProviders,
} from '@/lib/ai-server'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'

function isAiTransformAction(value: string): value is AiTransformAction {
  return AI_TRANSFORM_ACTIONS.includes(value as AiTransformAction)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const action = typeof body.action === 'string' ? body.action : ''
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const requestedModel = typeof body.model === 'string' ? body.model.trim() : ''
  const targetLanguage =
    typeof body.targetLanguage === 'string' ? body.targetLanguage.trim() : ''
  const targetTone = typeof body.targetTone === 'string' ? body.targetTone.trim() : ''
  const requestedSystemPrompt =
    typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : ''
  const requestedActionPrompt =
    typeof body.actionPrompt === 'string' ? body.actionPrompt.trim() : ''
  const requestedCustomPrompt =
    typeof body.customPrompt === 'string' ? body.customPrompt.trim() : ''
  const streamRequested = body.stream === true

  if (!isAiTransformAction(action)) return badRequest('Invalid AI action')
  if (!text) return badRequest('Text is required')
  if (text.length > MAX_AI_TRANSFORM_TEXT_LENGTH) {
    return badRequest(
      `Text too long. Limit is ${MAX_AI_TRANSFORM_TEXT_LENGTH} characters.`,
    )
  }
  if (requestedModel.length > MAX_AI_MODEL_ID_LENGTH) {
    return badRequest('Model identifier is too long')
  }
  if (targetTone.length > MAX_AI_TARGET_TONE_LENGTH) {
    return badRequest(
      `Target tone is too long. Limit is ${MAX_AI_TARGET_TONE_LENGTH} characters.`,
    )
  }
  if (requestedSystemPrompt.length > MAX_AI_SYSTEM_PROMPT_LENGTH) {
    return badRequest(
      `System prompt is too long. Limit is ${MAX_AI_SYSTEM_PROMPT_LENGTH} characters.`,
    )
  }
  if (requestedActionPrompt.length > MAX_AI_ACTION_PROMPT_LENGTH) {
    return badRequest(
      `Action prompt is too long. Limit is ${MAX_AI_ACTION_PROMPT_LENGTH} characters.`,
    )
  }
  if (requestedCustomPrompt.length > MAX_AI_CUSTOM_PROMPT_LENGTH) {
    return badRequest(
      `Custom prompt is too long. Limit is ${MAX_AI_CUSTOM_PROMPT_LENGTH} characters.`,
    )
  }
  if (action === 'translate' && !targetLanguage) {
    return badRequest('Target language is required for translation')
  }
  if (action === 'tone' && !targetTone) {
    return badRequest('Target tone is required for tone changes')
  }
  if (action === 'custom' && !requestedCustomPrompt) {
    return badRequest('Custom prompt is required')
  }

  const defaultPrompts = createDefaultAiPromptSettings()
  const systemPrompt = requestedSystemPrompt || defaultPrompts.systemPrompt
  const actionPrompt = resolveAiPromptTemplate(
    requestedActionPrompt || defaultPrompts.actionPrompts[action],
    {
      targetLanguage: targetLanguage || undefined,
      targetTone: targetTone || undefined,
    },
  )

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

    const requestInput = {
      provider: selection.provider,
      systemPrompt,
      userPrompt: [
        `Task: ${actionPrompt}`,
        action === 'translate'
          ? `Target language: ${targetLanguage}`
          : action === 'tone'
            ? `Target tone: ${targetTone}`
          : action === 'custom'
            ? `User instruction: ${requestedCustomPrompt}`
            : 'Use the same language as the original text.',
        '',
        '<text>',
        text,
        '</text>',
      ].join('\n'),
      model: selection.modelId,
      temperature: action === 'diagram' ? 0.1 : 0.2,
    }

    if (action === 'diagram' || streamRequested) {
      const completion = await requestAiTextCompletionStream(requestInput)

      return new Response(completion.stream, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-ai-model': completion.model,
        },
      })
    }

    const completion = await requestAiTextCompletion(requestInput)
    return NextResponse.json(completion)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'The AI provider request failed.'
    const status = error instanceof AiCompletionError ? error.status : 502

    return NextResponse.json({ error: message }, { status })
  }
}

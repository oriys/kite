import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  AI_TRANSFORM_ACTIONS,
  MAX_AI_CUSTOM_PROMPT_LENGTH,
  MAX_AI_MODEL_ID_LENGTH,
  MAX_AI_TRANSFORM_TEXT_LENGTH,
  type AiTransformAction,
} from '@/lib/ai'
import {
  MAX_AI_ACTION_PROMPT_LENGTH,
  MAX_AI_SYSTEM_PROMPT_LENGTH,
  createDefaultAiPromptSettings,
  resolveAiPromptTemplate,
} from '@/lib/ai-prompts'
import { AiCompletionError, requestAiTextCompletion } from '@/lib/ai-server'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'

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
  const requestedSystemPrompt =
    typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : ''
  const requestedActionPrompt =
    typeof body.actionPrompt === 'string' ? body.actionPrompt.trim() : ''
  const requestedCustomPrompt =
    typeof body.customPrompt === 'string' ? body.customPrompt.trim() : ''

  if (!isAiTransformAction(action)) return badRequest('Invalid AI action')
  if (!text) return badRequest('Text is required')
  if (text.length > MAX_AI_TRANSFORM_TEXT_LENGTH) {
    return badRequest(`Text too long. Limit is ${MAX_AI_TRANSFORM_TEXT_LENGTH} characters.`)
  }
  if (requestedModel.length > MAX_AI_MODEL_ID_LENGTH) {
    return badRequest('Model identifier is too long')
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
  if (action === 'custom' && !requestedCustomPrompt) {
    return badRequest('Custom prompt is required')
  }

  const defaultPrompts = createDefaultAiPromptSettings()
  const systemPrompt = requestedSystemPrompt || defaultPrompts.systemPrompt
  const actionPrompt = resolveAiPromptTemplate(
    requestedActionPrompt || defaultPrompts.actionPrompts[action],
    targetLanguage || undefined,
  )

  try {
    const completion = await requestAiTextCompletion({
      systemPrompt,
      userPrompt: [
        `Task: ${actionPrompt}`,
        action === 'translate'
          ? `Target language: ${targetLanguage}`
          : action === 'custom'
            ? `User instruction: ${requestedCustomPrompt}`
            : 'Use the same language as the original text.',
        '',
        '<text>',
        text,
        '</text>',
      ].join('\n'),
      model: requestedModel || undefined,
      temperature: 0.2,
    })

    return NextResponse.json(completion)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'The AI provider request failed.'
    const status =
      error instanceof AiCompletionError ? error.status : 502

    return NextResponse.json({ error: message }, { status })
  }
}

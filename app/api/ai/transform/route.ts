import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  AI_TRANSFORM_ACTIONS,
  MAX_AI_TRANSFORM_TEXT_LENGTH,
  type AiTransformAction,
} from '@/lib/ai'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'

const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini'
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

type OpenAIContentPart = {
  type?: string
  text?: string
}

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | OpenAIContentPart[]
    }
  }>
  error?: {
    message?: string
  }
}

function isAiTransformAction(value: string): value is AiTransformAction {
  return AI_TRANSFORM_ACTIONS.includes(value as AiTransformAction)
}

function buildInstructions(action: AiTransformAction, targetLanguage?: string) {
  switch (action) {
    case 'polish':
      return 'Improve clarity, fluency, and tone while preserving the original meaning, structure, and terminology.'
    case 'shorten':
      return 'Make the text materially shorter by removing redundancy while preserving the key meaning, structure, and important details.'
    case 'expand':
      return 'Expand the text with useful clarification and supporting detail, but do not invent facts or claims that are not grounded in the original.'
    case 'translate':
      return `Translate the text into ${targetLanguage ?? 'the requested language'} while preserving markdown, code, URLs, numbers, and product names.`
    case 'explain':
      return 'Explain the text in plain language. If the text is technical, clarify what it means, what it does, and why it matters.'
  }
}

function extractCompletionText(payload: OpenAIChatCompletionResponse | null) {
  const content = payload?.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === 'text' || !part.type ? part.text ?? '' : ''))
      .join('')
      .trim()
  }

  return ''
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('editor')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const action = typeof body.action === 'string' ? body.action : ''
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const targetLanguage =
    typeof body.targetLanguage === 'string' ? body.targetLanguage.trim() : ''

  if (!isAiTransformAction(action)) return badRequest('Invalid AI action')
  if (!text) return badRequest('Text is required')
  if (text.length > MAX_AI_TRANSFORM_TEXT_LENGTH) {
    return badRequest(`Text too long. Limit is ${MAX_AI_TRANSFORM_TEXT_LENGTH} characters.`)
  }
  if (action === 'translate' && !targetLanguage) {
    return badRequest('Target language is required for translation')
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured on the server.' },
      { status: 503 },
    )
  }

  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, '')
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert editor inside a document workspace. Return only the requested output with no preamble, no surrounding quotes, and no commentary. Preserve markdown, lists, inline code, code fences, URLs, numbers, and proper nouns whenever possible.',
        },
        {
          role: 'user',
          content: [
            `Task: ${buildInstructions(action, targetLanguage || undefined)}`,
            action !== 'translate'
              ? 'Use the same language as the original text.'
              : `Target language: ${targetLanguage}`,
            '',
            '<text>',
            text,
            '</text>',
          ].join('\n'),
        },
      ],
    }),
    cache: 'no-store',
  })

  const payload = (await upstream.json().catch(() => null)) as OpenAIChatCompletionResponse | null

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error:
          payload?.error?.message ??
          'The AI provider request failed. Check your model and API key configuration.',
      },
      { status: 502 },
    )
  }

  const completion = extractCompletionText(payload)
  if (!completion) {
    return NextResponse.json(
      { error: 'The AI provider returned an empty response.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ result: completion })
}

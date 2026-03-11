import {
  DEFAULT_AIHUBMIX_BASE_URL,
  DEFAULT_AIHUBMIX_MODEL,
} from '@/lib/ai'

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

export class AiCompletionError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AiCompletionError'
    this.status = status
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

export async function requestAiTextCompletion(input: {
  systemPrompt: string
  userPrompt: string
  model?: string
  temperature?: number
}) {
  const apiKey =
    process.env.AIHUBMIX_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()

  if (!apiKey) {
    throw new AiCompletionError(
      'AIHUBMIX_API_KEY is not configured on the server. OPENAI_API_KEY is also accepted as a fallback.',
      503,
    )
  }

  const baseUrl = (
    process.env.AIHUBMIX_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    DEFAULT_AIHUBMIX_BASE_URL
  ).replace(/\/$/, '')

  const model =
    input.model?.trim() ||
    process.env.AIHUBMIX_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_AIHUBMIX_MODEL

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: input.temperature ?? 0.2,
      messages: [
        {
          role: 'system',
          content: input.systemPrompt,
        },
        {
          role: 'user',
          content: input.userPrompt,
        },
      ],
    }),
    cache: 'no-store',
  })

  const payload = (await upstream.json().catch(() => null)) as OpenAIChatCompletionResponse | null

  if (!upstream.ok) {
    throw new AiCompletionError(
      payload?.error?.message ??
        'The AI provider request failed. Check your AIHubMix base URL, model, and API key configuration.',
      502,
    )
  }

  const completion = extractCompletionText(payload)
  if (!completion) {
    throw new AiCompletionError('The AI provider returned an empty response.', 502)
  }

  return {
    result: completion,
    model,
  }
}

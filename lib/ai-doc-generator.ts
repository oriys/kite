import type { ParsedEndpoint } from '@/lib/openapi/parser'
import {
  requestAiTextCompletion,
  resolveAiModelSelection,
  resolveWorkspaceAiProviders,
} from '@/lib/ai-server'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'
import { logServerError } from '@/lib/server-errors'

const MAX_SCHEMA_JSON_LENGTH = 3_000

function truncateJson(value: unknown, maxLength: number) {
  const json = JSON.stringify(value, null, 2) ?? ''
  if (json.length <= maxLength) return json
  return `${json.slice(0, maxLength)}\n// ... truncated`
}

function formatEndpointContext(endpoint: ParsedEndpoint) {
  const lines: string[] = []

  lines.push(`Method: ${endpoint.method}`)
  lines.push(`Path: ${endpoint.path}`)

  if (endpoint.operationId) {
    lines.push(`Operation ID: ${endpoint.operationId}`)
  }
  if (endpoint.summary) {
    lines.push(`Summary: ${endpoint.summary}`)
  }
  if (endpoint.description) {
    lines.push(`Description: ${endpoint.description}`)
  }
  if (endpoint.tags.length > 0) {
    lines.push(`Tags: ${endpoint.tags.join(', ')}`)
  }
  if (endpoint.deprecated) {
    lines.push('Status: DEPRECATED')
  }

  if (endpoint.parameters.length > 0) {
    lines.push('')
    lines.push('Parameters:')
    for (const param of endpoint.parameters) {
      const name = (param.name as string) || '?'
      const location = (param.in as string) || '?'
      const schema = (param.schema as Record<string, unknown>) ?? {}
      const type = (schema.type as string) || 'unknown'
      const required = param.required ? '(required)' : '(optional)'
      const desc = (param.description as string) || ''
      lines.push(`  - ${name} [${location}, ${type}] ${required} ${desc}`.trimEnd())
    }
  }

  if (endpoint.requestBody) {
    lines.push('')
    lines.push('Request Body:')
    const content = (endpoint.requestBody.content as Record<string, unknown>) ?? {}
    for (const [mediaType, mediaObj] of Object.entries(content)) {
      lines.push(`  Content-Type: ${mediaType}`)
      const schema = (mediaObj as Record<string, unknown>).schema
      if (schema) {
        lines.push(`  Schema: ${truncateJson(schema, MAX_SCHEMA_JSON_LENGTH)}`)
      }
    }
  }

  if (Object.keys(endpoint.responses).length > 0) {
    lines.push('')
    lines.push('Responses:')
    for (const [code, resp] of Object.entries(endpoint.responses)) {
      const r = resp as Record<string, unknown>
      const desc = (r.description as string) || ''
      lines.push(`  ${code}: ${desc}`)
      const respContent = (r.content as Record<string, unknown>) ?? {}
      for (const [mediaType, mediaObj] of Object.entries(respContent)) {
        const schema = (mediaObj as Record<string, unknown>).schema
        if (schema) {
          lines.push(`    ${mediaType}: ${truncateJson(schema, MAX_SCHEMA_JSON_LENGTH)}`)
        }
      }
    }
  }

  return lines.join('\n')
}

const SYSTEM_PROMPT = [
  'You are an expert API documentation writer.',
  'Generate clear, comprehensive, developer-friendly documentation for REST API endpoints.',
  'Write in clean Markdown format.',
  'Be concise but thorough — every parameter, response code, and edge case should be covered.',
  'Use the same language as any existing summary or description provided in the endpoint metadata.',
  'If the metadata is in English or has no text, write in English.',
].join(' ')

function buildUserPrompt(endpoint: ParsedEndpoint, apiTitle?: string) {
  return [
    `Generate complete API documentation for this endpoint${apiTitle ? ` from the "${apiTitle}" API` : ''}.`,
    '',
    'Include these sections:',
    '1. **Overview** — A clear 1–3 sentence description of what this endpoint does and when to use it.',
    '2. **Parameters** — Explain each parameter with its purpose, type, constraints, and example values.',
    '3. **Request Body** — If applicable, describe the schema with field-by-field explanations and a realistic JSON example.',
    '4. **Response** — For each status code, explain what it means and provide a realistic JSON example.',
    '5. **Error Handling** — Common error scenarios and how to handle them.',
    '6. **Usage Notes** — Any important caveats, rate limits, pagination, or authentication requirements.',
    '',
    'Do not include a top-level heading (the document title will be added separately).',
    'Start directly with the Overview section.',
    '',
    '<endpoint>',
    formatEndpointContext(endpoint),
    '</endpoint>',
  ].join('\n')
}

export interface GenerateEndpointDocResult {
  title: string
  content: string
  model: string
}

export async function generateEndpointDoc(input: {
  workspaceId: string
  endpoint: ParsedEndpoint
  apiTitle?: string
  model?: string
}): Promise<GenerateEndpointDocResult> {
  const [providers, workspaceSettings] = await Promise.all([
    resolveWorkspaceAiProviders(input.workspaceId),
    getAiWorkspaceSettings(input.workspaceId),
  ])

  const selection = resolveAiModelSelection({
    requestedModelId: input.model,
    defaultModelId: workspaceSettings?.defaultModelId ?? null,
    enabledModelIds: Array.isArray(workspaceSettings?.enabledModelIds)
      ? workspaceSettings.enabledModelIds.filter(
          (v): v is string => typeof v === 'string',
        )
      : [],
    providers,
  })

  if (!selection) {
    throw new Error('No AI model configured for documentation generation.')
  }

  const completion = await requestAiTextCompletion({
    provider: selection.provider,
    model: selection.modelId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(input.endpoint, input.apiTitle),
    temperature: 0.2,
  })

  const title = input.endpoint.summary
    ? `${input.endpoint.method} ${input.endpoint.path} — ${input.endpoint.summary}`
    : `${input.endpoint.method} ${input.endpoint.path}`

  return {
    title,
    content: completion.result,
    model: completion.model,
  }
}

export interface BatchGenerateProgress {
  total: number
  completed: number
  current: string
  results: Array<{
    endpointId: string
    method: string
    path: string
    status: 'success' | 'error'
    title?: string
    content?: string
    error?: string
  }>
}

export async function generateEndpointDocs(input: {
  workspaceId: string
  endpoints: Array<{ id: string } & ParsedEndpoint>
  apiTitle?: string
  model?: string
  onProgress?: (progress: BatchGenerateProgress) => void
}): Promise<BatchGenerateProgress> {
  const progress: BatchGenerateProgress = {
    total: input.endpoints.length,
    completed: 0,
    current: '',
    results: [],
  }

  for (const endpoint of input.endpoints) {
    progress.current = `${endpoint.method} ${endpoint.path}`
    input.onProgress?.(progress)

    try {
      const result = await generateEndpointDoc({
        workspaceId: input.workspaceId,
        endpoint,
        apiTitle: input.apiTitle,
        model: input.model,
      })

      progress.results.push({
        endpointId: endpoint.id,
        method: endpoint.method,
        path: endpoint.path,
        status: 'success',
        title: result.title,
        content: result.content,
      })
    } catch (error) {
      logServerError('Failed to generate doc for endpoint', error, {
        endpointId: endpoint.id,
        method: endpoint.method,
        path: endpoint.path,
      })

      progress.results.push({
        endpointId: endpoint.id,
        method: endpoint.method,
        path: endpoint.path,
        status: 'error',
        error: error instanceof Error ? error.message : 'Generation failed',
      })
    }

    progress.completed += 1
    input.onProgress?.(progress)
  }

  return progress
}

import type {
  ParsedEndpoint,
  ParsedSecurityScheme,
  ParsedServer,
} from '@/lib/openapi/parser'
import {
  buildOpenApiDocumentTitle,
  type OpenApiDocumentType,
} from '@/lib/openapi/document-types'
import {
  requestAiTextCompletion,
} from '@/lib/ai-server'
import { logServerError } from '@/lib/server-errors'
import { TEMPERATURE_DOC_GEN } from '@/lib/ai-config'
import {
  buildEndpointDocUserPrompt,
  buildOpenApiDocumentUserPrompt,
  type OpenApiDocumentRetrievedContext,
  type OpenApiDocumentTemplateContext,
} from '@/lib/openapi/doc-prompt'
import { resolveDocGenerationSelection } from '@/lib/openapi/doc-generation-model'

const SYSTEM_PROMPT = [
  'You are an expert API documentation writer.',
  'Generate clear, comprehensive, developer-friendly documentation from OpenAPI metadata, templates, and user instructions.',
  'Write in clean Markdown format.',
  'Be concise but thorough — cover the endpoint surface, auth model, request or response behavior, failure modes, usage examples, and integration risks.',
  'When multiple endpoints are provided, combine them into one coherent document instead of unrelated fragments.',
  'Never invent undocumented fields, headers, status codes, auth scopes, or rate limits.',
  'If metadata is missing or ambiguous, say so plainly instead of pretending it exists.',
  'If supplemental context is provided, treat it as secondary context and resolve conflicts in favor of explicit OpenAPI metadata.',
  'Use the same language as any existing summary or description provided in the endpoint metadata.',
  'If the metadata is in English or has no text, write in English.',
].join(' ')

export interface GenerateEndpointDocResult {
  title: string
  content: string
  model: string
}

export async function generateEndpointDoc(input: {
  workspaceId: string
  endpoint: ParsedEndpoint
  apiTitle?: string
  apiVersion?: string | null
  servers?: ParsedServer[]
  securitySchemes?: Record<string, ParsedSecurityScheme>
  model?: string
}): Promise<GenerateEndpointDocResult> {
  const selection = await resolveDocGenerationSelection(
    input.workspaceId,
    input.model,
  )

  if (!selection) {
    throw new Error('No AI model configured for documentation generation.')
  }

  const completion = await requestAiTextCompletion({
    provider: selection.provider,
    model: selection.modelId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildEndpointDocUserPrompt(input.endpoint, {
      apiTitle: input.apiTitle,
      apiVersion: input.apiVersion,
      servers: input.servers,
      securitySchemes: input.securitySchemes,
    }),
    temperature: TEMPERATURE_DOC_GEN,
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

export interface GenerateOpenApiDocumentResult {
  title: string
  content: string
  model: string
}

function resolveSupplementalTitleHint(
  input: OpenApiDocumentRetrievedContext | null | undefined,
  sourceName: string,
) {
  const sourceNameKey = sourceName.trim().toLowerCase()

  return (
    input?.materialTitles?.find((title) => {
      const normalized = title.trim()
      if (!normalized) return false

      const normalizedKey = normalized.toLowerCase()
      if (
        normalizedKey === 'supplemental material' ||
        normalizedKey === 'pasted material'
      ) {
        return false
      }

      return normalizedKey !== sourceNameKey
    }) ?? null
  )
}

export async function generateOpenApiDocument(input: {
  workspaceId: string
  sourceName: string
  endpoints: ParsedEndpoint[]
  apiTitle?: string
  apiVersion?: string | null
  servers?: ParsedServer[]
  securitySchemes?: Record<string, ParsedSecurityScheme>
  prompt?: string
  documentType?: OpenApiDocumentType | null
  template?: OpenApiDocumentTemplateContext | null
  retrievedContext?: OpenApiDocumentRetrievedContext | null
  model?: string
}): Promise<GenerateOpenApiDocumentResult> {
  const selection = await resolveDocGenerationSelection(
    input.workspaceId,
    input.model,
  )

  if (!selection) {
    throw new Error('No AI model configured for documentation generation.')
  }

  const completion = await requestAiTextCompletion({
    provider: selection.provider,
    model: selection.modelId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildOpenApiDocumentUserPrompt({
      sourceName: input.sourceName,
      endpoints: input.endpoints,
      apiTitle: input.apiTitle,
      apiVersion: input.apiVersion,
      servers: input.servers,
      securitySchemes: input.securitySchemes,
      userPrompt: input.prompt,
      documentType: input.documentType,
      template: input.template,
      retrievedContext: input.retrievedContext,
    }),
    temperature: TEMPERATURE_DOC_GEN,
  })

  return {
    title: buildOpenApiDocumentTitle({
      sourceName: input.apiTitle ?? input.sourceName,
      endpoints: input.endpoints,
      documentType: input.documentType,
      prompt: input.prompt,
      templateName: input.template?.name,
      supplementalTitleHint: resolveSupplementalTitleHint(
        input.retrievedContext,
        input.apiTitle ?? input.sourceName,
      ),
    }),
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
  apiVersion?: string | null
  servers?: ParsedServer[]
  securitySchemes?: Record<string, ParsedSecurityScheme>
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
        apiVersion: input.apiVersion,
        servers: input.servers,
        securitySchemes: input.securitySchemes,
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

import type { AiCatalogModel, AiProviderSummary, AiProviderType } from '@/lib/ai'

export type AnthropicModelsResponse = {
  data?: unknown[]
  error?: {
    message?: string
  }
}

export type GeminiModelsResponse = {
  models?: unknown[]
  error?: {
    message?: string
  }
}

export type OpenAiCompatibleRerankResponse = {
  results?: unknown[]
  data?: unknown[]
  error?: {
    message?: string
  }
}

export interface ResolvedAiProviderConfig {
  id: string
  name: string
  providerType: AiProviderType
  baseUrl: string
  apiKey: string
  defaultModelId: string
  enabled: boolean
  source: 'database' | 'env'
}

export interface AiCatalogLoadResult {
  configured: boolean
  providers: AiProviderSummary[]
  models: AiCatalogModel[]
  error?: string
}

export class AiCompletionError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AiCompletionError'
    this.status = status
  }
}

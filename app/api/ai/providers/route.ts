import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  MAX_AI_PROVIDER_API_KEY_LENGTH,
  MAX_AI_PROVIDER_NAME_LENGTH,
  MAX_AI_PROVIDER_URL_LENGTH,
  getAiProviderDefaultBaseUrl,
  isAiProviderType,
} from '@/lib/ai'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import {
  createAiProviderConfig,
  listAiProviderConfigsForClient,
  serializeAiProviderConfig,
} from '@/lib/queries/ai'

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const items = await listAiProviderConfigsForClient(result.ctx.workspaceId)
  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const name = normalizeOptionalString(body.name)
  const providerType = normalizeOptionalString(body.providerType)
  const apiKey = normalizeOptionalString(body.apiKey)
  const baseUrl = normalizeOptionalString(body.baseUrl)
  const defaultModelId = normalizeOptionalString(body.defaultModelId)
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : true

  if (!name) return badRequest('Provider name is required')
  if (name.length > MAX_AI_PROVIDER_NAME_LENGTH) {
    return badRequest('Provider name is too long')
  }
  if (!isAiProviderType(providerType)) {
    return badRequest('Invalid AI provider type')
  }
  if (!apiKey) return badRequest('API key is required')
  if (apiKey.length > MAX_AI_PROVIDER_API_KEY_LENGTH) {
    return badRequest('API key is too long')
  }
  if (baseUrl.length > MAX_AI_PROVIDER_URL_LENGTH) {
    return badRequest('Base URL is too long')
  }

  const provider = await createAiProviderConfig(result.ctx.workspaceId, {
    name,
    providerType,
    apiKey,
    baseUrl: baseUrl || getAiProviderDefaultBaseUrl(providerType),
    defaultModelId: defaultModelId || null,
    enabled,
  })

  return NextResponse.json(serializeAiProviderConfig(provider), { status: 201 })
}

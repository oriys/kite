import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  MAX_AI_PROVIDER_API_KEY_LENGTH,
  MAX_AI_PROVIDER_NAME_LENGTH,
  MAX_AI_PROVIDER_URL_LENGTH,
  isAiProviderType,
} from '@/lib/ai'
import { badRequest, notFound, withWorkspaceAuth } from '@/lib/api-utils'
import {
  deleteAiProviderConfig,
  getAiProviderConfig,
  serializeAiProviderConfig,
  updateAiProviderConfig,
} from '@/lib/queries/ai'

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const existing = await getAiProviderConfig(id, result.ctx.workspaceId)
  if (!existing) {
    return notFound()
  }

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const patch: Parameters<typeof updateAiProviderConfig>[2] = {}

  if (typeof body.name === 'string') {
    const name = normalizeOptionalString(body.name)
    if (!name) return badRequest('Provider name is required')
    if (name.length > MAX_AI_PROVIDER_NAME_LENGTH) {
      return badRequest('Provider name is too long')
    }
    patch.name = name
  }

  if (typeof body.providerType === 'string') {
    const providerType = normalizeOptionalString(body.providerType)
    if (!isAiProviderType(providerType)) {
      return badRequest('Invalid AI provider type')
    }
    patch.providerType = providerType
  }

  if (typeof body.baseUrl === 'string') {
    const baseUrl = normalizeOptionalString(body.baseUrl)
    if (baseUrl.length > MAX_AI_PROVIDER_URL_LENGTH) {
      return badRequest('Base URL is too long')
    }
    patch.baseUrl = baseUrl || null
  }

  if (typeof body.defaultModelId === 'string') {
    patch.defaultModelId = normalizeOptionalString(body.defaultModelId) || null
  }

  if (typeof body.enabled === 'boolean') {
    patch.enabled = body.enabled
  }

  if (typeof body.apiKey === 'string') {
    const apiKey = normalizeOptionalString(body.apiKey)
    if (apiKey) {
      if (apiKey.length > MAX_AI_PROVIDER_API_KEY_LENGTH) {
        return badRequest('API key is too long')
      }
      patch.apiKey = apiKey
    }
  }

  const provider = await updateAiProviderConfig(id, result.ctx.workspaceId, patch)
  if (!provider) return notFound()

  return NextResponse.json(serializeAiProviderConfig(provider))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const existing = await getAiProviderConfig(id, result.ctx.workspaceId)
  if (!existing) {
    return notFound()
  }

  await deleteAiProviderConfig(id, result.ctx.workspaceId)
  return NextResponse.json({ success: true })
}

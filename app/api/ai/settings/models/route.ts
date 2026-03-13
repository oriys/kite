import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { MAX_AI_MODEL_ID_LENGTH } from '@/lib/ai'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import { upsertAiWorkspaceModelSettings } from '@/lib/queries/ai'

function normalizeModelId(value: unknown) {
  return typeof value === 'string'
    ? value.trim().slice(0, MAX_AI_MODEL_ID_LENGTH)
    : ''
}

export async function PUT(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const defaultModelId = normalizeModelId(body.defaultModelId)
  const rawEnabledModelIds: unknown[] = Array.isArray(body.enabledModelIds)
    ? body.enabledModelIds
    : []
  const enabledModelIds = Array.from(
    new Set(
      rawEnabledModelIds.reduce<string[]>((acc, value) => {
        const normalized = normalizeModelId(value)

        if (normalized) {
          acc.push(normalized)
        }

        return acc
      }, []),
    ),
  )

  if (defaultModelId && !enabledModelIds.includes(defaultModelId)) {
    enabledModelIds.unshift(defaultModelId)
  }

  await upsertAiWorkspaceModelSettings(result.ctx.workspaceId, {
    defaultModelId: defaultModelId || null,
    enabledModelIds,
  })

  return NextResponse.json({
    defaultModelId,
    enabledModelIds,
  })
}

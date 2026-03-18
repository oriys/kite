import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import {
  getAiWorkspaceSettings,
  upsertAiWorkspaceRagEnabled,
} from '@/lib/queries/ai'

export async function GET() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const settings = await getAiWorkspaceSettings(result.ctx.workspaceId)

  return NextResponse.json({
    ragEnabled: settings?.ragEnabled ?? true,
  })
}

export async function PUT(request: NextRequest) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  if (typeof body.ragEnabled !== 'boolean') {
    return badRequest('ragEnabled must be a boolean')
  }

  const settings = await upsertAiWorkspaceRagEnabled(
    result.ctx.workspaceId,
    body.ragEnabled,
  )

  return NextResponse.json({
    ragEnabled: settings.ragEnabled,
  })
}

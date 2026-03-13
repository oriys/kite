import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  sanitizeAiPromptSettings,
  type AiPromptSettings,
} from '@/lib/ai-prompts'
import {
  getAiWorkspaceSettings,
  upsertAiWorkspacePromptSettings,
} from '@/lib/queries/ai'

function toPromptSettings(value: unknown) {
  return value && typeof value === 'object'
    ? (value as Partial<AiPromptSettings>)
    : null
}

export async function GET() {
  const result = await withWorkspaceAuth('guest')
  if ('error' in result) return result.error

  const settings = await getAiWorkspaceSettings(result.ctx.workspaceId)
  const prompts = sanitizeAiPromptSettings(
    toPromptSettings(settings?.promptSettings),
  )

  return NextResponse.json(prompts)
}

export async function PUT(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const prompts = sanitizeAiPromptSettings(
    toPromptSettings(body.prompts ?? body),
  )

  await upsertAiWorkspacePromptSettings(result.ctx.workspaceId, prompts)

  return NextResponse.json(prompts)
}

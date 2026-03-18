import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { debugRetrieveChatContext } from '@/lib/ai-chat'
import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import { isRagQueryMode } from '@/lib/rag/types'

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const query = typeof body.query === 'string' ? body.query.trim() : ''
  const documentId =
    typeof body.documentId === 'string' ? body.documentId : undefined
  const mode =
    typeof body.mode === 'string' && isRagQueryMode(body.mode)
      ? body.mode
      : undefined

  if (!query) return badRequest('Query is required')

  const { contextText, sources, diagnostics } =
    await debugRetrieveChatContext({
      workspaceId: result.ctx.workspaceId,
      query,
      documentId,
      visibility: {
        userId: result.ctx.userId,
        role: result.ctx.role,
      },
      debug: true,
      mode,
    })

  return NextResponse.json({
    context: { text: contextText, sources },
    diagnostics,
  })
}

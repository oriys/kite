import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { searchDocuments } from '@/lib/search/searcher'
import { logSearch } from '@/lib/queries/search-logs'

export async function GET(req: NextRequest) {
  const authResult = await withWorkspaceAuth('viewer')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length === 0) {
    return badRequest('Query parameter "q" is required')
  }

  const trimmed = q.trim()
  const results = await searchDocuments(ctx.workspaceId, trimmed, 20)

  // Fire-and-forget: log without blocking the response
  logSearch({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    query: trimmed,
    resultCount: results.length,
  }).catch(() => {})

  return NextResponse.json({ results, query: trimmed })
}

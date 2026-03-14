import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { searchDocuments } from '@/lib/search/searcher'
import { hybridSearch } from '@/lib/search/semantic-searcher'
import { logSearch } from '@/lib/queries/search-logs'
import { logServerError } from '@/lib/server-errors'

type SearchMode = 'keyword' | 'semantic' | 'hybrid'
const SEARCH_MODES: SearchMode[] = ['keyword', 'semantic', 'hybrid']

export async function GET(req: NextRequest) {
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length === 0) {
    return badRequest('Query parameter "q" is required')
  }

  const trimmed = q.trim()
  const modeParam = req.nextUrl.searchParams.get('mode') ?? 'hybrid'
  const mode: SearchMode = SEARCH_MODES.includes(modeParam as SearchMode)
    ? (modeParam as SearchMode)
    : 'hybrid'

  const results =
    mode === 'keyword'
      ? (await searchDocuments(ctx.workspaceId, trimmed, 20)).map((r) => ({
          ...r,
          matchType: 'keyword' as const,
        }))
      : await hybridSearch(ctx.workspaceId, trimmed, mode, 20)

  // Fire-and-forget: log without blocking the response
  logSearch({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    query: trimmed,
    resultCount: results.length,
  }).catch((error) => {
    logServerError('Failed to log search analytics.', error, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      query: trimmed,
      resultCount: results.length,
    })
  })

  return NextResponse.json({ results, query: trimmed, mode })
}

import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { getPageAnalyticsOverview } from '@/lib/queries/page-analytics'

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { searchParams } = new URL(request.url)
  const days = Math.min(
    Math.max(parseInt(searchParams.get('days') ?? '30', 10) || 30, 1),
    365,
  )

  const analytics = await getPageAnalyticsOverview(result.ctx.workspaceId, days)
  return NextResponse.json(analytics)
}

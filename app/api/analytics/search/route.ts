import { NextResponse } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { getSearchAnalytics } from '@/lib/queries/feedback'

export async function GET() {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const analytics = await getSearchAnalytics(result.ctx.workspaceId)
  return NextResponse.json(analytics)
}

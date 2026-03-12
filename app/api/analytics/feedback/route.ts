import { NextResponse } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import {
  getWorkspaceFeedbackRanking,
  getRecentFeedbackWithComments,
} from '@/lib/queries/feedback'

export async function GET() {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const [ranking, recentComments] = await Promise.all([
    getWorkspaceFeedbackRanking(result.ctx.workspaceId),
    getRecentFeedbackWithComments(result.ctx.workspaceId),
  ])

  return NextResponse.json({ ranking, recentComments })
}

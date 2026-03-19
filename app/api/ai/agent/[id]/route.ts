import { NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { getAgentTask } from '@/lib/queries/agent'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const task = await getAgentTask(result.ctx.workspaceId, id)
  if (!task) return notFound()

  return NextResponse.json({ task })
}

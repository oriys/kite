import { NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound, badRequest } from '@/lib/api-utils'
import { getAgentTask, updateAgentTaskStatus } from '@/lib/queries/agent'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const task = await getAgentTask(result.ctx.workspaceId, id)
  if (!task) return notFound()

  if (task.status !== 'pending' && task.status !== 'running') {
    return badRequest(`Cannot cancel a task with status "${task.status}"`)
  }

  await updateAgentTaskStatus(result.ctx.workspaceId, id, 'cancelled')

  return NextResponse.json({ task: { ...task, status: 'cancelled' } })
}

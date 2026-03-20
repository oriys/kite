import { NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound, badRequest } from '@/lib/api-utils'
import { getAgentTask, updateAgentTaskStatus } from '@/lib/queries/agent'
import { cancelInteraction } from '@/lib/agent/interactions'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const task = await getAgentTask(result.ctx.workspaceId, id)
  if (!task) return notFound()

  const cancellable = ['pending', 'running', 'waiting_for_input'] as const
  if (!(cancellable as readonly string[]).includes(task.status)) {
    return badRequest(`Cannot cancel a task with status "${task.status}"`)
  }

  cancelInteraction(id)
  await updateAgentTaskStatus(result.ctx.workspaceId, id, 'cancelled')

  return NextResponse.json({ task: { ...task, status: 'cancelled' } })
}

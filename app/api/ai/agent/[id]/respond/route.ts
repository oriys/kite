import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { getAgentTaskInteraction } from '@/lib/queries/agent'
import {
  createDefaultDocAgentRunSettings,
  sanitizeDocAgentRunSettings,
} from '@/lib/agent/config'
import {
  buildAgentInteractionToolResultMessage,
  parseAgentConversation,
} from '@/lib/agent/conversation'
import { validateAgentInteractionResponse } from '@/lib/agent/interactive-tools'
import { startAgentTaskRun } from '@/lib/agent/task-runner'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const task = await getAgentTaskInteraction(result.ctx.workspaceId, id)
  if (!task) return notFound()

  if (task.status !== 'waiting_for_input') {
    return badRequest('Task is not waiting for input')
  }

  if (!task.interaction) {
    return badRequest('No pending interaction')
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON')

  const response = validateAgentInteractionResponse(
    task.interaction,
    body as Record<string, unknown>,
  )
  if (!response) {
    return badRequest('Invalid response for this interaction type')
  }

  const conversation = parseAgentConversation(task.conversation ?? [])
  if (!conversation.success) {
    return badRequest(`Task conversation is invalid: ${conversation.error}`)
  }

  const runSettings = sanitizeDocAgentRunSettings(
    task.runSettings ?? {
      ...createDefaultDocAgentRunSettings(),
      modelId: task.modelId ?? null,
      maxSteps: task.progress?.maxSteps ?? createDefaultDocAgentRunSettings().maxSteps,
    },
  )

  startAgentTaskRun({
    workspaceId: result.ctx.workspaceId,
    userId: result.ctx.userId,
    taskId: id,
    prompt: task.prompt,
    documentId: task.documentId ?? undefined,
    runSettings,
    conversation: [
      ...conversation.data,
      buildAgentInteractionToolResultMessage(task.interaction, response),
    ],
    initialStepIndex: Array.isArray(task.steps) ? task.steps.length : 0,
  })

  return NextResponse.json({ ok: true })
}

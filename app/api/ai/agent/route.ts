import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { createAgentTask, listAgentTasks, updateAgentTaskStatus, appendAgentTaskStep } from '@/lib/queries/agent'
import { logServerError } from '@/lib/server-errors'

const MAX_PROMPT_LENGTH = 4000

// Workaround: AI SDK's internal fetch unrefs the HTTP server handle, causing
// the Node.js event loop to drain and the process to exit after agent tasks
// complete. A permanent ref'd timer prevents this.
setInterval(() => {}, 60_000)

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const tasks = await listAgentTasks(result.ctx.workspaceId)
  return NextResponse.json({ tasks })
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) return badRequest('Prompt is required')
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return badRequest(`Prompt too long. Limit is ${MAX_PROMPT_LENGTH} characters.`)
  }

  const model = typeof body.model === 'string' ? body.model.trim() : undefined
  const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : undefined

  const task = await createAgentTask({
    workspaceId: result.ctx.workspaceId,
    userId: result.ctx.userId,
    prompt,
    modelId: model,
    documentId,
  })

  // Fire-and-forget: run the agent in the background
  void (async () => {
    try {
      await updateAgentTaskStatus(task.id, 'running')

      const { runAgent } = await import('@/lib/agent/engine')
      const agentResult = await runAgent({
        workspaceId: result.ctx.workspaceId,
        userId: result.ctx.userId,
        prompt,
        documentId,
        modelId: model,
        onStep: (step) => {
          void appendAgentTaskStep(task.id, step).catch((err) => {
            logServerError('Failed to persist agent step', err, { taskId: task.id })
          })
        },
      })

      await updateAgentTaskStatus(task.id, 'completed', {
        result: agentResult.result,
        steps: agentResult.steps,
        modelId: agentResult.modelId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent execution failed'
      logServerError('Agent task failed', error instanceof Error ? error : new Error(message), {
        taskId: task.id,
      })
      await updateAgentTaskStatus(task.id, 'failed', { error: message }).catch(() => {})
    }
  })()

  return NextResponse.json({ task }, { status: 201 })
}

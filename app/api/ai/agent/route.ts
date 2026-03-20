import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { createAgentTask, listAgentTasks, updateAgentTaskStatus, appendAgentTaskStep } from '@/lib/queries/agent'
import { runAgent } from '@/lib/agent/engine'
import { cancelInteraction } from '@/lib/agent/interactions'
import {
  parseDocAgentMaxSteps,
  parseDocAgentModelId,
  parseDocAgentTemperature,
} from '@/lib/agent/config'
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

  const parsedModel = parseDocAgentModelId(body.model)
  if ('error' in parsedModel) return badRequest(parsedModel.error)

  const parsedMaxSteps = parseDocAgentMaxSteps(body.maxSteps)
  if ('error' in parsedMaxSteps) return badRequest(parsedMaxSteps.error)

  const parsedTemperature = parseDocAgentTemperature(body.temperature)
  if ('error' in parsedTemperature) return badRequest(parsedTemperature.error)

  const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : undefined
  const runSettings = {
    modelId: parsedModel.value,
    maxSteps: parsedMaxSteps.value,
    temperature: parsedTemperature.value,
  }

  const task = await createAgentTask({
    workspaceId: result.ctx.workspaceId,
    userId: result.ctx.userId,
    prompt,
    modelId: runSettings.modelId ?? undefined,
    documentId,
    progress: {
      currentStep: 0,
      maxSteps: runSettings.maxSteps,
      description: 'Queued...',
    },
  })

  // Fire-and-forget: run the agent in the background
  void (async () => {
    try {
      await updateAgentTaskStatus(result.ctx.workspaceId, task.id, 'running', {
        progress: {
          currentStep: 0,
          maxSteps: runSettings.maxSteps,
          description: 'Preparing agent...',
        },
      })

      const agentResult = await runAgent({
        workspaceId: result.ctx.workspaceId,
        userId: result.ctx.userId,
        prompt,
        taskId: task.id,
        documentId,
        modelId: runSettings.modelId ?? undefined,
        maxSteps: runSettings.maxSteps,
        temperature: runSettings.temperature,
        onStep: (step) => {
          void appendAgentTaskStep(result.ctx.workspaceId, task.id, step, {
            maxSteps: runSettings.maxSteps,
          }).catch((err) => {
            logServerError('Failed to persist agent step', err, { taskId: task.id })
          })
        },
      })

      await updateAgentTaskStatus(result.ctx.workspaceId, task.id, 'completed', {
        result: agentResult.result,
        steps: agentResult.steps,
        modelId: agentResult.modelRef,
        progress: {
          currentStep: agentResult.steps.length,
          maxSteps: runSettings.maxSteps,
          description: 'Completed',
        },
      })
    } catch (error) {
      cancelInteraction(task.id)
      const message = error instanceof Error ? error.message : 'Agent execution failed'
      logServerError('Agent task failed', error instanceof Error ? error : new Error(message), {
        taskId: task.id,
      })
      await updateAgentTaskStatus(result.ctx.workspaceId, task.id, 'failed', { error: message }).catch(() => {})
    }
  })()

  return NextResponse.json({ task }, { status: 201 })
}

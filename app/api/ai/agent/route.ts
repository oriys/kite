import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { createAgentTask, listAgentTasks } from '@/lib/queries/agent'
import { createInitialAgentConversation } from '@/lib/agent/conversation'
import {
  parseDocAgentMaxSteps,
  parseDocAgentModelId,
  parseDocAgentTemperature,
} from '@/lib/agent/config'
import { startAgentTaskRun } from '@/lib/agent/task-runner'

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
  const conversation = createInitialAgentConversation(prompt)

  const task = await createAgentTask({
    workspaceId: result.ctx.workspaceId,
    userId: result.ctx.userId,
    prompt,
    runSettings,
    documentId,
    conversation,
    progress: {
      currentStep: 0,
      maxSteps: runSettings.maxSteps,
      description: 'Queued...',
    },
  })

  startAgentTaskRun({
    workspaceId: result.ctx.workspaceId,
    userId: result.ctx.userId,
    taskId: task.id,
    prompt,
    documentId,
    runSettings,
    conversation,
    initialStepIndex: 0,
  })

  return NextResponse.json({ task }, { status: 201 })
}

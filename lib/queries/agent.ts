import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agentTasks, type AgentStepRecord, type AgentInteraction } from '@/lib/schema'
import { DOC_AGENT_DEFAULT_MAX_STEPS } from '@/lib/agent/config'

type AgentTaskProgress = {
  currentStep: number
  maxSteps: number
  description?: string
}

export async function createAgentTask(input: {
  workspaceId: string
  userId: string
  prompt: string
  modelId?: string
  documentId?: string
  progress?: AgentTaskProgress
}) {
  const id = crypto.randomUUID()
  const [task] = await db
    .insert(agentTasks)
    .values({
      id,
      workspaceId: input.workspaceId,
      userId: input.userId,
      prompt: input.prompt,
      modelId: input.modelId,
      documentId: input.documentId,
      status: 'pending',
      progress: input.progress,
    })
    .returning()

  return task
}

export async function getAgentTask(workspaceId: string, taskId: string) {
  const [task] = await db
    .select()
    .from(agentTasks)
    .where(and(eq(agentTasks.workspaceId, workspaceId), eq(agentTasks.id, taskId)))
    .limit(1)

  return task ?? null
}

export async function listAgentTasks(workspaceId: string, limit = 20) {
  return db
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.workspaceId, workspaceId))
    .orderBy(desc(agentTasks.createdAt))
    .limit(limit)
}

export async function updateAgentTaskStatus(
  workspaceId: string,
  taskId: string,
  status: 'pending' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled',
  extra?: {
    result?: string
    error?: string
    steps?: AgentStepRecord[]
    modelId?: string
    progress?: AgentTaskProgress
    interaction?: AgentInteraction | null
  },
) {
  const updates: Record<string, unknown> = { status }

  if (status === 'running') updates.startedAt = new Date()
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updates.completedAt = new Date()
  }

  if (extra?.result !== undefined) updates.result = extra.result
  if (extra?.error !== undefined) updates.error = extra.error
  if (extra?.steps !== undefined) updates.steps = extra.steps
  if (extra?.modelId !== undefined) updates.modelId = extra.modelId
  if (extra?.progress !== undefined) updates.progress = extra.progress
  if (extra?.interaction !== undefined) updates.interaction = extra.interaction

  await db.update(agentTasks).set(updates).where(and(eq(agentTasks.id, taskId), eq(agentTasks.workspaceId, workspaceId)))
}

export async function appendAgentTaskStep(
  workspaceId: string,
  taskId: string,
  step: AgentStepRecord,
  options?: { maxSteps?: number },
) {
  await db
    .update(agentTasks)
    .set({
      steps: sql`COALESCE(${agentTasks.steps}, '[]'::jsonb) || ${JSON.stringify([step])}::jsonb`,
      progress: {
        currentStep: step.index + 1,
        maxSteps: options?.maxSteps ?? DOC_AGENT_DEFAULT_MAX_STEPS,
        description:
          step.type === 'tool_call'
            ? `Calling ${step.toolCalls?.[0]?.name ?? 'tool'}…`
            : 'Generating response…',
      },
    })
    .where(and(eq(agentTasks.id, taskId), eq(agentTasks.workspaceId, workspaceId)))
}

export async function getAgentTaskInteraction(workspaceId: string, taskId: string) {
  const [task] = await db
    .select({
      status: agentTasks.status,
      interaction: agentTasks.interaction,
    })
    .from(agentTasks)
    .where(and(eq(agentTasks.workspaceId, workspaceId), eq(agentTasks.id, taskId)))
    .limit(1)

  return task ?? null
}

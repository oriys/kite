import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agentTasks, type AgentStepRecord } from '@/lib/schema'

export async function createAgentTask(input: {
  workspaceId: string
  userId: string
  prompt: string
  modelId?: string
  documentId?: string
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
  taskId: string,
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
  extra?: {
    result?: string
    error?: string
    steps?: AgentStepRecord[]
    modelId?: string
    progress?: { currentStep: number; maxSteps: number; description?: string }
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

  await db.update(agentTasks).set(updates).where(eq(agentTasks.id, taskId))
}

export async function appendAgentTaskStep(taskId: string, step: AgentStepRecord) {
  await db
    .update(agentTasks)
    .set({
      steps: sql`COALESCE(${agentTasks.steps}, '[]'::jsonb) || ${JSON.stringify([step])}::jsonb`,
      progress: {
        currentStep: step.index + 1,
        maxSteps: 15,
        description:
          step.type === 'tool_call'
            ? `Calling ${step.toolCalls?.[0]?.name ?? 'tool'}…`
            : 'Generating response…',
      },
    })
    .where(eq(agentTasks.id, taskId))
}

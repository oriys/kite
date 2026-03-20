import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { agentTasks, type AgentStepRecord, type AgentInteraction } from '@/lib/schema'
import { DOC_AGENT_DEFAULT_MAX_STEPS } from '@/lib/agent/config'
import type { AgentConversationMessage } from '@/lib/agent/conversation'

type AgentTaskProgress = {
  currentStep: number
  maxSteps: number
  description?: string
}

export async function createAgentTask(input: {
  workspaceId: string
  userId: string
  prompt: string
  runSettings: {
    modelId: string | null
    maxSteps: number
    temperature: number
  }
  documentId?: string
  progress?: AgentTaskProgress
  conversation?: AgentConversationMessage[]
}) {
  const id = crypto.randomUUID()
  const [task] = await db
    .insert(agentTasks)
    .values({
      id,
      workspaceId: input.workspaceId,
      userId: input.userId,
      prompt: input.prompt,
      modelId: input.runSettings.modelId,
      documentId: input.documentId,
      runSettings: input.runSettings,
      conversation: input.conversation ?? [],
      status: 'pending',
      progress: input.progress,
    })
    .returning()

  return task
}

export async function getAgentTask(workspaceId: string, taskId: string) {
  const [task] = await db
    .select({
      id: agentTasks.id,
      prompt: agentTasks.prompt,
      status: agentTasks.status,
      progress: agentTasks.progress,
      result: agentTasks.result,
      error: agentTasks.error,
      steps: agentTasks.steps,
      modelId: agentTasks.modelId,
      documentId: agentTasks.documentId,
      createdAt: agentTasks.createdAt,
      startedAt: agentTasks.startedAt,
      completedAt: agentTasks.completedAt,
      interaction: agentTasks.interaction,
    })
    .from(agentTasks)
    .where(and(eq(agentTasks.workspaceId, workspaceId), eq(agentTasks.id, taskId)))
    .limit(1)

  return task ?? null
}

export async function listAgentTasks(workspaceId: string, limit = 20) {
  return db
    .select({
      id: agentTasks.id,
      prompt: agentTasks.prompt,
      status: agentTasks.status,
      progress: agentTasks.progress,
      result: agentTasks.result,
      error: agentTasks.error,
      modelId: agentTasks.modelId,
      documentId: agentTasks.documentId,
      createdAt: agentTasks.createdAt,
      completedAt: agentTasks.completedAt,
    })
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
    result?: string | null
    error?: string | null
    steps?: AgentStepRecord[]
    modelId?: string | null
    progress?: AgentTaskProgress
    interaction?: AgentInteraction | null
    runSettings?: {
      modelId: string | null
      maxSteps: number
      temperature: number
    } | null
    conversation?: AgentConversationMessage[]
  },
) {
  const updates: Record<string, unknown> = { status }

  if (status === 'running') updates.startedAt = sql`coalesce(${agentTasks.startedAt}, now())`
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updates.completedAt = new Date()
  }

  if (extra?.result !== undefined) updates.result = extra.result
  if (extra?.error !== undefined) updates.error = extra.error
  if (extra?.steps !== undefined) updates.steps = extra.steps
  if (extra?.modelId !== undefined) updates.modelId = extra.modelId
  if (extra?.progress !== undefined) updates.progress = extra.progress
  if (extra?.interaction !== undefined) updates.interaction = extra.interaction
  if (extra?.runSettings !== undefined) updates.runSettings = extra.runSettings
  if (extra?.conversation !== undefined) updates.conversation = extra.conversation

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
      id: agentTasks.id,
      prompt: agentTasks.prompt,
      status: agentTasks.status,
      progress: agentTasks.progress,
      steps: agentTasks.steps,
      modelId: agentTasks.modelId,
      documentId: agentTasks.documentId,
      interaction: agentTasks.interaction,
      runSettings: agentTasks.runSettings,
      conversation: agentTasks.conversation,
    })
    .from(agentTasks)
    .where(and(eq(agentTasks.workspaceId, workspaceId), eq(agentTasks.id, taskId)))
    .limit(1)

  return task ?? null
}

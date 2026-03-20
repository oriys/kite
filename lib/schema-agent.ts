import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import type { AgentInteraction, AgentStepRecord } from './agent/shared'

export const agentTaskStatusEnum = pgEnum('agent_task_status', [
  'pending',
  'running',
  'waiting_for_input',
  'completed',
  'failed',
  'cancelled',
])

export const agentTasks = pgTable(
  'agent_tasks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id').notNull(),
    userId: text('user_id').notNull(),
    prompt: text('prompt').notNull(),
    status: agentTaskStatusEnum('status').notNull().default('pending'),
    progress: jsonb('progress').$type<{
      currentStep: number
      maxSteps: number
      description?: string
    }>(),
    result: text('result'),
    error: text('error'),
    steps: jsonb('steps').$type<AgentStepRecord[]>().default([]),
    modelId: text('model_id'),
    documentId: text('document_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    interaction: jsonb('interaction').$type<AgentInteraction | null>(),
  },
  (table) => [
    index('agent_tasks_workspace_idx').on(table.workspaceId),
    index('agent_tasks_user_idx').on(table.userId),
    index('agent_tasks_status_idx').on(table.status),
  ],
)
export type {
  AgentInteraction,
  AgentInteractionResponse,
  AgentStepRecord,
} from './agent/shared'

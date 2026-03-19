import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

export const agentTaskStatusEnum = pgEnum('agent_task_status', [
  'pending',
  'running',
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
  },
  (table) => [
    index('agent_tasks_workspace_idx').on(table.workspaceId),
    index('agent_tasks_user_idx').on(table.userId),
    index('agent_tasks_status_idx').on(table.status),
  ],
)

export interface AgentStepRecord {
  index: number
  type: 'tool_call' | 'response'
  toolCalls?: Array<{
    name: string
    args: Record<string, unknown>
    result?: string
    error?: string
    durationMs?: number
  }>
  text?: string
  durationMs?: number
}

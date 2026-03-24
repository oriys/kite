import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  runAgentMock,
  appendAgentTaskStepMock,
  updateAgentTaskStatusMock,
  logServerErrorMock,
} = vi.hoisted(() => ({
  runAgentMock: vi.fn(),
  appendAgentTaskStepMock: vi.fn(),
  updateAgentTaskStatusMock: vi.fn(),
  logServerErrorMock: vi.fn(),
}))

vi.mock('@/lib/agent/engine', () => ({
  runAgent: runAgentMock,
}))

vi.mock('@/lib/queries/agent', () => ({
  appendAgentTaskStep: appendAgentTaskStepMock,
  updateAgentTaskStatus: updateAgentTaskStatusMock,
}))

vi.mock('@/lib/server-errors', () => ({
  logServerError: logServerErrorMock,
}))

import { DOC_AGENT_RUN_TIMEOUT_MS } from '@/lib/ai-config'
import { startAgentTaskRun } from '../agent/task-runner'

describe('startAgentTaskRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateAgentTaskStatusMock.mockResolvedValue(undefined)
    appendAgentTaskStepMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks the task failed when the agent run exceeds the timeout', async () => {
    vi.useFakeTimers()

    runAgentMock.mockImplementation(({ signal }: { signal?: AbortSignal }) =>
      new Promise((_, reject) => {
        signal?.addEventListener(
          'abort',
          () => reject(new Error('Agent aborted')),
          { once: true },
        )
      }),
    )

    startAgentTaskRun({
      workspaceId: 'ws-1',
      userId: 'user-1',
      taskId: 'task-1',
      prompt: 'Help me',
      runSettings: {
        modelId: null,
        maxSteps: 3,
        temperature: 0.2,
      },
      conversation: [],
      initialStepIndex: 0,
    })

    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(DOC_AGENT_RUN_TIMEOUT_MS + 1)
    await Promise.resolve()

    const timeoutMessage = `Doc Agent timed out after ${Math.max(
      1,
      Math.ceil(DOC_AGENT_RUN_TIMEOUT_MS / 1000),
    )}s`

    expect(runAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )
    expect(updateAgentTaskStatusMock).toHaveBeenLastCalledWith(
      'ws-1',
      'task-1',
      'failed',
      expect.objectContaining({
        error: timeoutMessage,
        interaction: null,
      }),
    )
  })
})

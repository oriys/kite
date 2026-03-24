import { DOC_AGENT_RUN_TIMEOUT_MS } from '@/lib/ai-config'
import type { DocAgentRunSettings } from '@/lib/agent/config'
import type { AgentConversationMessage } from '@/lib/agent/conversation'
import { runAgent } from '@/lib/agent/engine'
import { appendAgentTaskStep, updateAgentTaskStatus } from '@/lib/queries/agent'
import { logServerError } from '@/lib/server-errors'

interface StartAgentTaskRunInput {
  workspaceId: string
  userId: string
  taskId: string
  prompt: string
  documentId?: string
  runSettings: DocAgentRunSettings
  conversation: AgentConversationMessage[]
  initialStepIndex: number
}

export function startAgentTaskRun(input: StartAgentTaskRunInput) {
  void (async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      const seconds = Math.max(1, Math.ceil(DOC_AGENT_RUN_TIMEOUT_MS / 1000))
      controller.abort(`Doc Agent timed out after ${seconds}s`)
    }, DOC_AGENT_RUN_TIMEOUT_MS)

    try {
      await updateAgentTaskStatus(input.workspaceId, input.taskId, 'running', {
        error: null,
        interaction: null,
        modelId: input.runSettings.modelId,
        runSettings: input.runSettings,
        conversation: input.conversation,
        progress: {
          currentStep: input.initialStepIndex,
          maxSteps: input.runSettings.maxSteps,
          description:
            input.initialStepIndex > 0
              ? 'Resuming agent…'
              : 'Preparing agent…',
        },
      })

      const agentResult = await runAgent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        prompt: input.prompt,
        taskId: input.taskId,
        documentId: input.documentId,
        modelId: input.runSettings.modelId ?? undefined,
        maxSteps: input.runSettings.maxSteps,
        temperature: input.runSettings.temperature,
        conversation: input.conversation,
        initialStepIndex: input.initialStepIndex,
        signal: controller.signal,
        onStep: (step) => {
          void appendAgentTaskStep(input.workspaceId, input.taskId, step, {
            maxSteps: input.runSettings.maxSteps,
          }).catch((err) => {
            logServerError('Failed to persist agent step', err, { taskId: input.taskId })
          })
        },
      })

      if (agentResult.status === 'waiting_for_input') {
        await updateAgentTaskStatus(input.workspaceId, input.taskId, 'waiting_for_input', {
          interaction: agentResult.interaction,
          modelId: agentResult.modelRef,
          runSettings: input.runSettings,
          conversation: agentResult.conversation,
          progress: {
            currentStep: agentResult.nextStepIndex,
            maxSteps: input.runSettings.maxSteps,
            description: 'Waiting for your response…',
          },
        })
        return
      }

      await updateAgentTaskStatus(input.workspaceId, input.taskId, 'completed', {
        result: agentResult.result,
        modelId: agentResult.modelRef,
        runSettings: input.runSettings,
        conversation: agentResult.conversation,
        progress: {
          currentStep: agentResult.nextStepIndex,
          maxSteps: input.runSettings.maxSteps,
          description: 'Completed',
        },
        })
    } catch (error) {
      const message =
        controller.signal.aborted && typeof controller.signal.reason === 'string'
          ? controller.signal.reason
          : error instanceof Error
            ? error.message
            : 'Agent execution failed'
      logServerError(
        'Agent task failed',
        error instanceof Error ? error : new Error(message),
        { taskId: input.taskId },
      )
      await updateAgentTaskStatus(input.workspaceId, input.taskId, 'failed', {
        error: message,
        interaction: null,
      }).catch(() => {})
    } finally {
      clearTimeout(timeoutId)
    }
  })()
}

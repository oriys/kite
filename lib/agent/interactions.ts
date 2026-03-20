import type { AgentInteractionResponse } from '@/lib/schema-agent'

const INTERACTION_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

interface PendingInteraction {
  interactionId: string
  resolve: (response: AgentInteractionResponse) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

// One pending interaction per task — keyed by taskId
const pending = new Map<string, PendingInteraction>()

export function waitForInteraction(
  taskId: string,
  interactionId: string,
): Promise<AgentInteractionResponse> {
  // Cancel any existing interaction for this task
  cancelInteraction(taskId)

  return new Promise<AgentInteractionResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(taskId)
      reject(new Error('Interaction timed out after 5 minutes'))
    }, INTERACTION_TIMEOUT_MS)

    pending.set(taskId, { interactionId, resolve, reject, timer })
  })
}

export function resolveInteraction(
  taskId: string,
  response: AgentInteractionResponse,
): boolean {
  const entry = pending.get(taskId)
  if (!entry) return false

  clearTimeout(entry.timer)
  pending.delete(taskId)
  entry.resolve(response)
  return true
}

export function cancelInteraction(taskId: string): boolean {
  const entry = pending.get(taskId)
  if (!entry) return false

  clearTimeout(entry.timer)
  pending.delete(taskId)
  entry.reject(new Error('Interaction cancelled'))
  return true
}

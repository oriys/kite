import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { getAgentTask } from '@/lib/queries/agent'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const task = await getAgentTask(result.ctx.workspaceId, id)
  if (!task) return notFound()

  // SSE stream that polls task status and streams steps
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        )
      }

      let lastStepCount = 0

      const poll = async () => {
        try {
          const current = await getAgentTask(result.ctx.workspaceId, id)
          if (!current) {
            send('error', { message: 'Task not found' })
            controller.close()
            return false
          }

          // Send new steps
          const steps = (current.steps as Array<unknown>) ?? []
          if (steps.length > lastStepCount) {
            for (let i = lastStepCount; i < steps.length; i++) {
              send('step', steps[i])
            }
            lastStepCount = steps.length
          }

          // Send progress
          if (current.progress) {
            send('progress', current.progress)
          }

          // Send interaction if waiting for input
          if (current.status === 'waiting_for_input' && current.interaction) {
            send('interaction', current.interaction)
          }

          // Terminal states
          if (current.status === 'completed') {
            send('done', { result: current.result, modelId: current.modelId })
            controller.close()
            return false
          }
          if (current.status === 'failed') {
            send('error', { message: current.error })
            controller.close()
            return false
          }
          if (current.status === 'cancelled') {
            send('cancelled', {})
            controller.close()
            return false
          }

          return true // continue polling
        } catch {
          controller.close()
          return false
        }
      }

      // Initial state
      send('status', { status: task.status, taskId: task.id })

      // Poll every second
      const interval = setInterval(async () => {
        const shouldContinue = await poll()
        if (!shouldContinue) clearInterval(interval)
      }, 1000)

      // Safety timeout: close after 5 minutes
      setTimeout(() => {
        clearInterval(interval)
        try {
          send('timeout', { message: 'Stream timed out' })
          controller.close()
        } catch { /* already closed */ }
      }, 5 * 60 * 1000)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

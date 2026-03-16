import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import type { TerminalSessionStatus } from '@/lib/terminal-manager'
import { terminalManager } from '@/lib/terminal-manager'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const session = terminalManager.getSession(id, {
    userId: result.ctx.userId,
    workspaceId: result.ctx.workspaceId,
  })
  if (!session) return notFound()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const onData = (data: string) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          )
        } catch {
          /* stream closed */
        }
      }

      const onExit = (code: number | undefined) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: exit\ndata: ${JSON.stringify({ code })}\n\n`,
            ),
          )
          controller.close()
        } catch {
          /* stream closed */
        }
      }

      const onStatus = (status: TerminalSessionStatus) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: status\ndata: ${JSON.stringify({ status })}\n\n`,
            ),
          )
        } catch {
          /* stream closed */
        }
      }

      onStatus(session.status)

      for (const chunk of session.outputBuffer) {
        onData(chunk)
      }

      session.listeners.add(onData)
      session.statusListeners.add(onStatus)
      session.exitListeners.add(onExit)

      req.signal.addEventListener('abort', () => {
        session.listeners.delete(onData)
        session.statusListeners.delete(onStatus)
        session.exitListeners.delete(onExit)
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
    },
  })
}

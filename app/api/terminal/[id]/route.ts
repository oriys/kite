import { NextResponse } from 'next/server'

import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { terminalManager } from '@/lib/terminal-manager'

async function closeTerminalSession(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params

  if (
    !terminalManager.destroySession(id, {
      userId: result.ctx.userId,
      workspaceId: result.ctx.workspaceId,
    })
  ) {
    return notFound()
  }

  return new NextResponse(null, { status: 204 })
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  return closeTerminalSession(req, context)
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  return closeTerminalSession(req, context)
}

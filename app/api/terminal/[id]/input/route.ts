import { NextResponse } from 'next/server'

import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { terminalManager } from '@/lib/terminal-manager'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body?.data || typeof body.data !== 'string') {
    return badRequest('Missing data field')
  }

  if (
    !terminalManager.writeInput(id, body.data, {
      userId: result.ctx.userId,
      workspaceId: result.ctx.workspaceId,
    })
  ) {
    return notFound()
  }

  return new NextResponse(null, { status: 204 })
}

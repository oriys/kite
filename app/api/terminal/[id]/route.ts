import { NextResponse } from 'next/server'

import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { terminalManager } from '@/lib/terminal-manager'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params

  if (!terminalManager.destroySession(id)) {
    return notFound()
  }

  return new NextResponse(null, { status: 204 })
}

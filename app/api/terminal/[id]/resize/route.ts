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
  if (typeof body?.cols !== 'number' || typeof body?.rows !== 'number') {
    return badRequest('Missing cols or rows')
  }

  if (!terminalManager.resize(id, body.cols, body.rows)) {
    return notFound()
  }

  return new NextResponse(null, { status: 204 })
}

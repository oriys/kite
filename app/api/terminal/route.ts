import { NextResponse } from 'next/server'

import { withWorkspaceAuth } from '@/lib/api-utils'
import { terminalManager } from '@/lib/terminal-manager'

export async function POST(req: Request) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const body = await req.json().catch(() => ({}))
  const cols = typeof body.cols === 'number' ? body.cols : 80
  const rows = typeof body.rows === 'number' ? body.rows : 24

  const session = await terminalManager.createSession({ cols, rows })

  return NextResponse.json({
    id: session.id,
    tmpDir: session.tmpDir,
    createdAt: session.createdAt,
  })
}

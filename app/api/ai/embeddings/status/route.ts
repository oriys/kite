import { NextResponse } from 'next/server'

import { getEmbeddingStatus } from '@/lib/embedding-pipeline'
import { withWorkspaceAuth } from '@/lib/api-utils'

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const status = await getEmbeddingStatus(result.ctx.workspaceId)

  return NextResponse.json(status)
}

import { NextResponse } from 'next/server'

import { withWorkspaceAuth } from '@/lib/api-utils'
import { runWorkspaceRagEvals } from '@/lib/rag-evals'

export async function POST() {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const evalResults = await runWorkspaceRagEvals({
    workspaceId: result.ctx.workspaceId,
  })

  return NextResponse.json(evalResults)
}

import { NextResponse } from 'next/server'

import { withWorkspaceAuth } from '@/lib/api-utils'
import { rebuildWorkspaceDocumentRelations } from '@/lib/document-relations'
import { logServerError } from '@/lib/server-errors'

export async function POST() {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  try {
    const rebuilt = await rebuildWorkspaceDocumentRelations(result.ctx.workspaceId)

    return NextResponse.json({
      message: `Rebuilt ${rebuilt.relations} document relations across ${rebuilt.documents} documents`,
      ...rebuilt,
    })
  } catch (error) {
    logServerError('Document relation rebuild failed', error, {
      workspaceId: result.ctx.workspaceId,
    })

    return NextResponse.json(
      { error: 'Failed to rebuild document relations.' },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { knowledgeSources } from '@/lib/schema'
import { notFound, withWorkspaceAuth } from '@/lib/api-utils'
import { processKnowledgeSource } from '@/lib/knowledge-pipeline'
import { logServerError } from '@/lib/server-errors'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await context.params

  const [existing] = await db
    .select({
      id: knowledgeSources.id,
      status: knowledgeSources.status,
      stopRequestedAt: knowledgeSources.stopRequestedAt,
    })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, id),
        eq(knowledgeSources.workspaceId, result.ctx.workspaceId),
        isNull(knowledgeSources.deletedAt),
      ),
    )
    .limit(1)

  if (!existing) return notFound()

  if (existing.status === 'processing') {
    return NextResponse.json(
      {
        error: existing.stopRequestedAt
          ? 'Knowledge source is already stopping'
          : 'Knowledge source is already processing',
      },
      { status: 409 },
    )
  }

  try {
    const processingResult = await processKnowledgeSource({
      knowledgeSourceId: id,
      workspaceId: result.ctx.workspaceId,
    })

    return NextResponse.json({
      status: processingResult.status,
      chunkCount: processingResult.chunkCount,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Processing failed'
    logServerError('Knowledge source processing API error', error, {
      knowledgeSourceId: id,
      workspaceId: result.ctx.workspaceId,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

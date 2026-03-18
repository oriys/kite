import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { abortKnowledgeSourceProcessing } from '@/lib/knowledge-processing-runtime'
import { notFound, withWorkspaceAuth } from '@/lib/api-utils'
import { knowledgeSources } from '@/lib/schema'

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

  if (existing.status !== 'processing') {
    return NextResponse.json(
      { error: 'Knowledge source is not processing' },
      { status: 409 },
    )
  }

  if (!existing.stopRequestedAt) {
    await db
      .update(knowledgeSources)
      .set({
        stopRequestedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, id))
  }

  abortKnowledgeSourceProcessing(id, 'Processing stopped by user')

  return NextResponse.json({ status: 'stopping' as const })
}

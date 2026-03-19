import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  abortKnowledgeSourceProcessing,
  hasActiveKnowledgeSourceProcessing,
} from '@/lib/knowledge-processing-runtime'
import { parsePublicHttpUrl } from '@/lib/outbound-http'
import { deriveTitleFromUrl } from '@/lib/public-url-content'
import { knowledgeSources } from '@/lib/schema'
import { badRequest, notFound, withWorkspaceAuth } from '@/lib/api-utils'

interface RouteContext {
  params: Promise<{ id: string }>
}

const DELETE_ABORT_REASON =
  'Processing stopped because the knowledge source was deleted'
const DELETE_WAIT_TIMEOUT_MS = 5_000
const DELETE_WAIT_INTERVAL_MS = 50

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForKnowledgeSourceProcessingToStop(sourceId: string) {
  const deadline = Date.now() + DELETE_WAIT_TIMEOUT_MS

  while (hasActiveKnowledgeSourceProcessing(sourceId) && Date.now() < deadline) {
    await sleep(DELETE_WAIT_INTERVAL_MS)
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await context.params

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const [existing] = await db
    .select({
      id: knowledgeSources.id,
      status: knowledgeSources.status,
      sourceType: knowledgeSources.sourceType,
      title: knowledgeSources.title,
      metadata: knowledgeSources.metadata,
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
      { error: 'Stop processing before editing this knowledge source' },
      { status: 409 },
    )
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  const existingMetadata = {
    ...((existing.metadata ?? {}) as Record<string, unknown>),
  }
  let nextMetadata: Record<string, unknown> | null = null

  if (typeof body.title === 'string') {
    const nextTitle = body.title.trim()
    if (!nextTitle) return badRequest('Title is required')
    updates.title = nextTitle
    if (
      existingMetadata.generatedTitleFromUrl
      || existingMetadata.generatedTitleFromWorkspace
    ) {
      nextMetadata = {
        ...existingMetadata,
        generatedTitleFromUrl: false,
        generatedTitleFromWorkspace: false,
      }
    }
  }
  if (typeof body.sourceUrl === 'string') {
    const nextSourceUrl = body.sourceUrl.trim()

    if (existing.sourceType === 'url') {
      if (!nextSourceUrl) return badRequest('Source URL is required')
      try {
        parsePublicHttpUrl(nextSourceUrl)
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : 'Invalid URL')
      }
    }

    updates.sourceUrl = nextSourceUrl

    if (
      existing.sourceType === 'url'
      && !('title' in body)
      && existingMetadata.generatedTitleFromUrl
    ) {
      updates.title = deriveTitleFromUrl(nextSourceUrl).trim() || existing.title
    }
  }
  if (typeof body.rawContent === 'string') updates.rawContent = body.rawContent
  if (body.metadata && typeof body.metadata === 'object') {
    updates.metadata =
      nextMetadata
        ? { ...(body.metadata as Record<string, unknown>), ...nextMetadata }
        : body.metadata
  } else if (nextMetadata) {
    updates.metadata = nextMetadata
  }

  const [updated] = await db
    .update(knowledgeSources)
    .set(updates)
    .where(eq(knowledgeSources.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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
    if (!existing.stopRequestedAt) {
      await db
        .update(knowledgeSources)
        .set({
          stopRequestedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(knowledgeSources.id, id))
    }

    abortKnowledgeSourceProcessing(id, DELETE_ABORT_REASON)
    await waitForKnowledgeSourceProcessingToStop(id)
  }

  await db
    .delete(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, id),
        eq(knowledgeSources.workspaceId, result.ctx.workspaceId),
      ),
    )

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { integrations, integrationLogs } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { handleSlackEvent } from '@/lib/integrations/providers/slack'
import { handleGithubEvent } from '@/lib/integrations/providers/github'
import { handleJiraEvent } from '@/lib/integrations/providers/jira'

const handlers: Record<
  string,
  (i: typeof integrations.$inferSelect, event: string, payload: Record<string, unknown>) => Promise<void>
> = {
  slack: handleSlackEvent,
  github: handleGithubEvent,
  jira: handleJiraEvent,
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.workspaceId, result.ctx.workspaceId),
    ),
  })

  if (!integration) return notFound()

  const handler = handlers[integration.provider]
  if (!handler) {
    return NextResponse.json(
      { success: false, error: 'Unknown provider' },
      { status: 400 },
    )
  }

  const testPayload = {
    title: 'Test Document',
    docTitle: 'Test Document',
    author: 'Kite',
    linkUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://kite.dev'}/docs`,
    decision: 'approved',
  }

  try {
    await handler(integration, 'document.published', testPayload)

    await db.insert(integrationLogs).values({
      integrationId: integration.id,
      event: 'test',
      direction: 'outbound',
      payload: testPayload,
      status: 'success',
    })

    if (integration.status !== 'connected') {
      await db
        .update(integrations)
        .set({ status: 'connected', statusMessage: null, updatedAt: new Date() })
        .where(eq(integrations.id, integration.id))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    await db.insert(integrationLogs).values({
      integrationId: integration.id,
      event: 'test',
      direction: 'outbound',
      payload: testPayload,
      status: 'failed',
      errorMessage: message,
    })

    return NextResponse.json(
      { success: false, error: message },
      { status: 502 },
    )
  }
}

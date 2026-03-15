import { db } from '@/lib/db'
import { integrations, integrationLogs } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { handleSlackEvent } from './providers/slack'
import { handleGithubEvent } from './providers/github'
import { handleJiraEvent } from './providers/jira'

type Integration = typeof integrations.$inferSelect

const providerHandlers: Record<
  string,
  (integration: Integration, event: string, payload: Record<string, unknown>) => Promise<void>
> = {
  slack: handleSlackEvent,
  github: handleGithubEvent,
  jira: handleJiraEvent,
}

export async function dispatchIntegrationEvent(
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const enabled = await db.query.integrations.findMany({
    where: and(
      eq(integrations.workspaceId, workspaceId),
      eq(integrations.enabled, true),
      eq(integrations.status, 'connected'),
    ),
  })

  const matching = enabled.filter((i) => {
    const events = i.events as string[]
    return events.includes(event) || events.includes('*')
  })

  return Promise.allSettled(
    matching.map((integration) =>
      executeHandler(integration, event, payload),
    ),
  )
}

async function executeHandler(
  integration: Integration,
  event: string,
  payload: Record<string, unknown>,
) {
  const handler = providerHandlers[integration.provider]
  if (!handler) return

  try {
    await handler(integration, event, payload)

    await db.insert(integrationLogs).values({
      integrationId: integration.id,
      event,
      direction: 'outbound',
      payload: payload as Record<string, unknown>,
      status: 'success',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    await db.insert(integrationLogs).values({
      integrationId: integration.id,
      event,
      direction: 'outbound',
      payload: payload as Record<string, unknown>,
      status: 'failed',
      errorMessage: message,
    })

    await db
      .update(integrations)
      .set({ status: 'error', statusMessage: message, updatedAt: new Date() })
      .where(eq(integrations.id, integration.id))

    throw error
  }
}

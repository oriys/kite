import { NextResponse } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { webhookDeliveries, channelDeliveries, webhooks, notificationChannels } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET() {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const [failedWebhooks, failedChannels] = await Promise.all([
    db
      .select({
        id: webhookDeliveries.id,
        webhookId: webhookDeliveries.webhookId,
        event: webhookDeliveries.event,
        errorMessage: webhookDeliveries.errorMessage,
        attemptCount: webhookDeliveries.attemptCount,
        createdAt: webhookDeliveries.createdAt,
      })
      .from(webhookDeliveries)
      .innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
      .where(
        and(
          eq(webhooks.workspaceId, result.ctx.workspaceId),
          eq(webhookDeliveries.status, 'failed'),
        ),
      )
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(50),
    db
      .select({
        id: channelDeliveries.id,
        channelId: channelDeliveries.channelId,
        notificationType: channelDeliveries.notificationType,
        errorMessage: channelDeliveries.errorMessage,
        attemptCount: channelDeliveries.attemptCount,
        createdAt: channelDeliveries.createdAt,
      })
      .from(channelDeliveries)
      .innerJoin(notificationChannels, eq(notificationChannels.id, channelDeliveries.channelId))
      .where(
        and(
          eq(notificationChannels.workspaceId, result.ctx.workspaceId),
          eq(channelDeliveries.status, 'failed'),
        ),
      )
      .orderBy(desc(channelDeliveries.createdAt))
      .limit(50),
  ])

  return NextResponse.json({
    webhooks: failedWebhooks,
    channels: failedChannels,
    total: failedWebhooks.length + failedChannels.length,
  })
}

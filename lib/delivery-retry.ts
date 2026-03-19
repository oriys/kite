import { db } from './db'
import {
  webhooks,
  webhookDeliveries,
  notificationChannels,
  channelDeliveries,
} from './schema'
import { eq, and, lte, sql, inArray } from 'drizzle-orm'
import { deliverToChannel, type NotificationPayload } from './notification-sender'

const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

export function computeBackoffDelay(attemptCount: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attemptCount), 300_000)
}

export async function processWebhookRetryQueue() {
  const pending = await db
    .select({
      id: webhookDeliveries.id,
      webhookId: webhookDeliveries.webhookId,
      event: webhookDeliveries.event,
      payload: webhookDeliveries.payload,
      attemptCount: webhookDeliveries.attemptCount,
    })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, 'failed'),
        sql`${webhookDeliveries.attemptCount} < ${MAX_RETRIES}`,
        lte(
          sql`coalesce(${webhookDeliveries.deliveredAt}, ${webhookDeliveries.createdAt})`,
          sql`now() - interval '1 minute'`,
        ),
      ),
    )
    .limit(50)

  if (pending.length === 0) return 0

  // Batch-load all referenced webhooks to avoid N+1
  const webhookIds = [...new Set(pending.map((d) => d.webhookId))]
  const webhookRows = await db.query.webhooks.findMany({
    where: inArray(webhooks.id, webhookIds),
  })
  const webhookMap = new Map(webhookRows.map((w) => [w.id, w]))

  let retried = 0
  for (const delivery of pending) {
    const wh = webhookMap.get(delivery.webhookId)
    if (!wh || !wh.isActive || wh.deletedAt) {
      // Webhook no longer active — mark as permanently failed
      await db
        .update(webhookDeliveries)
        .set({ errorMessage: 'Webhook inactive or deleted', attemptCount: MAX_RETRIES })
        .where(eq(webhookDeliveries.id, delivery.id))
      continue
    }

    try {
      const { parsePublicHttpUrl } = await import('./outbound-http')
      const body = JSON.stringify({
        event: delivery.event,
        payload: delivery.payload,
        timestamp: new Date().toISOString(),
      })

      const targetUrl = parsePublicHttpUrl(wh.url)
      const response = await fetch(targetUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Event': delivery.event },
        body,
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok) {
        await db
          .update(webhookDeliveries)
          .set({
            status: 'success',
            statusCode: response.status,
            attemptCount: delivery.attemptCount + 1,
            deliveredAt: new Date(),
            errorMessage: null,
          })
          .where(eq(webhookDeliveries.id, delivery.id))
        retried++
      } else {
        await db
          .update(webhookDeliveries)
          .set({
            statusCode: response.status,
            attemptCount: delivery.attemptCount + 1,
            deliveredAt: new Date(),
            errorMessage: `HTTP ${response.status}`,
          })
          .where(eq(webhookDeliveries.id, delivery.id))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      await db
        .update(webhookDeliveries)
        .set({
          attemptCount: delivery.attemptCount + 1,
          deliveredAt: new Date(),
          errorMessage: message,
        })
        .where(eq(webhookDeliveries.id, delivery.id))
    }
  }

  return retried
}

export async function processChannelRetryQueue() {
  const pending = await db
    .select({
      id: channelDeliveries.id,
      channelId: channelDeliveries.channelId,
      payload: channelDeliveries.payload,
      attemptCount: channelDeliveries.attemptCount,
    })
    .from(channelDeliveries)
    .where(
      and(
        eq(channelDeliveries.status, 'failed'),
        sql`${channelDeliveries.attemptCount} < ${MAX_RETRIES}`,
        lte(
          sql`coalesce(${channelDeliveries.deliveredAt}, ${channelDeliveries.createdAt})`,
          sql`now() - interval '1 minute'`,
        ),
      ),
    )
    .limit(50)

  if (pending.length === 0) return 0

  // Batch-load all referenced channels to avoid N+1
  const channelIds = [...new Set(pending.map((d) => d.channelId))]
  const channelRows = await db.query.notificationChannels.findMany({
    where: and(
      inArray(notificationChannels.id, channelIds),
      eq(notificationChannels.enabled, true),
    ),
  })
  const channelMap = new Map(channelRows.map((c) => [c.id, c]))

  let retried = 0
  for (const delivery of pending) {
    const channel = channelMap.get(delivery.channelId)
    if (!channel) {
      await db
        .update(channelDeliveries)
        .set({ errorMessage: 'Channel inactive or deleted', attemptCount: MAX_RETRIES })
        .where(eq(channelDeliveries.id, delivery.id))
      continue
    }

    try {
      const payload = delivery.payload as unknown as NotificationPayload
      // Update attempt count before delivery
      await db
        .update(channelDeliveries)
        .set({ attemptCount: delivery.attemptCount + 1, deliveredAt: new Date() })
        .where(eq(channelDeliveries.id, delivery.id))

      await deliverToChannel(channel, payload)

      await db
        .update(channelDeliveries)
        .set({ status: 'sent', deliveredAt: new Date() })
        .where(eq(channelDeliveries.id, delivery.id))
      retried++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      await db
        .update(channelDeliveries)
        .set({ errorMessage: message })
        .where(eq(channelDeliveries.id, delivery.id))
    }
  }

  return retried
}

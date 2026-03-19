import { db } from './db'
import { webhookDeliveries, channelDeliveries } from './schema'
import { eq, and, lte, sql } from 'drizzle-orm'

const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

export function computeBackoffDelay(attemptCount: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attemptCount), 300_000)
}

export async function processWebhookRetryQueue() {
  const pending = await db
    .select()
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

  return pending.length
}

export async function processChannelRetryQueue() {
  const pending = await db
    .select()
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

  return pending.length
}

import { desc, eq, and, isNull } from 'drizzle-orm'
import { db } from '../db'
import {
  getOutboundRequestErrorMessage,
  parsePublicHttpUrl,
} from '../outbound-http'
import { webhooks, webhookDeliveries } from '../schema'

export async function createWebhook(
  workspaceId: string,
  name: string,
  url: string,
  events: string[],
  createdBy: string,
) {
  const secret = crypto.randomUUID()
  const [wh] = await db
    .insert(webhooks)
    .values({ workspaceId, name, url, secret, events, createdBy })
    .returning()
  return wh
}

export async function listWebhooks(workspaceId: string) {
  return db
    .select({
      id: webhooks.id,
      name: webhooks.name,
      url: webhooks.url,
      events: webhooks.events,
      isActive: webhooks.isActive,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    })
    .from(webhooks)
    .where(and(eq(webhooks.workspaceId, workspaceId), isNull(webhooks.deletedAt)))
    .orderBy(desc(webhooks.createdAt))
}

export async function getWebhook(id: string) {
  return (await db.query.webhooks.findFirst({
    where: and(eq(webhooks.id, id), isNull(webhooks.deletedAt)),
  })) ?? null
}

export async function updateWebhook(
  id: string,
  data: Partial<{
    name: string
    url: string
    events: string[]
    isActive: boolean
  }>,
) {
  const [wh] = await db
    .update(webhooks)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(webhooks.id, id), isNull(webhooks.deletedAt)))
    .returning()
  return wh ?? null
}

export async function deleteWebhook(id: string) {
  await db
    .update(webhooks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(webhooks.id, id), isNull(webhooks.deletedAt)))
}

export async function listWebhookDeliveries(
  webhookId: string,
  limit = 20,
  offset = 0,
) {
  return db
    .select({
      id: webhookDeliveries.id,
      event: webhookDeliveries.event,
      status: webhookDeliveries.status,
      statusCode: webhookDeliveries.statusCode,
      errorMessage: webhookDeliveries.errorMessage,
      attemptCount: webhookDeliveries.attemptCount,
      deliveredAt: webhookDeliveries.deliveredAt,
      createdAt: webhookDeliveries.createdAt,
    })
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit)
    .offset(offset)
}

/** Dispatch a webhook event to all matching webhooks in a workspace */
export async function dispatchWebhookEvent(
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const activeWebhooks = await db.query.webhooks.findMany({
    where: and(
      eq(webhooks.workspaceId, workspaceId),
      eq(webhooks.isActive, true),
      isNull(webhooks.deletedAt),
    ),
  })

  const matching = activeWebhooks.filter((wh) => {
    const events = wh.events as string[]
    return events.length === 0 || events.includes(event)
  })

  const results = await Promise.allSettled(
    matching.map((wh) => deliverWebhook(wh, event, payload)),
  )

  return results.length
}

async function deliverWebhook(
  wh: typeof webhooks.$inferSelect,
  event: string,
  payload: Record<string, unknown>,
) {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() })
  const signature = await computeHmac(wh.secret, body)

  let status: 'success' | 'failed' = 'failed'
  let statusCode: number | null = null
  let responseBody: string | null = null
  let errorMessage: string | null = null

  try {
    const targetUrl = parsePublicHttpUrl(wh.url)
    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
      },
      body,
      signal: AbortSignal.timeout(10000),
    })
    statusCode = response.status
    responseBody = await response.text().catch(() => null)
    status = response.ok ? 'success' : 'failed'
    if (!response.ok) errorMessage = `HTTP ${response.status}`
  } catch (err) {
    errorMessage = getOutboundRequestErrorMessage(err, 10_000)
  }

  await db.insert(webhookDeliveries).values({
    webhookId: wh.id,
    event,
    payload,
    status,
    statusCode,
    responseBody,
    errorMessage,
    attemptCount: 1,
    deliveredAt: new Date(),
  })
}

async function computeHmac(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

import { desc, eq, and } from 'drizzle-orm'
import { db } from '../db'
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
  return db.query.webhooks.findMany({
    where: eq(webhooks.workspaceId, workspaceId),
    orderBy: [desc(webhooks.createdAt)],
  })
}

export async function getWebhook(id: string) {
  return (await db.query.webhooks.findFirst({
    where: eq(webhooks.id, id),
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
    .where(eq(webhooks.id, id))
    .returning()
  return wh ?? null
}

export async function deleteWebhook(id: string) {
  await db.delete(webhooks).where(eq(webhooks.id, id))
}

export async function listWebhookDeliveries(
  webhookId: string,
  limit = 20,
  offset = 0,
) {
  return db.query.webhookDeliveries.findMany({
    where: eq(webhookDeliveries.webhookId, webhookId),
    orderBy: [desc(webhookDeliveries.createdAt)],
    limit,
    offset,
  })
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
    const response = await fetch(wh.url, {
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
    errorMessage = err instanceof Error ? err.message : 'Unknown error'
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

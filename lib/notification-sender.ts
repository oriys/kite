import { Resend } from 'resend'
import { db } from './db'
import { notificationChannels, channelDeliveries } from './schema'
import { eq, and } from 'drizzle-orm'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export interface NotificationPayload {
  type: string
  title: string
  body: string
  linkUrl?: string
  workspaceId: string
  actorName?: string
}

export async function dispatchToChannels(payload: NotificationPayload) {
  const channels = await db.query.notificationChannels.findMany({
    where: and(
      eq(notificationChannels.workspaceId, payload.workspaceId),
      eq(notificationChannels.enabled, true),
    ),
  })

  const matching = channels.filter((ch) => {
    const events = ch.events as string[]
    return events.includes(payload.type) || events.includes('*')
  })

  return Promise.allSettled(
    matching.map((channel) => deliverToChannel(channel, payload)),
  )
}

export async function deliverToSingleChannel(
  channelId: string,
  payload: NotificationPayload,
) {
  const channel = await db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, channelId),
  })

  if (!channel) throw new Error('Channel not found')

  return deliverToChannel(channel, payload)
}

export async function replayChannelDelivery(deliveryId: string, channelId: string) {
  const delivery = await db.query.channelDeliveries.findFirst({
    where: and(
      eq(channelDeliveries.id, deliveryId),
      eq(channelDeliveries.channelId, channelId),
    ),
  })

  if (!delivery) return null

  const channel = await db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, channelId),
  })

  if (!channel) return null

  await deliverToChannel(channel, delivery.payload as unknown as NotificationPayload)
  return true
}

async function deliverToChannel(
  channel: typeof notificationChannels.$inferSelect,
  payload: NotificationPayload,
) {
  const [delivery] = await db
    .insert(channelDeliveries)
    .values({
      channelId: channel.id,
      notificationType: payload.type,
      payload: payload as unknown as Record<string, unknown>,
      status: 'pending',
    })
    .returning()

  try {
    if (channel.channelType === 'email') {
      await sendEmail(channel, payload)
    } else if (channel.channelType === 'slack_webhook') {
      await sendSlack(channel, payload)
    }

    await db
      .update(channelDeliveries)
      .set({ status: 'sent', deliveredAt: new Date(), attemptCount: 1 })
      .where(eq(channelDeliveries.id, delivery.id))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    await db
      .update(channelDeliveries)
      .set({ status: 'failed', errorMessage: message, attemptCount: 1 })
      .where(eq(channelDeliveries.id, delivery.id))
    throw error
  }
}

async function sendEmail(
  channel: typeof notificationChannels.$inferSelect,
  payload: NotificationPayload,
) {
  if (!resend) throw new Error('RESEND_API_KEY not configured')
  const config = channel.config as { email: string }

  await resend.emails.send({
    from: 'Kite <notifications@kite.dev>',
    to: config.email,
    subject: payload.title,
    html: buildEmailHtml(payload),
  })
}

async function sendSlack(
  channel: typeof notificationChannels.$inferSelect,
  payload: NotificationPayload,
) {
  const config = channel.config as { webhookUrl: string; channel?: string }

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: payload.title,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${payload.title}*\n${payload.body}`,
          },
        },
        ...(payload.linkUrl
          ? [
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: 'View in Kite' },
                    url: payload.linkUrl,
                  },
                ],
              },
            ]
          : []),
      ],
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(
      `Slack webhook failed: ${response.status} ${response.statusText}`,
    )
  }
}

function buildEmailHtml(payload: NotificationPayload): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 1px solid #e5e5e5; padding-bottom: 16px; margin-bottom: 16px;">
        <strong style="font-size: 16px; color: #171717;">Kite</strong>
      </div>
      <h2 style="font-size: 18px; color: #171717; margin: 0 0 8px;">${payload.title}</h2>
      <p style="font-size: 14px; color: #525252; line-height: 1.6; margin: 0 0 16px;">${payload.body}</p>
      ${
        payload.linkUrl
          ? `<a href="${payload.linkUrl}" style="display: inline-block; padding: 8px 16px; background: #171717; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13px;">View in Kite</a>`
          : ''
      }
      <div style="border-top: 1px solid #e5e5e5; padding-top: 16px; margin-top: 24px;">
        <p style="font-size: 12px; color: #a3a3a3; margin: 0;">You received this because of your notification channel settings in Kite.</p>
      </div>
    </div>
  `
}

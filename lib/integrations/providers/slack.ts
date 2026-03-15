import type { integrations } from '@/lib/schema'

type Integration = typeof integrations.$inferSelect

interface SlackConfig {
  webhookUrl: string
  channel?: string
}

const EVENT_MESSAGES: Record<
  string,
  (payload: Record<string, unknown>) => { text: string; emoji: string }
> = {
  'document.published': (p) => ({
    text: `Document published: *${p.title ?? 'Untitled'}*`,
    emoji: '📄',
  }),
  'comment.created': (p) => ({
    text: `New comment on *${p.docTitle ?? 'a document'}* by ${p.author ?? 'someone'}`,
    emoji: '💬',
  }),
  'approval.requested': (p) => ({
    text: `Approval requested for *${p.docTitle ?? 'a document'}*`,
    emoji: '✋',
  }),
  'approval.decided': (p) => ({
    text: `*${p.docTitle ?? 'A document'}* was ${p.decision === 'approved' ? 'approved ✅' : 'rejected ❌'}`,
    emoji: p.decision === 'approved' ? '✅' : '❌',
  }),
}

function buildBlocks(event: string, payload: Record<string, unknown>) {
  const mapper = EVENT_MESSAGES[event]
  const { text, emoji } = mapper
    ? mapper(payload)
    : { text: `Event: ${event}`, emoji: 'ℹ️' }

  const blocks: Record<string, unknown>[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} ${text}`,
      },
    },
  ]

  if (typeof payload.linkUrl === 'string') {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Kite' },
          url: payload.linkUrl,
        },
      ],
    })
  }

  return blocks
}

export async function handleSlackEvent(
  integration: Integration,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const config = integration.config as SlackConfig

  if (!config.webhookUrl) {
    throw new Error('Slack webhook URL not configured')
  }

  const blocks = buildBlocks(event, payload)
  const mapper = EVENT_MESSAGES[event]
  const fallbackText = mapper
    ? mapper(payload).text
    : `Kite event: ${event}`

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: fallbackText,
      blocks,
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(
      `Slack webhook failed: ${response.status} ${response.statusText}`,
    )
  }
}

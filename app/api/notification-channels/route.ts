import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import {
  listNotificationChannels,
  createNotificationChannel,
} from '@/lib/queries/notification-channels'

const MAX_NAME_LENGTH = 100
const VALID_CHANNEL_TYPES = ['email', 'slack_webhook'] as const
const VALID_EVENTS = [
  'comment',
  'mention',
  'approval_request',
  'approval_decision',
  'status_change',
  'webhook_failure',
  'system',
  '*',
]

export async function GET() {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const items = await listNotificationChannels(result.ctx.workspaceId)
  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const channelType = body.channelType as string
  if (!VALID_CHANNEL_TYPES.includes(channelType as (typeof VALID_CHANNEL_TYPES)[number])) {
    return badRequest('Invalid channel type. Must be "email" or "slack_webhook".')
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > MAX_NAME_LENGTH) {
    return badRequest('Name is required (max 100 chars)')
  }

  const config = body.config
  if (!config || typeof config !== 'object') {
    return badRequest('Config is required')
  }

  if (channelType === 'email') {
    if (typeof config.email !== 'string' || !config.email.includes('@')) {
      return badRequest('A valid email address is required')
    }
  } else if (channelType === 'slack_webhook') {
    if (
      typeof config.webhookUrl !== 'string' ||
      !config.webhookUrl.startsWith('https://')
    ) {
      return badRequest('A valid HTTPS webhook URL is required')
    }
  }

  const events = Array.isArray(body.events) ? body.events : []
  const validEvents = events.filter((e: unknown) =>
    VALID_EVENTS.includes(e as string),
  )
  if (validEvents.length === 0) {
    return badRequest('At least one valid event is required')
  }

  const channel = await createNotificationChannel(
    result.ctx.workspaceId,
    result.ctx.userId,
    {
      channelType: channelType as 'email' | 'slack_webhook',
      name,
      config,
      events: validEvents,
    },
  )

  return NextResponse.json(channel, { status: 201 })
}

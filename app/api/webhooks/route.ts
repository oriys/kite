import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { parsePublicHttpUrl } from '@/lib/outbound-http'
import { listWebhooks, createWebhook } from '@/lib/queries/webhooks'

function serializeWebhookSummary(webhook: {
  id: string
  name: string
  url: string
  events: string[]
  isActive: boolean
  createdAt: Date
  updatedAt?: Date
}) {
  return {
    id: webhook.id,
    name: webhook.name,
    url: webhook.url,
    events: webhook.events,
    isActive: webhook.isActive,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt ?? webhook.createdAt,
  }
}

const MAX_NAME_LENGTH = 100
const MAX_URL_LENGTH = 2048

export async function GET() {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const items = await listWebhooks(result.ctx.workspaceId)
  return NextResponse.json(items.map((item) => serializeWebhookSummary(item)))
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  let url = typeof body.url === 'string' ? body.url.trim() : ''
  const events = Array.isArray(body.events) ? body.events : []

  if (!name || name.length > MAX_NAME_LENGTH)
    return badRequest('Name is required (max 100 chars)')
  if (!url || url.length > MAX_URL_LENGTH)
    return badRequest('URL is required')
  try {
    url = parsePublicHttpUrl(url).toString()
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Invalid URL')
  }

  const wh = await createWebhook(
    result.ctx.workspaceId,
    name,
    url,
    events,
    result.ctx.userId,
  )

  return NextResponse.json(serializeWebhookSummary(wh), { status: 201 })
}

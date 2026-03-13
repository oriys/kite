import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { parsePublicHttpUrl } from '@/lib/outbound-http'
import { getWebhook, updateWebhook, deleteWebhook } from '@/lib/queries/webhooks'

function serializeWebhookSummary(webhook: {
  id: string
  name: string
  url: string
  events: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: webhook.id,
    name: webhook.name,
    url: webhook.url,
    events: webhook.events,
    isActive: webhook.isActive,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { id } = await params
  const wh = await getWebhook(id)
  if (!wh) return notFound()

  return NextResponse.json(wh)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string') data.name = body.name.trim()
  if (typeof body.url === 'string') {
    try {
      data.url = parsePublicHttpUrl(body.url.trim()).toString()
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : 'Invalid URL')
    }
  }
  if (Array.isArray(body.events)) data.events = body.events
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive

  const wh = await updateWebhook(id, data)
  if (!wh) return notFound()

  return NextResponse.json(serializeWebhookSummary(wh))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { id } = await params
  await deleteWebhook(id)
  return NextResponse.json({ success: true })
}

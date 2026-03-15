import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import {
  getNotificationChannel,
  updateNotificationChannel,
  deleteNotificationChannel,
} from '@/lib/queries/notification-channels'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const channel = await getNotificationChannel(id, result.ctx.workspaceId)
  if (!channel) return notFound()

  return NextResponse.json(channel)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string') data.name = body.name.trim()
  if (typeof body.enabled === 'boolean') data.enabled = body.enabled
  if (Array.isArray(body.events)) data.events = body.events
  if (body.config && typeof body.config === 'object') data.config = body.config

  const channel = await updateNotificationChannel(
    id,
    result.ctx.workspaceId,
    data,
  )
  if (!channel) return notFound()

  return NextResponse.json(channel)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  await deleteNotificationChannel(id, result.ctx.workspaceId)
  return NextResponse.json({ success: true })
}

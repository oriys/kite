import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { getNotificationChannel } from '@/lib/queries/notification-channels'
import { deliverToSingleChannel } from '@/lib/notification-sender'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const channel = await getNotificationChannel(id, result.ctx.workspaceId)
  if (!channel) return notFound()

  try {
    await deliverToSingleChannel(channel.id, {
      type: 'system',
      title: 'Test notification from Kite',
      body: 'If you received this, your notification channel is configured correctly.',
      workspaceId: result.ctx.workspaceId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delivery failed'
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 },
    )
  }
}

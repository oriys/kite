import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { replayWebhookDelivery } from '@/lib/queries/webhooks'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; deliveryId: string }> },
) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { id, deliveryId } = await params
  const replayed = await replayWebhookDelivery(deliveryId, id, result.ctx.workspaceId)
  if (!replayed) return notFound()

  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { getWebhook, dispatchWebhookEvent } from '@/lib/queries/webhooks'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { id } = await params
  const wh = await getWebhook(id)
  if (!wh) return notFound()

  await dispatchWebhookEvent(result.ctx.workspaceId, 'webhook.test', {
    message: 'This is a test webhook delivery',
    webhookId: id,
    triggeredBy: result.ctx.userId,
  })

  return NextResponse.json({ success: true })
}

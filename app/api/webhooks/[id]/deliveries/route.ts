import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { listWebhookDeliveries } from '@/lib/queries/webhooks'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { id } = await params
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 20), 100)
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? 0)

  const deliveries = await listWebhookDeliveries(id, result.ctx.workspaceId, limit, offset)
  return NextResponse.json(deliveries)
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { processScheduledPublications } from '@/lib/scheduled-publisher'
import { processWebhookRetryQueue, processChannelRetryQueue } from '@/lib/delivery-retry'

/**
 * POST /api/ops/cron
 * Runs all background processors. Protected by CRON_SECRET bearer token.
 * Call from external scheduler (Vercel cron, GitHub Actions, etc.) every 1-5 minutes.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [publications, webhookRetries, channelRetries] = await Promise.allSettled([
    processScheduledPublications(),
    processWebhookRetryQueue(),
    processChannelRetryQueue(),
  ])

  return NextResponse.json({
    scheduledPublications:
      publications.status === 'fulfilled'
        ? { ok: true, results: publications.value }
        : { ok: false, error: publications.reason?.message ?? 'Unknown error' },
    webhookRetries:
      webhookRetries.status === 'fulfilled'
        ? { ok: true, retried: webhookRetries.value }
        : { ok: false, error: webhookRetries.reason?.message ?? 'Unknown error' },
    channelRetries:
      channelRetries.status === 'fulfilled'
        ? { ok: true, retried: channelRetries.value }
        : { ok: false, error: channelRetries.reason?.message ?? 'Unknown error' },
  })
}

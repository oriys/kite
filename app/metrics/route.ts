import { getMetricsContentType, renderMetrics } from '@/lib/observability/metrics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(await renderMetrics(), {
    status: 200,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'content-type': getMetricsContentType(),
    },
  })
}

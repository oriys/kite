import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { listAuditLogs, type AuditAction } from '@/lib/queries/audit-logs'
import { parsePagination } from '@/lib/pagination'

const VALID_ACTIONS: AuditAction[] = [
  'create', 'update', 'delete', 'publish', 'archive',
  'approve', 'reject', 'status_change', 'visibility_change', 'login', 'export',
]

export async function GET(request: NextRequest) {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const action = searchParams.get('action') as AuditAction | null
  const resourceType = searchParams.get('resourceType')
  const actorId = searchParams.get('actorId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const { limit, offset } = parsePagination(searchParams, { limit: 50, maxLimit: 100 })

  if (action && !VALID_ACTIONS.includes(action))
    return badRequest('Invalid action filter')

  const data = await listAuditLogs(result.ctx.workspaceId, {
    limit,
    offset,
    action: action ?? undefined,
    resourceType: resourceType ?? undefined,
    actorId: actorId ?? undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  })

  return NextResponse.json(data)
}

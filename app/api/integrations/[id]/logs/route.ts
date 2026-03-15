import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { integrations, integrationLogs } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.workspaceId, result.ctx.workspaceId),
    ),
    columns: { id: true },
  })

  if (!integration) return notFound()

  const limit = Math.min(
    Number(request.nextUrl.searchParams.get('limit') ?? 20),
    100,
  )

  const logs = await db
    .select()
    .from(integrationLogs)
    .where(eq(integrationLogs.integrationId, id))
    .orderBy(desc(integrationLogs.createdAt))
    .limit(limit)

  return NextResponse.json(logs)
}

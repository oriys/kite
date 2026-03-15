import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { mockServerConfigs } from '@/lib/schema-mock'
import { openapiSources } from '@/lib/schema-openapi'

export async function GET() {
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const configs = await db
    .select()
    .from(mockServerConfigs)
    .where(eq(mockServerConfigs.workspaceId, ctx.workspaceId))
    .orderBy(desc(mockServerConfigs.createdAt))

  return NextResponse.json(configs)
}

export async function POST(req: NextRequest) {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { openapiSourceId, delay, errorRate, seed } = body as {
    openapiSourceId?: string
    delay?: number
    errorRate?: number
    seed?: number | null
  }

  if (!openapiSourceId) return badRequest('openapiSourceId is required')

  const source = await db.query.openapiSources.findFirst({
    where: and(
      eq(openapiSources.id, openapiSourceId),
      eq(openapiSources.workspaceId, ctx.workspaceId),
    ),
  })
  if (!source) return badRequest('OpenAPI source not found')

  const [config] = await db
    .insert(mockServerConfigs)
    .values({
      workspaceId: ctx.workspaceId,
      openapiSourceId,
      delay: delay ?? 0,
      errorRate: errorRate ?? 0,
      seed: seed ?? null,
    })
    .returning()

  return NextResponse.json(config, { status: 201 })
}

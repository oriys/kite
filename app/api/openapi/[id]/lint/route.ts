import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { openapiSources, lintResults, lintRulesets } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'
import { lintOpenApiSpec } from '@/lib/openapi/linter'

/**
 * POST /api/openapi/[id]/lint — Run lint on an OpenAPI source.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params

  const source = await db.query.openapiSources.findFirst({
    where: eq(openapiSources.id, id),
  })
  if (!source || source.workspaceId !== ctx.workspaceId) {
    return notFound()
  }

  const ruleset = await db.query.lintRulesets.findFirst({
    where: and(
      eq(lintRulesets.workspaceId, ctx.workspaceId),
      eq(lintRulesets.isDefault, true),
    ),
  })

  const rawContent =
    typeof source.rawContent === 'string'
      ? source.rawContent
      : JSON.stringify(source.rawContent)

  const summary = await lintOpenApiSpec(
    rawContent,
    (ruleset?.rules as Record<string, unknown>) ?? undefined,
  )

  const [result] = await db
    .insert(lintResults)
    .values({
      openapiSourceId: id,
      rulesetId: ruleset?.id ?? null,
      results: summary.issues,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      infoCount: summary.infoCount,
      hintCount: summary.hintCount,
    })
    .returning()

  return NextResponse.json(result)
}

/**
 * GET /api/openapi/[id]/lint — Get latest lint results.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const { id } = await params

  const source = await db.query.openapiSources.findFirst({
    where: eq(openapiSources.id, id),
    columns: { id: true, workspaceId: true },
  })
  if (!source || source.workspaceId !== ctx.workspaceId) {
    return notFound()
  }

  const latest = await db.query.lintResults.findFirst({
    where: eq(lintResults.openapiSourceId, id),
    orderBy: desc(lintResults.ranAt),
  })

  if (!latest) {
    return NextResponse.json({
      results: [],
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      hintCount: 0,
    })
  }

  return NextResponse.json(latest)
}

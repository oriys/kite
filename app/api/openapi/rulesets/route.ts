import { NextRequest, NextResponse } from 'next/server'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { lintRulesets } from '@/lib/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/openapi/rulesets — List rulesets for the current workspace.
 */
export async function GET(_req: NextRequest) {
  const authResult = await withWorkspaceAuth('guest')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const rulesets = await db.query.lintRulesets.findMany({
    where: eq(lintRulesets.workspaceId, ctx.workspaceId),
  })

  return NextResponse.json(rulesets)
}

/**
 * POST /api/openapi/rulesets — Create a new ruleset.
 */
export async function POST(req: NextRequest) {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { name, description, rules, isDefault } = body
  if (!name || !rules) {
    return badRequest('name and rules are required')
  }

  const [ruleset] = await db
    .insert(lintRulesets)
    .values({
      workspaceId: ctx.workspaceId,
      name,
      description: description ?? '',
      rules,
      isDefault: isDefault ?? false,
    })
    .returning()

  return NextResponse.json(ruleset, { status: 201 })
}

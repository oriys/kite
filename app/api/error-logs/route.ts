import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { desc, eq, and, gte, lte, sql, count, type SQL } from 'drizzle-orm'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { withRouteObservability } from '@/lib/observability/route-handler'
import { errorLogs } from '@/lib/schema-errors'

function buildWhereClause(conditions: SQL[]) {
  return conditions.length > 0 ? and(...conditions) : undefined
}

/**
 * GET /api/error-logs
 * Admin-only: paginated, filterable error log viewer.
 *
 * Query params:
 *   page, limit, source, level, resolved, from, to, fingerprint, search
 */
async function getErrorLogs(request: NextRequest) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error
  const { ctx } = result

  const params = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  const source = params.get('source')
  const level = params.get('level')
  const resolved = params.get('resolved')
  const from = params.get('from')
  const to = params.get('to')
  const fingerprint = params.get('fingerprint')
  const search = params.get('search')?.trim()

  const scopeConditions = [eq(errorLogs.workspaceId, ctx.workspaceId)]
  const conditions = [...scopeConditions]

  if (source) {
    conditions.push(eq(errorLogs.source, source as typeof errorLogs.source.enumValues[number]))
  }
  if (level) {
    conditions.push(eq(errorLogs.level, level as typeof errorLogs.level.enumValues[number]))
  }
  if (resolved === 'true') {
    conditions.push(eq(errorLogs.resolved, true))
  } else if (resolved === 'false') {
    conditions.push(eq(errorLogs.resolved, false))
  }
  if (from) {
    const d = new Date(from)
    if (!isNaN(d.getTime())) {
      conditions.push(gte(errorLogs.occurredAt, d))
    }
  }
  if (to) {
    const d = new Date(to)
    if (!isNaN(d.getTime())) {
      conditions.push(lte(errorLogs.occurredAt, d))
    }
  }
  if (fingerprint) {
    conditions.push(eq(errorLogs.fingerprint, fingerprint))
  }
  if (search) {
    conditions.push(
      sql`(
        ${errorLogs.errorMessage} ILIKE ${'%' + search + '%'}
        OR ${errorLogs.errorName} ILIKE ${'%' + search + '%'}
        OR ${errorLogs.httpUrl} ILIKE ${'%' + search + '%'}
        OR ${errorLogs.fingerprint} ILIKE ${'%' + search + '%'}
        OR ${errorLogs.requestId} ILIKE ${'%' + search + '%'}
      )`,
    )
  }

  const where = buildWhereClause(conditions)
  const scopeWhere = buildWhereClause(scopeConditions)
  const unresolvedWhere = buildWhereClause([...scopeConditions, eq(errorLogs.resolved, false)])
  const resolvedWhere = buildWhereClause([...scopeConditions, eq(errorLogs.resolved, true)])
  const clientWhere = buildWhereClause([...scopeConditions, eq(errorLogs.source, 'client')])
  const occurrencesExpr = sql<number>`count(*)`
  const lastOccurredAtExpr = sql<Date>`max(${errorLogs.occurredAt})`

  const [items, [filteredTotal], [scopeTotal], [unresolved], [resolvedCount], [clientCount], groups] = await Promise.all([
    db
      .select()
      .from(errorLogs)
      .where(where)
      .orderBy(desc(errorLogs.occurredAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(errorLogs)
      .where(where),
    db
      .select({ count: count() })
      .from(errorLogs)
      .where(scopeWhere),
    db
      .select({ count: count() })
      .from(errorLogs)
      .where(unresolvedWhere),
    db
      .select({ count: count() })
      .from(errorLogs)
      .where(resolvedWhere),
    db
      .select({ count: count() })
      .from(errorLogs)
      .where(clientWhere),
    db
      .select({
        fingerprint: errorLogs.fingerprint,
        errorName: errorLogs.errorName,
        errorMessage: errorLogs.errorMessage,
        source: errorLogs.source,
        level: errorLogs.level,
        occurrences: occurrencesExpr,
        lastOccurredAt: lastOccurredAtExpr,
      })
      .from(errorLogs)
      .where(unresolvedWhere ?? scopeWhere)
      .groupBy(
        errorLogs.fingerprint,
        errorLogs.errorName,
        errorLogs.errorMessage,
        errorLogs.source,
        errorLogs.level,
      )
      .orderBy(desc(occurrencesExpr), desc(lastOccurredAtExpr))
      .limit(6),
  ])

  const filteredTotalCount = filteredTotal?.count ?? 0
  const scopeTotalCount = scopeTotal?.count ?? 0
  const clientCountValue = clientCount?.count ?? 0

  return NextResponse.json({
    items,
    pagination: {
      page,
      limit,
      total: filteredTotalCount,
      totalPages: Math.ceil(filteredTotalCount / limit),
    },
    summary: {
      total: scopeTotalCount,
      unresolved: unresolved?.count ?? 0,
      resolved: resolvedCount?.count ?? 0,
      client: clientCountValue,
      server: Math.max(0, scopeTotalCount - clientCountValue),
      groups,
    },
  })
}

/**
 * PATCH /api/error-logs
 * Admin-only: mark errors as resolved / unresolve.
 * Body: { ids: string[], resolved: boolean, note?: string }
 */
async function patchErrorLogs(request: NextRequest) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error
  const { ctx } = result

  let body: { ids?: string[]; resolved?: boolean; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { ids, resolved: resolvedFlag, note } = body
  if (!Array.isArray(ids) || ids.length === 0 || typeof resolvedFlag !== 'boolean') {
    return NextResponse.json(
      { error: 'ids (string[]) and resolved (boolean) are required' },
      { status: 400 },
    )
  }

  const capped = ids.slice(0, 200)

  const updated = await db
    .update(errorLogs)
    .set({
      resolved: resolvedFlag,
      resolvedAt: resolvedFlag ? new Date() : null,
      resolvedBy: resolvedFlag ? ctx.userId : null,
      resolvedNote: note ?? null,
    })
    .where(and(eq(errorLogs.workspaceId, ctx.workspaceId), sql`${errorLogs.id} = ANY(${capped})`))
    .returning({ id: errorLogs.id })

  return NextResponse.json({ updated: updated.length })
}

export const GET = withRouteObservability(getErrorLogs, {
  route: '/api/error-logs',
})

export const PATCH = withRouteObservability(patchErrorLogs, {
  route: '/api/error-logs',
})

import { sql } from 'drizzle-orm'
import { type RagVisibilityContext } from '@/lib/rag/types'

type VisibilityContext = RagVisibilityContext

export function escapeLikePattern(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&')
}

/**
 * Build a SQL fragment that filters documents by visibility.
 * Admins/owners see everything. Members see public + partner + own + explicitly permitted.
 * `tableAlias` must match the alias used in the query (e.g. 'd' for `documents d`).
 */
export function buildVisibilityFilter(
  tableAlias: string,
  ctx: VisibilityContext | undefined,
) {
  if (!ctx) return sql``
  if (ctx.role === 'owner' || ctx.role === 'admin') return sql``

  return sql`AND (
    ${sql.raw(tableAlias)}.visibility IN ('public', 'partner')
    OR ${sql.raw(tableAlias)}.created_by = ${ctx.userId}
    OR EXISTS (
      SELECT 1 FROM document_permissions dp
      WHERE dp.document_id = ${sql.raw(tableAlias)}.id
        AND dp.user_id = ${ctx.userId}
    )
  )`
}

export function isMissingSearchVectorColumnError(error: unknown) {
  return (
    error instanceof Error
    && error.message.includes('search_vector')
    && error.message.includes('does not exist')
  )
}

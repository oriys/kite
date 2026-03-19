/**
 * Standardized pagination parsing for API routes.
 * Accepts both page/pageSize and limit/offset styles for backwards compatibility.
 */

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 200

interface PaginationResult {
  limit: number
  offset: number
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults?: { limit?: number; maxLimit?: number },
): PaginationResult {
  const maxLimit = defaults?.maxLimit ?? MAX_LIMIT
  const defaultLimit = defaults?.limit ?? DEFAULT_LIMIT

  // Check for limit/offset style first
  const rawLimit = searchParams.get('limit')
  const rawOffset = searchParams.get('offset')

  if (rawLimit !== null || rawOffset !== null) {
    const limit = Math.min(Math.max(1, parseInt(rawLimit ?? String(defaultLimit), 10) || defaultLimit), maxLimit)
    const offset = Math.max(0, parseInt(rawOffset ?? '0', 10) || 0)
    return { limit, offset }
  }

  // Fall back to page/pageSize style
  const rawPage = searchParams.get('page')
  const rawPageSize = searchParams.get('page_size') ?? searchParams.get('pageSize')

  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1)
  const pageSize = Math.min(Math.max(1, parseInt(rawPageSize ?? String(defaultLimit), 10) || defaultLimit), maxLimit)

  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  }
}

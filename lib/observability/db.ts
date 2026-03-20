import type postgres from 'postgres'
import { logger, toErrorFields } from '@/lib/observability/logger'
import {
  setDbPoolMaxConnections,
  startDbQueryMetric,
} from '@/lib/observability/metrics'

const OBSERVED_SQL_CLIENT = Symbol.for('kite.observedSqlClient')
const SLOW_QUERY_THRESHOLD_MS = Number.parseInt(
  process.env.OBSERVABILITY_SLOW_SQL_MS ?? '200',
  10,
)

type ObservedSqlClient<TTypes extends Record<string, unknown>> = postgres.Sql<TTypes> & {
  [OBSERVED_SQL_CLIENT]?: boolean
}

type PendingQueryLike = Promise<unknown> & {
  resolve?: (value: unknown) => void
  reject?: (error: unknown) => void
}

function sanitizeTableName(tableName: string | undefined) {
  if (!tableName) return 'unknown'

  return tableName
    .replace(/["`;(),]/g, '')
    .split('.')
    .pop()
    ?.trim()
    .toLowerCase()
    ?? 'unknown'
}

function extractOperation(normalizedQuery: string) {
  const initialOperation = normalizedQuery.split(/\s+/, 1)[0]?.toLowerCase() ?? 'other'

  if (initialOperation === 'with') {
    return normalizedQuery.match(/\b(select|insert|update|delete)\b/i)?.[1]?.toLowerCase() ?? 'with'
  }

  if (initialOperation === 'begin') return 'tx_begin'
  if (initialOperation === 'commit') return 'tx_commit'
  if (initialOperation === 'rollback') return 'tx_rollback'
  if (initialOperation === 'savepoint') return 'tx_begin'
  if (initialOperation === 'release') return 'tx_commit'

  return initialOperation
}

function extractTable(normalizedQuery: string, operation: string) {
  if (operation.startsWith('tx_')) return 'transaction'

  const match = operation === 'insert'
    ? normalizedQuery.match(/\binto\s+([a-zA-Z0-9_."]+)/i)
    : operation === 'update'
      ? normalizedQuery.match(/\bupdate\s+([a-zA-Z0-9_."]+)/i)
      : normalizedQuery.match(/\bfrom\s+([a-zA-Z0-9_."]+)/i)
      ?? normalizedQuery.match(/\bjoin\s+([a-zA-Z0-9_."]+)/i)

  return sanitizeTableName(match?.[1])
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return 'unknown'
  }

  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' || typeof code === 'number') {
    return String(code)
  }

  return 'unknown'
}

function getRowCount(result: unknown) {
  if (Array.isArray(result)) {
    return result.length
  }

  if (!result || typeof result !== 'object' || !('count' in result)) {
    return undefined
  }

  const count = (result as { count?: unknown }).count
  return typeof count === 'number' ? count : undefined
}

export function parseSqlMetadata(query: string) {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim()
  const operation = extractOperation(normalizedQuery)

  return {
    operation,
    table: extractTable(normalizedQuery, operation),
  }
}

export function instrumentPostgresClient<TTypes extends Record<string, unknown>>(
  client: postgres.Sql<TTypes>,
) {
  const observedClient = client as ObservedSqlClient<TTypes>
  if (observedClient[OBSERVED_SQL_CLIENT]) {
    return client
  }

  setDbPoolMaxConnections(client.options.max)

  const originalUnsafe = client.unsafe.bind(client)

  const instrumentedUnsafe: typeof client.unsafe = ((query, parameters, queryOptions) => {
    const { operation, table } = parseSqlMetadata(query)
    const timer = startDbQueryMetric(operation, table)
    const pendingQuery = originalUnsafe(query, parameters, queryOptions) as PendingQueryLike
    const originalResolve = pendingQuery.resolve
    const originalReject = pendingQuery.reject

    pendingQuery.resolve = (value) => {
      const durationMs = timer.endSuccess()
      const rowCount = getRowCount(value)

      if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
        timer.markSlow()
        logger.warn(
          {
            type: 'sql',
            event: 'slow_query',
            operation,
            table,
            duration_ms: durationMs,
            row_count: rowCount,
            success: true,
          },
          'Slow SQL query detected',
        )
      }

      return originalResolve?.call(pendingQuery, value)
    }

    pendingQuery.reject = (error) => {
      const durationMs = timer.endError(getErrorCode(error))

      logger.error(
        {
          type: 'sql',
          event: 'query_failed',
          operation,
          table,
          duration_ms: durationMs,
          ...toErrorFields(error),
        },
        'SQL query failed',
      )

      return originalReject?.call(pendingQuery, error)
    }

    return pendingQuery as ReturnType<typeof client.unsafe>
  }) as typeof client.unsafe

  observedClient.unsafe = instrumentedUnsafe
  observedClient[OBSERVED_SQL_CLIENT] = true

  return client
}

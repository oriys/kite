import 'server-only'

import { captureError, type ErrorContext as CollectorContext } from './error-collector'
import { logger, toErrorFields } from '@/lib/observability/logger'

type ErrorContext = Record<string, unknown>

/**
 * Log a server error to console AND persist to error_logs table.
 * The DB write is fire-and-forget — it never blocks or throws.
 */
export function logServerError(
  message: string,
  error: unknown,
  context: ErrorContext = {},
  capture?: Partial<CollectorContext>,
) {
  logger.error(
    {
      type: 'error',
      event: 'server_error',
      ...context,
      ...toErrorFields(error),
    },
    message,
  )

  // Fire-and-forget: persist to DB for review
  captureError(error, {
    source: 'unknown',
    ...capture,
    context: { logMessage: message, ...context, ...capture?.context },
  }).catch(() => {
    // Swallow — we already logged to console above
  })
}

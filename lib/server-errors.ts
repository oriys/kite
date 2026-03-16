import 'server-only'

import { captureError, type ErrorContext as CollectorContext } from './error-collector'

type ErrorContext = Record<string, unknown>

function serializeError(error: Error) {
  const cause = error.cause

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(cause === undefined
      ? {}
      : {
          cause:
            cause instanceof Error
              ? {
                  name: cause.name,
                  message: cause.message,
                }
              : cause,
        }),
  }
}

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
  console.error(message, {
    ...context,
    error: error instanceof Error ? serializeError(error) : error,
  })

  // Fire-and-forget: persist to DB for review
  captureError(error, {
    source: 'unknown',
    ...capture,
    context: { logMessage: message, ...context, ...capture?.context },
  }).catch(() => {
    // Swallow — we already logged to console above
  })
}

import 'server-only'

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

export function logServerError(
  message: string,
  error: unknown,
  context: ErrorContext = {},
) {
  console.error(message, {
    ...context,
    error: error instanceof Error ? serializeError(error) : error,
  })
}

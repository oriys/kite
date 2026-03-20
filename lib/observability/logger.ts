import pino, { type Logger as PinoLogger } from 'pino'
import { getRequestContext } from '@/lib/observability/request-context'

type GlobalLogger = typeof globalThis & {
  __kiteLogger?: PinoLogger
}

const globalForLogger = globalThis as GlobalLogger
const serviceName = process.env.APP_SERVICE_NAME ?? 'kite'
const serviceEnv = process.env.NODE_ENV ?? 'development'
const serviceVersion = process.env.APP_VERSION ?? process.env.npm_package_version ?? 'local'

function createLogger() {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: {
      service: serviceName,
      env: serviceEnv,
      version: serviceVersion,
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    messageKey: 'message',
    timestamp: () => `,"ts":"${new Date().toISOString()}"`,
    redact: {
      paths: [
        'password',
        'token',
        'authorization',
        'cookie',
        'set-cookie',
        'x-api-key',
        'x-auth-token',
        'req.headers.authorization',
        'req.headers.cookie',
        'headers.authorization',
        'headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    mixin() {
      const ctx = getRequestContext()
      if (!ctx) return {}

      return {
        request_id: ctx.requestId,
        trace_id: ctx.traceId,
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId,
        route: ctx.route,
        method: ctx.method,
      }
    },
  })
}

export const logger = globalForLogger.__kiteLogger ?? (globalForLogger.__kiteLogger = createLogger())

export function toErrorFields(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      error_value: error,
    }
  }

  const fields: Record<string, unknown> = {
    error_name: error.name,
    error_message: error.message,
    error_stack: error.stack,
  }

  const code = 'code' in error ? (error as Error & { code?: unknown }).code : undefined
  if (typeof code === 'string' || typeof code === 'number') {
    fields.error_code = String(code)
  }

  const digest = 'digest' in error ? (error as Error & { digest?: unknown }).digest : undefined
  if (typeof digest === 'string' && digest.length > 0) {
    fields.error_digest = digest
  }

  if (error.cause !== undefined) {
    fields.error_cause = error.cause instanceof Error
      ? `${error.cause.name}: ${error.cause.message}`
      : error.cause
  }

  return fields
}

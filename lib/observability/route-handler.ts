import { captureApiError } from '@/lib/error-collector'
import { logger, toErrorFields } from '@/lib/observability/logger'
import { startHttpRequestMetric } from '@/lib/observability/metrics'
import {
  buildRequestContextFromRequest,
  getRequestContext,
  runWithRequestContext,
} from '@/lib/observability/request-context'

type ErrorSource =
  | 'api-route'
  | 'server-action'
  | 'server-component'
  | 'client'
  | 'middleware'
  | 'cron'
  | 'webhook'
  | 'unknown'

interface RouteObservabilityOptions {
  route?: string
  source?: ErrorSource
  skipAccessLog?: boolean
  skipMetrics?: boolean
}

function attachTracingHeaders(response: Response, requestId: string, traceId: string) {
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-trace-id', traceId)
  return response
}

export function withRouteObservability<T extends Request, A extends unknown[]>(
  handler: (request: T, ...args: A) => Promise<Response>,
  options: RouteObservabilityOptions = {},
) {
  return async function observedRoute(request: T, ...args: A) {
    const context = buildRequestContextFromRequest(request, {
      route: options.route,
    })

    return runWithRequestContext(context, async () => {
      const requestMetric = options.skipMetrics
        ? null
        : startHttpRequestMetric(context.method ?? request.method, context.route ?? 'unknown')

      let response: Response | undefined

      try {
        response = await handler(request, ...args)
      } catch (error) {
        const requestContext = getRequestContext()

        await captureApiError(
          error,
          request,
          {
            userId: requestContext?.userId,
            workspaceId: requestContext?.workspaceId,
          },
          {
            source: options.source ?? 'api-route',
            httpStatus: 500,
            requestId: requestContext?.requestId,
          },
        )

        logger.error(
          {
            type: 'error',
            event: 'request_failed',
            route: context.route,
            method: context.method,
            ...toErrorFields(error),
          },
          'Unhandled API request error',
        )

        response = Response.json(
          { error: 'Internal server error' },
          { status: 500 },
        )
      }

      const finalResponse = attachTracingHeaders(
        response,
        context.requestId,
        context.traceId,
      )
      const durationMs = requestMetric?.observe(finalResponse.status)

      if (!options.skipAccessLog) {
        logger.info(
          {
            type: 'access',
            method: context.method,
            route: context.route,
            status_code: finalResponse.status,
            duration_ms: durationMs,
          },
          'HTTP request completed',
        )
      }

      return finalResponse
    })
  }
}

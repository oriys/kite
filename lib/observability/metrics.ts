import client from 'prom-client'
import { logger, toErrorFields } from '@/lib/observability/logger'

const HTTP_LABELS = ['method', 'route', 'status_code'] as const
const HTTP_IN_FLIGHT_LABELS = ['method', 'route'] as const
const DB_QUERY_LABELS = ['operation', 'table'] as const
const DB_QUERY_TOTAL_LABELS = ['operation', 'table', 'result'] as const
const DB_QUERY_ERROR_LABELS = ['operation', 'table', 'error_code'] as const
const DOMAIN_EVENT_LABELS = ['event_name', 'result'] as const

type GlobalMetrics = typeof globalThis & {
  __kiteObservabilityMetrics?: ObservabilityMetrics
  __kiteObservabilityProcessHandlers?: boolean
}

interface ObservabilityMetrics {
  register: client.Registry
  httpRequestsTotal: client.Counter<(typeof HTTP_LABELS)[number]>
  httpRequestDurationSeconds: client.Histogram<(typeof HTTP_LABELS)[number]>
  httpRequestsInFlight: client.Gauge<(typeof HTTP_IN_FLIGHT_LABELS)[number]>
  dbQueryTotal: client.Counter<(typeof DB_QUERY_TOTAL_LABELS)[number]>
  dbQueryDurationSeconds: client.Histogram<(typeof DB_QUERY_LABELS)[number]>
  dbQueryErrorsTotal: client.Counter<(typeof DB_QUERY_ERROR_LABELS)[number]>
  dbSlowQueriesTotal: client.Counter<(typeof DB_QUERY_LABELS)[number]>
  dbPoolTotalConnections: client.Gauge
  dbPoolIdleConnections: client.Gauge
  dbPoolWaitingRequests: client.Gauge
  dbQueriesInFlight: client.Gauge
  appUptimeSeconds: client.Gauge
  appUncaughtExceptionsTotal: client.Counter
  appUnhandledRejectionsTotal: client.Counter
  domainEventTotal: client.Counter<(typeof DOMAIN_EVENT_LABELS)[number]>
}

const globalForMetrics = globalThis as GlobalMetrics
const metrics = globalForMetrics.__kiteObservabilityMetrics
  ?? (globalForMetrics.__kiteObservabilityMetrics = createObservabilityMetrics())

let configuredDbPoolMax = 0
let activeDbQueries = 0

registerProcessMetrics()
syncDerivedDbPoolGauges()

function createObservabilityMetrics(): ObservabilityMetrics {
  const register = new client.Registry()

  register.setDefaultLabels({
    service: process.env.APP_SERVICE_NAME ?? 'kite',
    env: process.env.NODE_ENV ?? 'development',
  })

  client.collectDefaultMetrics({
    register,
    eventLoopMonitoringPrecision: 20,
  })

  const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests processed.',
    labelNames: HTTP_LABELS,
    registers: [register],
  })

  const httpRequestDurationSeconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: HTTP_LABELS,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [register],
  })

  const httpRequestsInFlight = new client.Gauge({
    name: 'http_requests_in_flight',
    help: 'Current in-flight HTTP requests.',
    labelNames: HTTP_IN_FLIGHT_LABELS,
    registers: [register],
  })

  const dbQueryTotal = new client.Counter({
    name: 'db_query_total',
    help: 'Total number of database queries.',
    labelNames: DB_QUERY_TOTAL_LABELS,
    registers: [register],
  })

  const dbQueryDurationSeconds = new client.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration in seconds.',
    labelNames: DB_QUERY_LABELS,
    buckets: [0.001, 0.003, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register],
  })

  const dbQueryErrorsTotal = new client.Counter({
    name: 'db_query_errors_total',
    help: 'Total number of failed database queries.',
    labelNames: DB_QUERY_ERROR_LABELS,
    registers: [register],
  })

  const dbSlowQueriesTotal = new client.Counter({
    name: 'db_slow_queries_total',
    help: 'Total number of slow database queries.',
    labelNames: DB_QUERY_LABELS,
    registers: [register],
  })

  const dbPoolTotalConnections = new client.Gauge({
    name: 'db_pool_total_connections',
    help: 'Configured maximum number of database connections for this process.',
    registers: [register],
  })

  const dbPoolIdleConnections = new client.Gauge({
    name: 'db_pool_idle_connections',
    help: 'Approximate idle database connections derived from configured max minus in-flight work.',
    registers: [register],
  })

  const dbPoolWaitingRequests = new client.Gauge({
    name: 'db_pool_waiting_requests',
    help: 'Approximate waiting database requests derived from in-flight work exceeding configured capacity.',
    registers: [register],
  })

  const dbQueriesInFlight = new client.Gauge({
    name: 'db_queries_in_flight',
    help: 'Current in-flight database queries.',
    registers: [register],
  })

  const appUptimeSeconds = new client.Gauge({
    name: 'app_uptime_seconds',
    help: 'Application uptime in seconds.',
    registers: [register],
    collect() {
      this.set(process.uptime())
    },
  })

  const appUncaughtExceptionsTotal = new client.Counter({
    name: 'app_uncaught_exceptions_total',
    help: 'Total number of uncaught exceptions observed by the process.',
    registers: [register],
  })

  const appUnhandledRejectionsTotal = new client.Counter({
    name: 'app_unhandled_rejections_total',
    help: 'Total number of unhandled promise rejections observed by the process.',
    registers: [register],
  })

  const domainEventTotal = new client.Counter({
    name: 'domain_event_total',
    help: 'Total number of business-domain events recorded by result.',
    labelNames: DOMAIN_EVENT_LABELS,
    registers: [register],
  })

  return {
    register,
    httpRequestsTotal,
    httpRequestDurationSeconds,
    httpRequestsInFlight,
    dbQueryTotal,
    dbQueryDurationSeconds,
    dbQueryErrorsTotal,
    dbSlowQueriesTotal,
    dbPoolTotalConnections,
    dbPoolIdleConnections,
    dbPoolWaitingRequests,
    dbQueriesInFlight,
    appUptimeSeconds,
    appUncaughtExceptionsTotal,
    appUnhandledRejectionsTotal,
    domainEventTotal,
  }
}

function registerProcessMetrics() {
  if (globalForMetrics.__kiteObservabilityProcessHandlers) return

  process.on('uncaughtExceptionMonitor', (error) => {
    metrics.appUncaughtExceptionsTotal.inc()
    logger.fatal(
      {
        type: 'error',
        event: 'uncaught_exception',
        ...toErrorFields(error),
      },
      'Uncaught exception observed',
    )
  })

  process.on('unhandledRejection', (reason) => {
    metrics.appUnhandledRejectionsTotal.inc()
    logger.error(
      {
        type: 'error',
        event: 'unhandled_rejection',
        ...toErrorFields(reason),
      },
      'Unhandled promise rejection observed',
    )
  })

  globalForMetrics.__kiteObservabilityProcessHandlers = true
}

function syncDerivedDbPoolGauges() {
  metrics.dbQueriesInFlight.set(activeDbQueries)
  metrics.dbPoolTotalConnections.set(configuredDbPoolMax)
  metrics.dbPoolIdleConnections.set(
    Math.max(configuredDbPoolMax - Math.min(activeDbQueries, configuredDbPoolMax), 0),
  )
  metrics.dbPoolWaitingRequests.set(
    Math.max(activeDbQueries - configuredDbPoolMax, 0),
  )
}

export function setDbPoolMaxConnections(maxConnections: number) {
  configuredDbPoolMax = Math.max(0, Math.trunc(maxConnections))
  syncDerivedDbPoolGauges()
}

export function startHttpRequestMetric(method: string, route: string) {
  const labels = {
    method: method.toUpperCase(),
    route,
  }

  metrics.httpRequestsInFlight.inc(labels)

  const startedAt = process.hrtime.bigint()
  let completed = false

  return {
    observe(statusCode: number | string) {
      if (completed) return 0
      completed = true

      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9
      const status = String(statusCode)

      metrics.httpRequestsTotal.inc({
        ...labels,
        status_code: status,
      })
      metrics.httpRequestDurationSeconds.observe(
        {
          ...labels,
          status_code: status,
        },
        durationSeconds,
      )
      metrics.httpRequestsInFlight.dec(labels)

      return Math.round(durationSeconds * 1000)
    },
  }
}

export function startDbQueryMetric(operation: string, table: string) {
  activeDbQueries += 1
  syncDerivedDbPoolGauges()

  const labels = {
    operation,
    table,
  }
  const startedAt = process.hrtime.bigint()
  let completed = false

  return {
    endSuccess() {
      if (completed) return 0
      completed = true

      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9
      metrics.dbQueryTotal.inc({
        ...labels,
        result: 'success',
      })
      metrics.dbQueryDurationSeconds.observe(labels, durationSeconds)
      activeDbQueries = Math.max(activeDbQueries - 1, 0)
      syncDerivedDbPoolGauges()

      return Math.round(durationSeconds * 1000)
    },
    endError(errorCode: string) {
      if (completed) return 0
      completed = true

      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9
      metrics.dbQueryTotal.inc({
        ...labels,
        result: 'error',
      })
      metrics.dbQueryErrorsTotal.inc({
        ...labels,
        error_code: errorCode,
      })
      metrics.dbQueryDurationSeconds.observe(labels, durationSeconds)
      activeDbQueries = Math.max(activeDbQueries - 1, 0)
      syncDerivedDbPoolGauges()

      return Math.round(durationSeconds * 1000)
    },
    markSlow() {
      metrics.dbSlowQueriesTotal.inc(labels)
    },
  }
}

export function recordDomainEvent(eventName: string, result = 'success') {
  metrics.domainEventTotal.inc({
    event_name: eventName,
    result,
  })
}

export async function renderMetrics() {
  return metrics.register.metrics()
}

export function getMetricsContentType() {
  return metrics.register.contentType
}

export function resetObservabilityMetricsForTests() {
  metrics.httpRequestsTotal.reset()
  metrics.httpRequestDurationSeconds.reset()
  metrics.httpRequestsInFlight.reset()
  metrics.dbQueryTotal.reset()
  metrics.dbQueryDurationSeconds.reset()
  metrics.dbQueryErrorsTotal.reset()
  metrics.dbSlowQueriesTotal.reset()
  metrics.dbPoolTotalConnections.reset()
  metrics.dbPoolIdleConnections.reset()
  metrics.dbPoolWaitingRequests.reset()
  metrics.dbQueriesInFlight.reset()
  metrics.appUncaughtExceptionsTotal.reset()
  metrics.appUnhandledRejectionsTotal.reset()
  metrics.domainEventTotal.reset()
  activeDbQueries = 0
  syncDerivedDbPoolGauges()
}

import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

export const errorLevelEnum = pgEnum('error_level', [
  'warn',
  'error',
  'fatal',
])

export const errorSourceEnum = pgEnum('error_source', [
  'api-route',
  'server-action',
  'server-component',
  'client',
  'middleware',
  'cron',
  'webhook',
  'unknown',
])

export const errorLogs = pgTable(
  'error_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Timing
    occurredAt: timestamp('occurred_at', { mode: 'date' }).notNull().defaultNow(),

    // Classification
    level: errorLevelEnum('level').notNull().default('error'),
    source: errorSourceEnum('source').notNull().default('unknown'),

    // Error info
    errorName: text('error_name'),
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
    errorCause: text('error_cause'),
    errorDigest: text('error_digest'),

    // Fingerprint for dedup / grouping (hash of name + message + first frame)
    fingerprint: text('fingerprint'),

    // HTTP context
    httpMethod: text('http_method'),
    httpUrl: text('http_url'),
    httpStatus: integer('http_status'),
    httpHeaders: jsonb('http_headers').$type<Record<string, string>>(),
    httpBody: text('http_body'),

    // User / session context
    userId: text('user_id'),
    workspaceId: text('workspace_id'),
    sessionId: text('session_id'),
    requestId: text('request_id'),

    // Client info
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),

    // Additional structured data (component stack, route params, etc.)
    context: jsonb('context').$type<Record<string, unknown>>(),

    // Review workflow
    resolved: boolean('resolved').notNull().default(false),
    resolvedAt: timestamp('resolved_at', { mode: 'date' }),
    resolvedBy: text('resolved_by'),
    resolvedNote: text('resolved_note'),
  },
  (t) => [
    index('error_logs_occurred_at_idx').on(t.occurredAt),
    index('error_logs_fingerprint_idx').on(t.fingerprint, t.occurredAt),
    index('error_logs_source_level_idx').on(t.source, t.level, t.occurredAt),
    index('error_logs_resolved_idx').on(t.resolved, t.occurredAt),
    index('error_logs_user_idx').on(t.userId, t.occurredAt),
    index('error_logs_request_id_idx').on(t.requestId),
  ],
)

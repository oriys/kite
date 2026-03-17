import {
  getMcpTransportLabel,
  isMcpTransportType,
  type McpTransportType,
} from '@/lib/ai'

export interface McpServerConfigListItem {
  id: string
  name: string
  transportType: McpTransportType
  transportLabel: string
  command: string
  url: string
  enabled: boolean
  args: string[]
  env: Record<string, string>
  headers: Record<string, string>
  argsCount: number
  envCount: number
  headersCount: number
  createdAt: string
  updatedAt: string
}

export interface McpServerConnectionTestResult {
  ok: boolean
  toolCount: number
  promptCount: number
  resourceCount: number
  error?: string
}

function asNonEmptyString(value: unknown, field: string) {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  throw new Error(`Missing MCP server ${field}`)
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asDateString(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return ''
}

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }

  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }

  return fallback
}

function asCount(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const numericValue = Number(value)
    if (Number.isFinite(numericValue) && numericValue >= 0) {
      return numericValue
    }
  }

  return fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

export function normalizeMcpServerConfigListItem(
  raw: unknown,
): McpServerConfigListItem {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Malformed MCP server item')
  }

  const record = raw as Record<string, unknown>
  const transportType = record.transportType

  if (typeof transportType !== 'string' || !isMcpTransportType(transportType)) {
    throw new Error('Invalid MCP server transport type')
  }

  const args = asStringArray(record.args)
  const env = asStringRecord(record.env)
  const headers = asStringRecord(record.headers)

  return {
    id: asNonEmptyString(record.id, 'id'),
    name: asNonEmptyString(record.name, 'name'),
    transportType,
    transportLabel:
      typeof record.transportLabel === 'string' &&
      record.transportLabel.trim().length > 0
        ? record.transportLabel
        : getMcpTransportLabel(transportType),
    command: asOptionalString(record.command),
    url: asOptionalString(record.url),
    enabled: asBoolean(record.enabled, true),
    args,
    env,
    headers,
    argsCount: asCount(record.argsCount, args.length),
    envCount: asCount(record.envCount, Object.keys(env).length),
    headersCount: asCount(record.headersCount, Object.keys(headers).length),
    createdAt: asDateString(record.createdAt),
    updatedAt: asDateString(record.updatedAt),
  }
}

export function normalizeMcpServerConfigList(
  raw: unknown,
): McpServerConfigListItem[] {
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected MCP servers response')
  }

  return raw.map((item, index) => {
    try {
      return normalizeMcpServerConfigListItem(item)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Malformed MCP server item'
      throw new Error(`Invalid MCP server at index ${index}: ${message}`)
    }
  })
}

export function normalizeMcpServerConnectionTestResult(
  raw: unknown,
): McpServerConnectionTestResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Unexpected MCP server test response')
  }

  const record = raw as Record<string, unknown>

  return {
    ok: asBoolean(record.ok, false),
    toolCount: asCount(record.toolCount, 0),
    promptCount: asCount(record.promptCount, 0),
    resourceCount: asCount(record.resourceCount, 0),
    error:
      typeof record.error === 'string' && record.error.trim().length > 0
        ? record.error
        : undefined,
  }
}

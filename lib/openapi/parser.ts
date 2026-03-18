import { parse as openapiParse } from '@readme/openapi-parser'
import YAML from 'yaml'
import { createHash } from 'crypto'
import { resolveLocalOpenApiRefs } from './ref-resolver'

export interface ParsedSecurityScheme {
  type?: string
  description?: string
  name?: string
  in?: string
  scheme?: string
  bearerFormat?: string
  openIdConnectUrl?: string
  flows?: Record<string, unknown>
}

export interface ParsedSecurityRequirement {
  [schemeName: string]: string[]
}

export interface ParsedServer {
  url: string
  description?: string
}

export interface ParsedEndpoint {
  path: string
  method: string
  operationId?: string
  summary?: string | null
  description?: string
  tags: string[]
  parameters: Record<string, unknown>[]
  requestBody: Record<string, unknown> | null
  responses: Record<string, unknown>
  deprecated: boolean
  security?: ParsedSecurityRequirement[] | null
}

export interface ParsedSpec {
  title: string
  version: string
  openapiVersion: string
  endpoints: ParsedEndpoint[]
  rawSchemas: Record<string, unknown>
  servers: ParsedServer[]
  security: ParsedSecurityRequirement[] | null
  securitySchemes: Record<string, ParsedSecurityScheme>
}

/**
 * Parse and validate an OpenAPI 3.x spec from raw JSON or YAML content.
 */
export async function parseOpenAPISpec(content: string): Promise<ParsedSpec> {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(content)
  } catch {
    parsed = YAML.parse(content) as Record<string, unknown>
  }

  // Parse and validate the spec. Use parse (not dereference) to prevent
  // external $ref URLs from being fetched (SSRF protection).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let api: Record<string, any>
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api = (await openapiParse(parsed as any)) as Record<string, any>
  } catch {
    // If strict parsing fails, use the raw parsed object
    api = parsed
  }

  const info = (api.info ?? {}) as Record<string, unknown>
  const title = (info.title as string) || 'Untitled API'
  const version = (info.version as string) || '0.0.0'
  const openapiVersion =
    (api.openapi as string) || (api.swagger as string) || 'unknown'

  const endpoints: ParsedEndpoint[] = []
  const paths = (api.paths ?? {}) as Record<string, Record<string, unknown>>
  const servers = Array.isArray(api.servers)
    ? (api.servers as Record<string, unknown>[])
        .filter(
          (server): server is Record<string, unknown> =>
            typeof server.url === 'string' && server.url.length > 0,
        )
        .map((server) => ({
          url: server.url as string,
          description:
            typeof server.description === 'string'
              ? server.description
              : undefined,
        }))
    : []
  const topLevelSecurity = Array.isArray(api.security)
    ? (resolveLocalOpenApiRefs(
        api.security as ParsedSecurityRequirement[],
        api,
      ) as ParsedSecurityRequirement[])
    : null

  const httpMethods = [
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'options',
    'head',
    'trace',
  ]

  for (const [path, pathItem] of Object.entries(paths)) {
    const pathParameters = resolveLocalOpenApiRefs(
      (pathItem.parameters ?? []) as Record<
        string,
        unknown
      >[],
      api,
    )
    const resolvedPathParameters = pathParameters as Record<
      string,
      unknown
    >[]

    for (const method of httpMethods) {
      const operation = pathItem[method] as Record<string, unknown> | undefined
      if (!operation) continue

      const resolvedOperation = resolveLocalOpenApiRefs(operation, api) as Record<
        string,
        unknown
      >
      const opParameters = (resolvedOperation.parameters ?? []) as Record<
        string,
        unknown
      >[]
      const endpointSecurity = Array.isArray(resolvedOperation.security)
        ? (resolvedOperation.security as ParsedSecurityRequirement[])
        : topLevelSecurity
      const mergedParameters = deduplicateParameters([
        ...resolvedPathParameters,
        ...opParameters,
      ])

      endpoints.push({
        path,
        method: method.toUpperCase(),
        operationId: (resolvedOperation.operationId as string) || undefined,
        summary: (resolvedOperation.summary as string) || null,
        description: (resolvedOperation.description as string) || undefined,
        tags: (resolvedOperation.tags as string[]) ?? [],
        parameters: mergedParameters,
        requestBody:
          (resolvedOperation.requestBody as Record<string, unknown>) ?? null,
        responses: (resolvedOperation.responses as Record<string, unknown>) ?? {},
        deprecated: Boolean(resolvedOperation.deprecated),
        security: endpointSecurity,
      })
    }
  }

  const rawSchemas = ((
    (api.components as Record<string, unknown>) ?? {}
  ).schemas ?? {}) as Record<string, unknown>
  const securitySchemes = ((
    (api.components as Record<string, unknown>) ?? {}
  ).securitySchemes ?? {}) as Record<string, ParsedSecurityScheme>

  return {
    title,
    version,
    openapiVersion,
    endpoints,
    rawSchemas,
    servers,
    security: topLevelSecurity,
    securitySchemes,
  }
}

/**
 * Compute a SHA-256 hex digest of the given content string.
 */
export function computeChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

/** Deduplicate parameters by name+in, later entries win. */
function deduplicateParameters(
  params: Record<string, unknown>[],
): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>()
  for (const p of params) {
    const key = `${p.name}:${p.in}`
    map.set(key, p)
  }
  return Array.from(map.values())
}

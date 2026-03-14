import { parse as openapiParse } from '@readme/openapi-parser'
import YAML from 'yaml'
import { createHash } from 'crypto'

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
}

export interface ParsedSpec {
  title: string
  version: string
  openapiVersion: string
  endpoints: ParsedEndpoint[]
  rawSchemas: Record<string, unknown>
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
    const pathParameters = (pathItem.parameters ?? []) as Record<
      string,
      unknown
    >[]

    for (const method of httpMethods) {
      const operation = pathItem[method] as Record<string, unknown> | undefined
      if (!operation) continue

      const opParameters = (operation.parameters ?? []) as Record<
        string,
        unknown
      >[]
      const mergedParameters = deduplicateParameters([
        ...pathParameters,
        ...opParameters,
      ])

      endpoints.push({
        path,
        method: method.toUpperCase(),
        operationId: (operation.operationId as string) || undefined,
        summary: (operation.summary as string) || null,
        description: (operation.description as string) || undefined,
        tags: (operation.tags as string[]) ?? [],
        parameters: mergedParameters,
        requestBody: (operation.requestBody as Record<string, unknown>) ?? null,
        responses: (operation.responses as Record<string, unknown>) ?? {},
        deprecated: Boolean(operation.deprecated),
      })
    }
  }

  const rawSchemas = ((
    (api.components as Record<string, unknown>) ?? {}
  ).schemas ?? {}) as Record<string, unknown>

  return { title, version, openapiVersion, endpoints, rawSchemas }
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

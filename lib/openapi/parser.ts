/**
 * Stub for F1 OpenAPI parser — will be replaced by the full implementation.
 */

export interface ParsedEndpoint {
  path: string
  method: string
  operationId?: string
  summary?: string | null
  description?: string
  tags?: string[]
  parameters?: Record<string, unknown>[]
  requestBody?: Record<string, unknown> | null
  responses?: Record<string, unknown>
  deprecated?: boolean
}

export interface ParsedSpec {
  version: string
  title: string
  endpoints: ParsedEndpoint[]
}

export async function parseOpenAPISpec(rawContent: string): Promise<ParsedSpec> {
  // Minimal passthrough — real implementation provided by F1
  void rawContent
  return { version: '', title: '', endpoints: [] }
}

import type { ParsedEndpoint, ParsedSpec } from './parser'

/**
 * Generate Markdown documentation for a single endpoint.
 */
export function generateEndpointMarkdown(endpoint: ParsedEndpoint): string {
  const lines: string[] = []

  // Header: method badge + path
  lines.push(`## \`${endpoint.method}\` ${endpoint.path}`)
  lines.push('')

  if (endpoint.deprecated) {
    lines.push('> ⚠️ **Deprecated**')
    lines.push('')
  }

  if (endpoint.summary) {
    lines.push(`**${endpoint.summary}**`)
    lines.push('')
  }

  if (endpoint.description) {
    lines.push(endpoint.description)
    lines.push('')
  }

  if (endpoint.operationId) {
    lines.push(`**Operation ID:** \`${endpoint.operationId}\``)
    lines.push('')
  }

  if (endpoint.tags.length > 0) {
    lines.push(`**Tags:** ${endpoint.tags.map((t) => `\`${t}\``).join(', ')}`)
    lines.push('')
  }

  // Parameters table
  if (endpoint.parameters.length > 0) {
    lines.push('### Parameters')
    lines.push('')
    lines.push('| Name | In | Type | Required | Description |')
    lines.push('|------|----|------|----------|-------------|')

    for (const param of endpoint.parameters) {
      const name = (param.name as string) || '—'
      const location = (param.in as string) || '—'
      const schema = (param.schema as Record<string, unknown>) ?? {}
      const type = (schema.type as string) || '—'
      const required = param.required ? '✓' : ''
      const description = (param.description as string) || ''
      lines.push(`| \`${name}\` | ${location} | \`${type}\` | ${required} | ${description} |`)
    }
    lines.push('')
  }

  // Request body
  if (endpoint.requestBody) {
    lines.push('### Request Body')
    lines.push('')
    const rb = endpoint.requestBody
    if (rb.description) {
      lines.push(rb.description as string)
      lines.push('')
    }
    const content = (rb.content as Record<string, unknown>) ?? {}
    for (const [mediaType, mediaObj] of Object.entries(content)) {
      lines.push(`**Content-Type:** \`${mediaType}\``)
      lines.push('')
      const schema = (mediaObj as Record<string, unknown>).schema as
        | Record<string, unknown>
        | undefined
      if (schema) {
        lines.push('```json')
        lines.push(JSON.stringify(schema, null, 2))
        lines.push('```')
        lines.push('')
      }
    }
  }

  // Responses
  const responseCodes = Object.keys(endpoint.responses)
  if (responseCodes.length > 0) {
    lines.push('### Responses')
    lines.push('')

    for (const code of responseCodes.sort()) {
      const resp = endpoint.responses[code] as Record<string, unknown>
      const desc = (resp.description as string) || ''
      lines.push(`#### \`${code}\` ${desc}`)
      lines.push('')

      const respContent = (resp.content as Record<string, unknown>) ?? {}
      for (const [mediaType, mediaObj] of Object.entries(respContent)) {
        lines.push(`**Content-Type:** \`${mediaType}\``)
        lines.push('')
        const schema = (mediaObj as Record<string, unknown>).schema as
          | Record<string, unknown>
          | undefined
        if (schema) {
          lines.push('```json')
          lines.push(JSON.stringify(schema, null, 2))
          lines.push('```')
          lines.push('')
        }
      }
    }
  }

  return lines.join('\n')
}

/**
 * Generate an overview page listing all endpoints grouped by tags.
 */
export function generateOverviewMarkdown(spec: ParsedSpec): string {
  const lines: string[] = []

  lines.push(`# ${spec.title}`)
  lines.push('')
  lines.push(`**Version:** ${spec.version}  `)
  lines.push(`**OpenAPI:** ${spec.openapiVersion}`)
  lines.push('')

  // Group endpoints by first tag (or "Untagged")
  const groups = new Map<string, ParsedEndpoint[]>()

  for (const ep of spec.endpoints) {
    const tag = ep.tags[0] || 'Untagged'
    if (!groups.has(tag)) groups.set(tag, [])
    groups.get(tag)!.push(ep)
  }

  // Table of contents
  lines.push('## Endpoints')
  lines.push('')

  for (const [tag, endpoints] of groups) {
    lines.push(`### ${tag}`)
    lines.push('')
    lines.push('| Method | Path | Summary |')
    lines.push('|--------|------|---------|')

    for (const ep of endpoints) {
      const deprecated = ep.deprecated ? ' ~~deprecated~~' : ''
      const summary = ep.summary || '—'
      lines.push(
        `| \`${ep.method}\` | \`${ep.path}\` | ${summary}${deprecated} |`,
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

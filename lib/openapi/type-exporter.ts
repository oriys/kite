export interface TypeExportResult {
  filename: string
  content: string
  schemaCount: number
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '').replace(/^(\d)/, '_$1')
}

function toPascalCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map(capitalize)
    .join('')
}

function extractRefName(ref: string): string {
  const parts = ref.split('/')
  return sanitizeName(parts[parts.length - 1])
}

export function schemaToTypeScript(
  schema: Record<string, unknown>,
  name: string,
  depth = 0,
): string {
  if (!schema || typeof schema !== 'object') return 'unknown'

  // $ref
  if ('$ref' in schema && typeof schema.$ref === 'string') {
    return extractRefName(schema.$ref)
  }

  // allOf → intersection
  if (Array.isArray(schema.allOf)) {
    const types = (schema.allOf as Record<string, unknown>[])
      .map((s, i) => schemaToTypeScript(s, `${name}AllOf${i}`, depth))
    return types.join(' & ')
  }

  // oneOf / anyOf → union
  const unionKey = 'oneOf' in schema ? 'oneOf' : 'anyOf' in schema ? 'anyOf' : null
  if (unionKey && Array.isArray(schema[unionKey])) {
    const types = (schema[unionKey] as Record<string, unknown>[])
      .map((s, i) => schemaToTypeScript(s, `${name}Variant${i}`, depth))
    const result = types.join(' | ')
    return schema.nullable === true ? `(${result}) | null` : result
  }

  // enum
  if (Array.isArray(schema.enum)) {
    const values = schema.enum
      .map((v) => (typeof v === 'string' ? `'${v}'` : String(v)))
      .join(' | ')
    return schema.nullable === true ? `(${values}) | null` : values
  }

  const type = schema.type as string | undefined

  // object with properties
  if (type === 'object' || ('properties' in schema && !type)) {
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>
    const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : [])
    const additionalProps = schema.additionalProperties

    if (Object.keys(properties).length === 0 && additionalProps) {
      const valueType =
        typeof additionalProps === 'object' && additionalProps !== null
          ? schemaToTypeScript(additionalProps as Record<string, unknown>, `${name}Value`, depth + 1)
          : 'unknown'
      return `Record<string, ${valueType}>`
    }

    const lines: string[] = []
    for (const [propName, propSchema] of Object.entries(properties)) {
      const optional = required.has(propName) ? '' : '?'
      const propType = schemaToTypeScript(propSchema, toPascalCase(propName), depth + 1)

      // Add description comment
      if (propSchema.description) {
        lines.push(`  /** ${propSchema.description} */`)
      }
      if (propSchema.format === 'date-time' || propSchema.format === 'date') {
        lines.push(`  /** Format: ${propSchema.format} */`)
      }

      const nullable = propSchema.nullable === true ? ' | null' : ''
      lines.push(`  ${propName}${optional}: ${propType}${nullable};`)
    }

    if (depth === 0) {
      return `interface ${sanitizeName(name)} {\n${lines.join('\n')}\n}`
    }
    return `{\n${lines.join('\n')}\n${'  '.repeat(depth)}}`
  }

  // array
  if (type === 'array') {
    const items = schema.items as Record<string, unknown> | undefined
    const itemType = items
      ? schemaToTypeScript(items, `${name}Item`, depth)
      : 'unknown'
    const result = itemType.includes('|') || itemType.includes('&')
      ? `(${itemType})[]`
      : `${itemType}[]`
    return schema.nullable === true ? `${result} | null` : result
  }

  // primitives
  if (type === 'string') {
    return schema.nullable === true ? 'string | null' : 'string'
  }
  if (type === 'integer' || type === 'number') {
    return schema.nullable === true ? 'number | null' : 'number'
  }
  if (type === 'boolean') {
    return schema.nullable === true ? 'boolean | null' : 'boolean'
  }

  return 'unknown'
}

function methodPathToName(method: string, path: string): string {
  const cleaned = path
    .replace(/\{([^}]+)\}/g, 'By$1')
    .split('/')
    .filter(Boolean)
    .map(toPascalCase)
    .join('')
  return `${capitalize(method.toLowerCase())}${cleaned}`
}

export function generateTypesForEndpoint(endpoint: {
  operationId?: string | null
  path: string
  method: string
  parameters: Record<string, unknown>[]
  requestBody: Record<string, unknown> | null
  responses: Record<string, unknown>
}): string {
  const baseName = endpoint.operationId
    ? toPascalCase(endpoint.operationId)
    : methodPathToName(endpoint.method, endpoint.path)

  const parts: string[] = []
  parts.push(`// ${endpoint.method.toUpperCase()} ${endpoint.path}`)

  // Path/Query parameters
  const pathParams = (endpoint.parameters ?? []).filter(
    (p) => p.in === 'path' || p.in === 'query',
  )
  if (pathParams.length > 0) {
    const paramLines = pathParams.map((p) => {
      const paramSchema = (p.schema ?? { type: 'string' }) as Record<string, unknown>
      const paramType = schemaToTypeScript(paramSchema, String(p.name), 1)
      const optional = p.required ? '' : '?'
      return `  ${String(p.name)}${optional}: ${paramType};`
    })
    parts.push(`export interface ${baseName}Params {\n${paramLines.join('\n')}\n}`)
  }

  // Request body
  if (endpoint.requestBody) {
    const content = (endpoint.requestBody.content ?? {}) as Record<string, Record<string, unknown>>
    const jsonContent = content['application/json']
    if (jsonContent?.schema) {
      const bodyType = schemaToTypeScript(
        jsonContent.schema as Record<string, unknown>,
        `${baseName}Body`,
        0,
      )
      if (bodyType.startsWith('interface ')) {
        parts.push(`export ${bodyType.replace(`interface ${baseName}Body`, `interface ${baseName}Body`)}`)
      } else {
        parts.push(`export type ${baseName}Body = ${bodyType};`)
      }
    }
  }

  // Responses
  const responses = endpoint.responses ?? {}
  for (const [statusCode, responseDef] of Object.entries(responses)) {
    const response = responseDef as Record<string, unknown>
    const content = (response.content ?? {}) as Record<string, Record<string, unknown>>
    const jsonContent = content['application/json']
    if (jsonContent?.schema) {
      const suffix = statusCode === '200' || statusCode === '201' ? 'Response' : `Response${statusCode}`
      const respType = schemaToTypeScript(
        jsonContent.schema as Record<string, unknown>,
        `${baseName}${suffix}`,
        0,
      )
      if (respType.startsWith('interface ')) {
        parts.push(`export ${respType}`)
      } else {
        parts.push(`export type ${baseName}${suffix} = ${respType};`)
      }
    }
  }

  return parts.join('\n\n')
}

export function generateAllTypes(
  endpoints: {
    operationId?: string | null
    path: string
    method: string
    tags: string[] | null
    parameters: Record<string, unknown>[]
    requestBody: Record<string, unknown> | null
    responses: Record<string, unknown>
  }[],
  schemas?: Record<string, unknown>,
): TypeExportResult {
  const sections: string[] = []
  let schemaCount = 0

  sections.push('// Auto-generated TypeScript definitions')
  sections.push('// Do not edit manually\n')

  // Generate from shared schemas ($ref targets)
  if (schemas && typeof schemas === 'object') {
    for (const [name, schema] of Object.entries(schemas)) {
      if (schema && typeof schema === 'object') {
        const ts = schemaToTypeScript(schema as Record<string, unknown>, name, 0)
        if (ts.startsWith('interface ')) {
          sections.push(`export ${ts}`)
        } else {
          sections.push(`export type ${sanitizeName(name)} = ${ts};`)
        }
        schemaCount++
      }
    }
    if (schemaCount > 0) sections.push('')
  }

  // Group by first tag or path prefix
  const grouped = new Map<string, typeof endpoints>()
  for (const ep of endpoints) {
    const group = ep.tags?.[0] ?? ep.path.split('/').filter(Boolean)[0] ?? 'default'
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group)!.push(ep)
  }

  for (const [group, eps] of grouped) {
    sections.push(`// ──────────────────────────────────────`)
    sections.push(`// ${group}`)
    sections.push(`// ──────────────────────────────────────\n`)

    for (const ep of eps) {
      const types = generateTypesForEndpoint(ep)
      if (types.trim()) {
        sections.push(types)
        sections.push('')
        schemaCount++
      }
    }
  }

  return {
    filename: 'api-types.d.ts',
    content: sections.join('\n'),
    schemaCount,
  }
}

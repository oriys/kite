export function extractJsonSchemas(
  endpoints: {
    path: string
    method: string
    requestBody: unknown
    responses: unknown
  }[],
): Record<string, unknown> {
  const schemas: Record<string, unknown> = {}

  function toPascalCase(str: string): string {
    return str
      .split(/[^a-zA-Z0-9]/)
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')
  }

  function methodPathToName(method: string, path: string): string {
    const cleaned = path
      .replace(/\{([^}]+)\}/g, 'By$1')
      .split('/')
      .filter(Boolean)
      .map(toPascalCase)
      .join('')
    return `${method.charAt(0).toUpperCase()}${method.slice(1).toLowerCase()}${cleaned}`
  }

  function extractSchema(schema: unknown, name: string) {
    if (!schema || typeof schema !== 'object') return
    const s = schema as Record<string, unknown>

    if (s.type === 'object' || s.properties) {
      schemas[name] = s
    } else if (s.type === 'array' && s.items) {
      const itemName = `${name}Item`
      extractSchema(s.items, itemName)
      schemas[name] = s
    }
  }

  for (const ep of endpoints) {
    const baseName = methodPathToName(ep.method, ep.path)

    // Request body
    if (ep.requestBody && typeof ep.requestBody === 'object') {
      const rb = ep.requestBody as Record<string, unknown>
      const content = (rb.content ?? {}) as Record<string, Record<string, unknown>>
      const jsonContent = content['application/json']
      if (jsonContent?.schema) {
        extractSchema(jsonContent.schema, `${baseName}Request`)
      }
    }

    // Responses
    if (ep.responses && typeof ep.responses === 'object') {
      for (const [statusCode, responseDef] of Object.entries(ep.responses as Record<string, unknown>)) {
        if (!responseDef || typeof responseDef !== 'object') continue
        const response = responseDef as Record<string, unknown>
        const content = (response.content ?? {}) as Record<string, Record<string, unknown>>
        const jsonContent = content['application/json']
        if (jsonContent?.schema) {
          const suffix = statusCode === '200' || statusCode === '201' ? 'Response' : `Response${statusCode}`
          extractSchema(jsonContent.schema, `${baseName}${suffix}`)
        }
      }
    }
  }

  return schemas
}

export function generateJsonSchemaBundle(schemas: Record<string, unknown>): string {
  const bundle = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    definitions: schemas,
  }

  return JSON.stringify(bundle, null, 2)
}

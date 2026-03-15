export interface OperationInfo {
  operationId: string
  method: string
  path: string
  summary: string
  parameters: { name: string; in: string; required: boolean; schema: Record<string, unknown> }[]
  requestBody?: { contentType: string; schema: Record<string, unknown> }
  responseSchema?: Record<string, unknown>
  tags: string[]
}

export function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
}

export function toPascalCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}

function resolveRefName(ref: string): string {
  const parts = ref.split('/')
  return parts[parts.length - 1]
}

export function toTypescriptType(schema: Record<string, unknown>): string {
  if (!schema) return 'unknown'
  if (schema.$ref) return toPascalCase(resolveRefName(schema.$ref as string))
  if (schema.allOf) {
    return (schema.allOf as Record<string, unknown>[]).map((s) => toTypescriptType(s)).join(' & ')
  }
  if (schema.oneOf || schema.anyOf) {
    const items = (schema.oneOf || schema.anyOf) as Record<string, unknown>[]
    return items.map((s) => toTypescriptType(s)).join(' | ')
  }
  if (schema.enum) {
    return (schema.enum as unknown[]).map((v: unknown) => typeof v === 'string' ? `'${v}'` : String(v)).join(' | ')
  }
  switch (schema.type) {
    case 'string': return 'string'
    case 'integer':
    case 'number': return 'number'
    case 'boolean': return 'boolean'
    case 'array': {
      const itemType = toTypescriptType(schema.items as Record<string, unknown>)
      return `${itemType}[]`
    }
    case 'object': {
      if (schema.properties) {
        const props = Object.entries(schema.properties as Record<string, unknown>).map(([k, v]) => {
          const required = Array.isArray(schema.required) && (schema.required as string[]).includes(k)
          return `  ${k}${required ? '' : '?'}: ${toTypescriptType(v as Record<string, unknown>)}`
        })
        return `{\n${props.join('\n')}\n}`
      }
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        return `Record<string, ${toTypescriptType(schema.additionalProperties as Record<string, unknown>)}>`
      }
      return 'Record<string, unknown>'
    }
    default: return 'unknown'
  }
}

export function toPythonType(schema: Record<string, unknown>): string {
  if (!schema) return 'Any'
  if (schema.$ref) return toPascalCase(resolveRefName(schema.$ref as string))
  if (schema.allOf) return (schema.allOf as Record<string, unknown>[]).map((s) => toPythonType(s)).join(', ')
  if (schema.oneOf || schema.anyOf) {
    const items = (schema.oneOf || schema.anyOf) as Record<string, unknown>[]
    return `Union[${items.map((s) => toPythonType(s)).join(', ')}]`
  }
  if (schema.enum) {
    return (schema.enum as unknown[]).map((v: unknown) => typeof v === 'string' ? `"${v}"` : String(v)).join(' | ')
  }
  switch (schema.type) {
    case 'string': return 'str'
    case 'integer': return 'int'
    case 'number': return 'float'
    case 'boolean': return 'bool'
    case 'array': return `List[${toPythonType(schema.items as Record<string, unknown>)}]`
    case 'object': {
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        return `Dict[str, ${toPythonType(schema.additionalProperties as Record<string, unknown>)}]`
      }
      return 'Dict[str, Any]'
    }
    default: return 'Any'
  }
}

export function toGoType(schema: Record<string, unknown>): string {
  if (!schema) return 'interface{}'
  if (schema.$ref) return toPascalCase(resolveRefName(schema.$ref as string))
  if (schema.allOf) return toPascalCase(resolveRefName(((schema.allOf as Record<string, unknown>[])[0]?.$ref as string) || 'Object'))
  if (schema.oneOf || schema.anyOf) return 'interface{}'
  if (schema.enum) return 'string'
  switch (schema.type) {
    case 'string': return 'string'
    case 'integer': return schema.format === 'int64' ? 'int64' : 'int'
    case 'number': return schema.format === 'float' ? 'float32' : 'float64'
    case 'boolean': return 'bool'
    case 'array': return `[]${toGoType(schema.items as Record<string, unknown>)}`
    case 'object': {
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        return `map[string]${toGoType(schema.additionalProperties as Record<string, unknown>)}`
      }
      return 'map[string]interface{}'
    }
    default: return 'interface{}'
  }
}

function methodPathToOperationId(method: string, path: string): string {
  const cleaned = path
    .replace(/\{([^}]+)\}/g, 'By_$1')
    .split('/')
    .filter(Boolean)
    .map(toPascalCase)
    .join('')
  return toCamelCase(`${method.toLowerCase()}_${cleaned}`)
}

export function extractOperations(spec: Record<string, unknown>): OperationInfo[] {
  const operations: OperationInfo[] = []
  const paths = (spec.paths || {}) as Record<string, Record<string, unknown>>

  for (const [path, pathItem] of Object.entries(paths)) {
    const pathParams = (pathItem.parameters || []) as Record<string, unknown>[]
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']

    for (const method of httpMethods) {
      const op = pathItem[method] as Record<string, unknown> | undefined
      if (!op) continue

      const opParams = (op.parameters || []) as Record<string, unknown>[]
      const allParams = [...pathParams, ...opParams]
      const deduped = new Map<string, Record<string, unknown>>()
      for (const p of allParams) {
        deduped.set(`${p.name}:${p.in}`, p)
      }

      const parameters = Array.from(deduped.values()).map((p) => ({
        name: p.name as string,
        in: p.in as string,
        required: Boolean(p.required),
        schema: (p.schema || { type: 'string' }) as Record<string, unknown>,
      }))

      let requestBody: { contentType: string; schema: Record<string, unknown> } | undefined
      if (op.requestBody) {
        const rb = op.requestBody as Record<string, unknown>
        const content = (rb.content || {}) as Record<string, Record<string, unknown>>
        const jsonContent = content['application/json']
        if (jsonContent?.schema) {
          requestBody = { contentType: 'application/json', schema: jsonContent.schema as Record<string, unknown> }
        }
      }

      let responseSchema: Record<string, unknown> | undefined
      const responses = (op.responses || {}) as Record<string, Record<string, unknown>>
      for (const code of ['200', '201', '204']) {
        const resp = responses[code]
        const respContent = resp?.content as Record<string, Record<string, unknown>> | undefined
        const jsonSchema = respContent?.['application/json']
        if (jsonSchema?.schema) {
          responseSchema = jsonSchema.schema as Record<string, unknown>
          break
        }
      }

      operations.push({
        operationId: (op.operationId as string) || methodPathToOperationId(method, path),
        method: method.toUpperCase(),
        path,
        summary: (op.summary as string) || '',
        parameters,
        requestBody,
        responseSchema,
        tags: (op.tags as string[]) || ['default'],
      })
    }
  }

  return operations
}

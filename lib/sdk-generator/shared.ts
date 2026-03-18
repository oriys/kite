export interface OpenApiSchema {
  $ref?: string
  allOf?: OpenApiSchema[]
  anyOf?: OpenApiSchema[]
  oneOf?: OpenApiSchema[]
  enum?: readonly unknown[]
  type?: string
  format?: string
  description?: string
  nullable?: boolean
  properties?: Record<string, OpenApiSchema>
  required?: string[]
  items?: OpenApiSchema
  additionalProperties?: boolean | OpenApiSchema
}

export interface OpenApiInfo {
  title?: string
}

export interface OpenApiServer {
  url?: string
}

export interface OpenApiMediaType {
  schema?: OpenApiSchema
}

export interface OpenApiRequestBody {
  required?: boolean
  description?: string
  content?: Record<string, OpenApiMediaType>
}

export interface OpenApiResponse {
  description?: string
  content?: Record<string, OpenApiMediaType>
}

export interface OpenApiParameter {
  name?: string
  in?: string
  required?: boolean
  description?: string
  schema?: OpenApiSchema
}

export interface OpenApiOperation {
  operationId?: string
  summary?: string
  tags?: string[]
  parameters?: OpenApiParameter[]
  requestBody?: OpenApiRequestBody
  responses?: Record<string, OpenApiResponse>
}

export type OpenApiPathItem = Record<string, OpenApiOperation | OpenApiParameter[] | undefined> & {
  parameters?: OpenApiParameter[]
}

export interface OpenApiDocument {
  info?: OpenApiInfo
  servers?: OpenApiServer[]
  paths?: Record<string, OpenApiPathItem>
  components?: {
    schemas?: Record<string, OpenApiSchema>
  }
}

export interface ParameterInfo {
  name: string
  in: string
  required: boolean
  description?: string
  schema: OpenApiSchema
}

export interface RequestBodyInfo {
  contentType: string
  description?: string
  required: boolean
  schema: OpenApiSchema
}

export interface ResponseInfo {
  statusCode: string
  contentType: string
  description?: string
  schema: OpenApiSchema
}

export interface OperationInfo {
  operationId: string
  method: string
  path: string
  summary: string
  parameters: ParameterInfo[]
  requestBody?: RequestBodyInfo
  response?: ResponseInfo
  responseSchema?: OpenApiSchema
  tags: string[]
}

const JS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export function isValidJsIdentifier(name: string): boolean {
  return JS_IDENTIFIER.test(name)
}

export function toTypescriptPropertyKey(name: string): string {
  return isValidJsIdentifier(name) ? name : JSON.stringify(name)
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

export function resolveRefName(ref: string): string {
  const parts = ref.split('/')
  return parts[parts.length - 1] || ref
}

export function getComponentSchemas(spec: OpenApiDocument): Record<string, OpenApiSchema> {
  return spec.components?.schemas ?? {}
}

export function getSpecTitle(spec: OpenApiDocument): string {
  return spec.info?.title || 'the API'
}

export function getPrimaryServerUrl(spec: OpenApiDocument): string {
  return spec.servers?.[0]?.url || 'https://api.example.com'
}

export function getOperationRequestModelName(op: OperationInfo): string {
  return `${toPascalCase(op.operationId)}Request`
}

export function getOperationResponseModelName(op: OperationInfo): string {
  return `${toPascalCase(op.operationId)}Response`
}

export function buildNestedModelName(parentName: string, segment: string): string {
  return `${parentName}${toPascalCase(segment)}`
}

export function isObjectSchema(schema: OpenApiSchema | undefined): boolean {
  return Boolean(schema && (schema.type === 'object' || schema.properties))
}

export function isArraySchema(schema: OpenApiSchema | undefined): boolean {
  return Boolean(schema?.type === 'array')
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function wrapTypescriptNullable(type: string, schema: OpenApiSchema): string {
  if (!schema.nullable) return type
  if (type.includes(' | ') || type.includes(' & ')) {
    return `(${type}) | null`
  }
  return `${type} | null`
}

export function toTypescriptType(schema: OpenApiSchema | undefined): string {
  if (!schema) return 'unknown'
  if (schema.$ref) return toPascalCase(resolveRefName(schema.$ref))

  if (schema.allOf?.length) {
    return wrapTypescriptNullable(
      uniqueStrings(schema.allOf.map((part) => toTypescriptType(part))).join(' & '),
      schema,
    )
  }

  const variants = schema.oneOf ?? schema.anyOf
  if (variants?.length) {
    return wrapTypescriptNullable(
      uniqueStrings(variants.map((part) => toTypescriptType(part))).join(' | '),
      schema,
    )
  }

  if (schema.enum?.length) {
    const values = schema.enum
      .map((value) => (typeof value === 'string' ? JSON.stringify(value) : String(value)))
      .join(' | ')
    return wrapTypescriptNullable(values, schema)
  }

  switch (schema.type) {
    case 'string':
      return wrapTypescriptNullable('string', schema)
    case 'integer':
    case 'number':
      return wrapTypescriptNullable('number', schema)
    case 'boolean':
      return wrapTypescriptNullable('boolean', schema)
    case 'array': {
      const itemType = toTypescriptType(schema.items)
      const result = itemType.includes(' | ') || itemType.includes(' & ')
        ? `(${itemType})[]`
        : `${itemType}[]`
      return wrapTypescriptNullable(result, schema)
    }
    case 'object':
    default: {
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        const required = new Set(schema.required ?? [])
        const lines = Object.entries(schema.properties).map(([propName, propSchema]) => {
          const optional = required.has(propName) ? '' : '?'
          return `  ${toTypescriptPropertyKey(propName)}${optional}: ${toTypescriptType(propSchema)}`
        })
        return wrapTypescriptNullable(`{\n${lines.join('\n')}\n}`, schema)
      }

      if (typeof schema.additionalProperties === 'object') {
        return wrapTypescriptNullable(
          `Record<string, ${toTypescriptType(schema.additionalProperties)}>`,
          schema,
        )
      }

      if (schema.type === 'object' || schema.additionalProperties === true) {
        return wrapTypescriptNullable('Record<string, unknown>', schema)
      }

      return 'unknown'
    }
  }
}

export function collectSchemaRefs(
  schema: OpenApiSchema | undefined,
  refs = new Set<string>(),
): Set<string> {
  if (!schema) return refs
  if (schema.$ref) {
    refs.add(toPascalCase(resolveRefName(schema.$ref)))
    return refs
  }

  if (schema.items) collectSchemaRefs(schema.items, refs)
  if (typeof schema.additionalProperties === 'object') {
    collectSchemaRefs(schema.additionalProperties, refs)
  }

  for (const variant of schema.allOf ?? []) collectSchemaRefs(variant, refs)
  for (const variant of schema.oneOf ?? []) collectSchemaRefs(variant, refs)
  for (const variant of schema.anyOf ?? []) collectSchemaRefs(variant, refs)
  for (const propSchema of Object.values(schema.properties ?? {})) {
    collectSchemaRefs(propSchema, refs)
  }

  return refs
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

function pickJsonMediaSchema(
  content: Record<string, OpenApiMediaType> | undefined,
): { contentType: string; schema: OpenApiSchema } | undefined {
  if (!content) return undefined

  for (const [contentType, mediaType] of Object.entries(content)) {
    if (
      mediaType?.schema &&
      (contentType === 'application/json' || contentType.endsWith('+json') || contentType === '*/*')
    ) {
      return { contentType, schema: mediaType.schema }
    }
  }

  return undefined
}

function pickResponse(
  responses: Record<string, OpenApiResponse> | undefined,
): ResponseInfo | undefined {
  if (!responses) return undefined

  const preferredCodes = ['200', '201', '202', '203', '204', 'default']

  for (const statusCode of preferredCodes) {
    const response = responses[statusCode]
    const match = pickJsonMediaSchema(response?.content)
    if (match) {
      return {
        statusCode,
        contentType: match.contentType,
        description: response?.description,
        schema: match.schema,
      }
    }
  }

  return undefined
}

export function extractOperations(spec: OpenApiDocument): OperationInfo[] {
  const operations: OperationInfo[] = []
  const paths = spec.paths ?? {}

  for (const [path, pathItem] of Object.entries(paths)) {
    const pathParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : []
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const

    for (const method of httpMethods) {
      const op = pathItem[method]
      if (!op || Array.isArray(op)) continue

      const opParams = Array.isArray(op.parameters) ? op.parameters : []
      const deduped = new Map<string, OpenApiParameter>()
      for (const param of [...pathParams, ...opParams]) {
        if (!param?.name || !param.in) continue
        deduped.set(`${param.name}:${param.in}`, param)
      }

      const parameters = Array.from(deduped.values()).map((param) => ({
        name: param.name ?? 'param',
        in: param.in ?? 'query',
        required: Boolean(param.required || param.in === 'path'),
        description: param.description,
        schema: param.schema ?? { type: 'string' },
      }))

      const requestMatch = pickJsonMediaSchema(op.requestBody?.content)
      const requestBody = requestMatch
        ? {
            contentType: requestMatch.contentType,
            description: op.requestBody?.description,
            required: Boolean(op.requestBody?.required),
            schema: requestMatch.schema,
          }
        : undefined

      const response = pickResponse(op.responses)

      operations.push({
        operationId: op.operationId || methodPathToOperationId(method, path),
        method: method.toUpperCase(),
        path,
        summary: op.summary || '',
        parameters,
        requestBody,
        response,
        responseSchema: response?.schema,
        tags: op.tags?.length ? op.tags : ['default'],
      })
    }
  }

  return operations
}

import {
  buildNestedModelName,
  extractOperations,
  getComponentSchemas,
  getOperationRequestModelName,
  getOperationResponseModelName,
  getPrimaryServerUrl,
  getSpecTitle,
  resolveRefName,
  toPascalCase,
  type OpenApiDocument,
  type OpenApiSchema,
  type OperationInfo,
} from './shared'

interface GoRegistry {
  namesBySchema: Map<OpenApiSchema, string>
  schemasByName: Map<string, OpenApiSchema>
}

function createGoRegistry(spec: OpenApiDocument, operations: OperationInfo[]): GoRegistry {
  const registry: GoRegistry = {
    namesBySchema: new Map(),
    schemasByName: new Map(),
  }

  for (const [name, schema] of Object.entries(getComponentSchemas(spec))) {
    registerGoSchema(schema, toPascalCase(name), registry)
  }

  for (const operation of operations) {
    if (operation.requestBody?.schema && shouldRegisterGoRootSchema(operation.requestBody.schema)) {
      registerGoSchema(operation.requestBody.schema, getOperationRequestModelName(operation), registry)
    }
    if (operation.responseSchema && shouldRegisterGoRootSchema(operation.responseSchema)) {
      registerGoSchema(operation.responseSchema, getOperationResponseModelName(operation), registry)
    }
  }

  return registry
}

function shouldRegisterGoRootSchema(schema: OpenApiSchema | undefined): boolean {
  if (!schema || schema.$ref) return false
  return Boolean(
    schema.type === 'object' ||
      schema.properties ||
      schema.type === 'array' ||
      schema.enum?.length ||
      schema.oneOf?.length ||
      schema.anyOf?.length ||
      schema.allOf?.length,
  )
}

function shouldRegisterGoNestedSchema(schema: OpenApiSchema | undefined): boolean {
  if (!schema || schema.$ref) return false
  return Boolean(schema.type === 'object' || schema.properties || schema.oneOf?.length || schema.anyOf?.length || schema.allOf?.length)
}

function makeUniqueGoName(preferredName: string, registry: GoRegistry): string {
  let candidate = preferredName
  let index = 2
  while (registry.schemasByName.has(candidate)) {
    candidate = `${preferredName}${index}`
    index += 1
  }
  return candidate
}

function registerGoSchema(schema: OpenApiSchema, preferredName: string, registry: GoRegistry): string {
  const existingName = registry.namesBySchema.get(schema)
  if (existingName) return existingName

  const name = makeUniqueGoName(preferredName, registry)
  registry.namesBySchema.set(schema, name)
  registry.schemasByName.set(name, schema)
  collectNestedGoSchemas(name, schema, registry)
  return name
}

function collectNestedGoSchemas(parentName: string, schema: OpenApiSchema | undefined, registry: GoRegistry): void {
  if (!schema || schema.$ref) return

  if (schema.type === 'array') {
    const itemSchema = schema.items
    const itemName = buildNestedModelName(parentName, 'Item')
    if (shouldRegisterGoNestedSchema(itemSchema) && itemSchema) {
      registerGoSchema(itemSchema, itemName, registry)
    } else {
      collectNestedGoSchemas(itemName, itemSchema, registry)
    }
    return
  }

  for (const [index, variant] of (schema.allOf ?? []).entries()) {
    const variantName = buildNestedModelName(parentName, `AllOf${index + 1}`)
    if (shouldRegisterGoNestedSchema(variant)) {
      registerGoSchema(variant, variantName, registry)
    } else {
      collectNestedGoSchemas(variantName, variant, registry)
    }
  }

  for (const [index, variant] of (schema.oneOf ?? []).entries()) {
    const variantName = buildNestedModelName(parentName, `Variant${index + 1}`)
    if (shouldRegisterGoNestedSchema(variant)) {
      registerGoSchema(variant, variantName, registry)
    } else {
      collectNestedGoSchemas(variantName, variant, registry)
    }
  }

  for (const [index, variant] of (schema.anyOf ?? []).entries()) {
    const variantName = buildNestedModelName(parentName, `Option${index + 1}`)
    if (shouldRegisterGoNestedSchema(variant)) {
      registerGoSchema(variant, variantName, registry)
    } else {
      collectNestedGoSchemas(variantName, variant, registry)
    }
  }

  for (const [propName, propSchema] of Object.entries(schema.properties ?? {})) {
    const nestedName = buildNestedModelName(parentName, propName)
    if (shouldRegisterGoNestedSchema(propSchema)) {
      registerGoSchema(propSchema, nestedName, registry)
    } else {
      collectNestedGoSchemas(nestedName, propSchema, registry)
    }
  }

  if (typeof schema.additionalProperties === 'object') {
    const valueName = buildNestedModelName(parentName, 'Value')
    if (shouldRegisterGoNestedSchema(schema.additionalProperties)) {
      registerGoSchema(schema.additionalProperties, valueName, registry)
    } else {
      collectNestedGoSchemas(valueName, schema.additionalProperties, registry)
    }
  }
}

function renderGoType(
  schema: OpenApiSchema | undefined,
  registry: GoRegistry,
  currentName?: string,
): string {
  if (!schema) return 'json.RawMessage'
  if (schema.$ref) return toPascalCase(resolveRefName(schema.$ref))

  const namedType = registry.namesBySchema.get(schema)
  if (namedType && namedType !== currentName) return namedType

  if (schema.enum?.length) return 'string'
  if (schema.oneOf?.length || schema.anyOf?.length) return 'json.RawMessage'
  if (schema.allOf?.length) return namedType && namedType !== currentName ? namedType : 'json.RawMessage'

  switch (schema.type) {
    case 'string':
      return 'string'
    case 'integer':
      return schema.format === 'int64' ? 'int64' : 'int'
    case 'number':
      return schema.format === 'float' ? 'float32' : 'float64'
    case 'boolean':
      return 'bool'
    case 'array':
      return `[]${renderGoType(schema.items, registry)}`
    case 'object':
    default:
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        return namedType && namedType !== currentName ? namedType : 'map[string]json.RawMessage'
      }
      if (typeof schema.additionalProperties === 'object') {
        return `map[string]${renderGoType(schema.additionalProperties, registry)}`
      }
      if (schema.type === 'object' || schema.additionalProperties === true) {
        return 'map[string]json.RawMessage'
      }
      return 'json.RawMessage'
  }
}

function isGoPrimitiveType(type: string): boolean {
  return ['string', 'int', 'int64', 'float32', 'float64', 'bool'].includes(type)
}

function shouldUseGoPointer(type: string, registry: GoRegistry): boolean {
  if (type.startsWith('*') || type.startsWith('[]') || type.startsWith('map[') || type === 'json.RawMessage') {
    return false
  }
  if (isGoPrimitiveType(type)) return true

  const schema = registry.schemasByName.get(type)
  if (!schema) return true
  if (schema.type === 'array') return false
  if (typeof schema.additionalProperties === 'object' || schema.additionalProperties === true) return false
  if (schema.oneOf?.length || schema.anyOf?.length) return false
  return true
}

function mergeAllOfObjectSchema(schema: OpenApiSchema): OpenApiSchema | null {
  const mergedProperties: Record<string, OpenApiSchema> = {}
  const required = new Set<string>()
  let additionalProperties: boolean | OpenApiSchema | undefined
  let hasObjectPart = false

  for (const part of schema.allOf ?? []) {
    if (part.$ref) continue
    if (part.type === 'object' || part.properties) {
      hasObjectPart = true
      Object.assign(mergedProperties, part.properties ?? {})
      for (const propName of part.required ?? []) required.add(propName)
      if (part.additionalProperties !== undefined) additionalProperties = part.additionalProperties
    }
  }

  if (!hasObjectPart) return null

  return {
    type: 'object',
    properties: mergedProperties,
    required: Array.from(required),
    additionalProperties,
  }
}

function generateGoObjectDefinition(
  name: string,
  schema: OpenApiSchema,
  registry: GoRegistry,
  embeddedTypes: string[] = [],
): string {
  const properties = Object.entries(schema.properties ?? {})
  if (properties.length === 0) {
    if (embeddedTypes.length > 0) {
      return `type ${name} struct {\n${embeddedTypes.map((embeddedType) => `\t${embeddedType}`).join('\n')}\n}`
    }
    if (typeof schema.additionalProperties === 'object') {
      return `type ${name} map[string]${renderGoType(schema.additionalProperties, registry)}`
    }
    return `type ${name} map[string]json.RawMessage`
  }

  const required = new Set(schema.required ?? [])
  const lines: string[] = [`type ${name} struct {`]
  for (const embeddedType of embeddedTypes) {
    lines.push(`\t${embeddedType}`)
  }

  for (const [propName, propSchema] of properties) {
    let goType = renderGoType(propSchema, registry)
    if (!required.has(propName) && shouldUseGoPointer(goType, registry)) {
      goType = `*${goType}`
    }
    const jsonTag = required.has(propName)
      ? `\`json:"${propName}"\``
      : `\`json:"${propName},omitempty"\``
    lines.push(`\t${toPascalCase(propName)} ${goType} ${jsonTag}`)
  }

  lines.push('}')
  return lines.join('\n')
}

function generateGoDefinition(name: string, schema: OpenApiSchema, registry: GoRegistry): string {
  if (schema.allOf?.length) {
    const embeddedTypes = schema.allOf
      .filter((part) => Boolean(part.$ref))
      .map((part) => renderGoType(part, registry))
    const mergedObject = mergeAllOfObjectSchema(schema)
    if (mergedObject) {
      return generateGoObjectDefinition(name, mergedObject, registry, embeddedTypes)
    }
    return `type ${name} = json.RawMessage`
  }

  if (schema.enum?.length) {
    const lines = [`type ${name} string`, '', 'const (']
    for (const value of schema.enum) {
      lines.push(`\t${name}${toPascalCase(String(value))} ${name} = ${JSON.stringify(String(value))}`)
    }
    lines.push(')')
    return lines.join('\n')
  }

  if (schema.type === 'object' || schema.properties) {
    return generateGoObjectDefinition(name, schema, registry)
  }

  return `type ${name} = ${renderGoType(schema, registry, name)}`
}

function generateTypesFile(spec: OpenApiDocument, operations: OperationInfo[], registry: GoRegistry): string {
  const lines: string[] = [
    'package sdk',
    '',
    'import "encoding/json"',
    '',
    'var _ json.RawMessage',
    '',
  ]

  const knownSchemas = new Set(Object.keys(getComponentSchemas(spec)).map((name) => toPascalCase(name)))
  for (const operation of operations) {
    if (operation.requestBody?.schema && shouldRegisterGoRootSchema(operation.requestBody.schema)) {
      knownSchemas.add(getOperationRequestModelName(operation))
    }
    if (operation.responseSchema && shouldRegisterGoRootSchema(operation.responseSchema)) {
      knownSchemas.add(getOperationResponseModelName(operation))
    }
  }

  for (const [name, schema] of registry.schemasByName) {
    if (!knownSchemas.has(name)) continue
    lines.push(generateGoDefinition(name, schema, registry))
    lines.push('')
  }

  for (const [name, schema] of registry.schemasByName) {
    if (knownSchemas.has(name)) continue
    lines.push(generateGoDefinition(name, schema, registry))
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}

function toCamelCaseGo(value: string): string {
  const parts = value.split(/[^a-zA-Z0-9]/).filter(Boolean)
  return parts
    .map((part, index) => (index === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
}

function buildPathFormat(path: string, params: { name: string }[]): { format: string; args: string[] } {
  let format = path
  const args: string[] = []
  for (const param of params) {
    format = format.replace(`{${param.name}}`, '%v')
    args.push(toCamelCaseGo(param.name))
  }
  return { format, args }
}

function getGoArgumentType(schema: OpenApiSchema, required: boolean, registry: GoRegistry): string {
  const baseType = renderGoType(schema, registry)
  if (required) return baseType
  return shouldUseGoPointer(baseType, registry) ? `*${baseType}` : baseType
}

function generateEndpointMethods(operations: OperationInfo[], registry: GoRegistry): string {
  const lines: string[] = []

  for (const operation of operations) {
    const methodName = toPascalCase(operation.operationId)
    const pathParams = operation.parameters.filter((param) => param.in === 'path')
    const queryParams = operation.parameters.filter((param) => param.in === 'query')
    const returnType = operation.responseSchema ? renderGoType(operation.responseSchema, registry) : ''
    const hasReturn = Boolean(returnType)

    const funcArgs: string[] = []
    for (const param of pathParams) {
      funcArgs.push(`${toCamelCaseGo(param.name)} ${renderGoType(param.schema, registry)}`)
    }
    if (operation.requestBody) {
      funcArgs.push(`body ${renderGoType(operation.requestBody.schema, registry)}`)
    }
    for (const param of queryParams) {
      funcArgs.push(`${toCamelCaseGo(param.name)} ${getGoArgumentType(param.schema, param.required, registry)}`)
    }

    if (operation.summary) lines.push(`// ${methodName} ${operation.summary}`)
    lines.push(`func (c *Client) ${methodName}(${funcArgs.join(', ')}) ${hasReturn ? `(${returnType}, error)` : 'error'} {`)

    if (hasReturn) {
      lines.push(`\tvar result ${returnType}`)
    }

    const { format, args } = buildPathFormat(operation.path, pathParams)
    if (pathParams.length > 0) {
      lines.push(`\tpath := fmt.Sprintf(${JSON.stringify(format)}, ${args.join(', ')})`)
    } else {
      lines.push(`\tpath := ${JSON.stringify(operation.path)}`)
    }

    if (queryParams.length > 0) {
      lines.push('\tquery := url.Values{}')
      for (const param of queryParams) {
        const argName = toCamelCaseGo(param.name)
        const argType = getGoArgumentType(param.schema, param.required, registry)
        if (param.required) {
          lines.push(`\tquery.Set(${JSON.stringify(param.name)}, fmt.Sprint(${argName}))`)
        } else if (argType.startsWith('*')) {
          lines.push(`\tif ${argName} != nil {`)
          lines.push(`\t\tquery.Set(${JSON.stringify(param.name)}, fmt.Sprint(*${argName}))`)
          lines.push('\t}')
        } else {
          lines.push(`\tif ${argName} != nil {`)
          lines.push(`\t\tquery.Set(${JSON.stringify(param.name)}, fmt.Sprint(${argName}))`)
          lines.push('\t}')
        }
      }
      lines.push('\tif qs := query.Encode(); qs != "" {')
      lines.push('\t\tpath += "?" + qs')
      lines.push('\t}')
    }

    if (operation.requestBody) {
      lines.push('\tjsonBody, err := json.Marshal(body)')
      lines.push('\tif err != nil {')
      lines.push(hasReturn ? '\t\treturn result, err' : '\t\treturn err')
      lines.push('\t}')
      lines.push(hasReturn
        ? `\terr = c.do(${JSON.stringify(operation.method)}, path, bytes.NewReader(jsonBody), &result)`
        : `\treturn c.do(${JSON.stringify(operation.method)}, path, bytes.NewReader(jsonBody), nil)`)
      if (hasReturn) {
        lines.push('\treturn result, err')
      }
    } else if (hasReturn) {
      lines.push(`\terr := c.do(${JSON.stringify(operation.method)}, path, nil, &result)`)
      lines.push('\treturn result, err')
    } else {
      lines.push(`\treturn c.do(${JSON.stringify(operation.method)}, path, nil, nil)`)
    }

    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}

export function generateGoSdk(
  spec: OpenApiDocument,
  packageName: string,
  version: string,
): Map<string, string> {
  const files = new Map<string, string>()
  const operations = extractOperations(spec)
  const registry = createGoRegistry(spec, operations)
  const moduleName = `github.com/user/${packageName}`

  files.set('types.go', generateTypesFile(spec, operations, registry))

  files.set(
    'client.go',
    `package sdk\n\nimport (\n\t"fmt"\n\t"io"\n\t"net/http"\n\t"encoding/json"\n)\n\ntype Client struct {\n\tBaseURL string\n\tAPIKey string\n\tHTTPClient *http.Client\n}\n\nfunc NewClient(baseURL string, apiKey string) *Client {\n\treturn &Client{\n\t\tBaseURL: baseURL,\n\t\tAPIKey: apiKey,\n\t\tHTTPClient: &http.Client{},\n\t}\n}\n\ntype APIError struct {\n\tStatusCode int\n\tMessage string\n\tBody string\n}\n\nfunc (e *APIError) Error() string {\n\treturn fmt.Sprintf("API Error %d: %s", e.StatusCode, e.Message)\n}\n\nfunc (c *Client) do(method, path string, body io.Reader, result any) error {\n\treq, err := http.NewRequest(method, c.BaseURL+path, body)\n\tif err != nil {\n\t\treturn err\n\t}\n\n\treq.Header.Set("Content-Type", "application/json")\n\tif c.APIKey != "" {\n\t\treq.Header.Set("Authorization", "Bearer "+c.APIKey)\n\t}\n\n\tresp, err := c.HTTPClient.Do(req)\n\tif err != nil {\n\t\treturn err\n\t}\n\tdefer resp.Body.Close()\n\n\tif resp.StatusCode >= 400 {\n\t\trespBody, _ := io.ReadAll(resp.Body)\n\t\treturn &APIError{\n\t\t\tStatusCode: resp.StatusCode,\n\t\t\tMessage: resp.Status,\n\t\t\tBody: string(respBody),\n\t\t}\n\t}\n\n\tif result != nil && resp.StatusCode != 204 {\n\t\treturn json.NewDecoder(resp.Body).Decode(result)\n\t}\n\treturn nil\n}\n`,
  )

  files.set(
    'endpoints.go',
    `package sdk\n\nimport (\n\t"bytes"\n\t"encoding/json"\n\t"fmt"\n\t"net/url"\n)\n\nvar (\n\t_ = bytes.NewReader\n\t_ = json.Marshal\n\t_ = fmt.Sprintf\n\t_ = url.Values{}\n)\n\n${generateEndpointMethods(operations, registry)}`,
  )

  files.set('go.mod', `module ${moduleName}\n\ngo 1.21\n`)

  const firstOperation = operations[0]
  const exampleMethod = firstOperation ? toPascalCase(firstOperation.operationId) : 'ListItems'

  files.set(
    'README.md',
    `# ${packageName}\n\nGo SDK for ${getSpecTitle(spec)} (v${version}).\n\n## Installation\n\n\`\`\`bash\ngo get ${moduleName}\n\`\`\`\n\n## Usage\n\n\`\`\`go\npackage main\n\nimport (\n\t"fmt"\n\t"log"\n\n\tsdk ${JSON.stringify(moduleName)}\n)\n\nfunc main() {\n\tclient := sdk.NewClient(${JSON.stringify(getPrimaryServerUrl(spec))}, "your-api-key")\n\n\tresult, err := client.${exampleMethod}()\n\tif err != nil {\n\t\tlog.Fatal(err)\n\t}\n\n\tfmt.Printf("%+v\\n", result)\n}\n\`\`\`\n\n## Error Handling\n\n\`\`\`go\nresult, err := client.${exampleMethod}()\nif err != nil {\n\tif apiErr, ok := err.(*sdk.APIError); ok {\n\t\tfmt.Printf("Status: %d, Body: %s\\n", apiErr.StatusCode, apiErr.Body)\n\t}\n}\n\`\`\`\n`,
  )

  return files
}

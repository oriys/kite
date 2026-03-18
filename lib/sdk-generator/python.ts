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
  toSnakeCase,
  type OpenApiDocument,
  type OpenApiSchema,
  type OperationInfo,
} from './shared'

interface PythonRegistry {
  namesBySchema: Map<OpenApiSchema, string>
  schemasByName: Map<string, OpenApiSchema>
}

function createPythonRegistry(spec: OpenApiDocument, operations: OperationInfo[]): PythonRegistry {
  const registry: PythonRegistry = {
    namesBySchema: new Map(),
    schemasByName: new Map(),
  }

  for (const [name, schema] of Object.entries(getComponentSchemas(spec))) {
    registerNamedSchema(schema, toPascalCase(name), registry)
  }

  for (const operation of operations) {
    if (operation.requestBody?.schema && shouldRegisterPythonRootSchema(operation.requestBody.schema)) {
      registerNamedSchema(operation.requestBody.schema, getOperationRequestModelName(operation), registry)
    }
    if (operation.responseSchema && shouldRegisterPythonRootSchema(operation.responseSchema)) {
      registerNamedSchema(operation.responseSchema, getOperationResponseModelName(operation), registry)
    }
  }

  return registry
}

function shouldRegisterPythonRootSchema(schema: OpenApiSchema | undefined): boolean {
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

function shouldRegisterPythonNestedSchema(schema: OpenApiSchema | undefined): boolean {
  if (!schema || schema.$ref) return false
  return Boolean(schema.type === 'object' || schema.properties || schema.oneOf?.length || schema.anyOf?.length || schema.allOf?.length)
}

function makeUniqueSchemaName(preferredName: string, registry: PythonRegistry): string {
  let candidate = preferredName
  let index = 2
  while (registry.schemasByName.has(candidate)) {
    candidate = `${preferredName}${index}`
    index += 1
  }
  return candidate
}

function registerNamedSchema(
  schema: OpenApiSchema,
  preferredName: string,
  registry: PythonRegistry,
): string {
  const existingName = registry.namesBySchema.get(schema)
  if (existingName) return existingName

  const name = makeUniqueSchemaName(preferredName, registry)
  registry.namesBySchema.set(schema, name)
  registry.schemasByName.set(name, schema)
  collectNestedPythonSchemas(name, schema, registry)
  return name
}

function collectNestedPythonSchemas(
  parentName: string,
  schema: OpenApiSchema | undefined,
  registry: PythonRegistry,
): void {
  if (!schema || schema.$ref) return

  if (schema.type === 'array') {
    const itemSchema = schema.items
    const itemName = buildNestedModelName(parentName, 'Item')
    if (shouldRegisterPythonNestedSchema(itemSchema) && itemSchema) {
      registerNamedSchema(itemSchema, itemName, registry)
    } else {
      collectNestedPythonSchemas(itemName, itemSchema, registry)
    }
    return
  }

  for (const [index, variant] of (schema.allOf ?? []).entries()) {
    const variantName = buildNestedModelName(parentName, `AllOf${index + 1}`)
    if (shouldRegisterPythonNestedSchema(variant)) {
      registerNamedSchema(variant, variantName, registry)
    } else {
      collectNestedPythonSchemas(variantName, variant, registry)
    }
  }

  for (const [index, variant] of (schema.oneOf ?? []).entries()) {
    const variantName = buildNestedModelName(parentName, `Variant${index + 1}`)
    if (shouldRegisterPythonNestedSchema(variant)) {
      registerNamedSchema(variant, variantName, registry)
    } else {
      collectNestedPythonSchemas(variantName, variant, registry)
    }
  }

  for (const [index, variant] of (schema.anyOf ?? []).entries()) {
    const variantName = buildNestedModelName(parentName, `Option${index + 1}`)
    if (shouldRegisterPythonNestedSchema(variant)) {
      registerNamedSchema(variant, variantName, registry)
    } else {
      collectNestedPythonSchemas(variantName, variant, registry)
    }
  }

  for (const [propName, propSchema] of Object.entries(schema.properties ?? {})) {
    const nestedName = buildNestedModelName(parentName, propName)
    if (shouldRegisterPythonNestedSchema(propSchema)) {
      registerNamedSchema(propSchema, nestedName, registry)
    } else {
      collectNestedPythonSchemas(nestedName, propSchema, registry)
    }
  }

  if (typeof schema.additionalProperties === 'object') {
    const valueName = buildNestedModelName(parentName, 'Value')
    if (shouldRegisterPythonNestedSchema(schema.additionalProperties)) {
      registerNamedSchema(schema.additionalProperties, valueName, registry)
    } else {
      collectNestedPythonSchemas(valueName, schema.additionalProperties, registry)
    }
  }
}

function toPythonLiteral(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (value === null) return 'None'
  return JSON.stringify(String(value))
}

function wrapPythonOptional(type: string, schema: OpenApiSchema): string {
  return schema.nullable ? `Optional[${type}]` : type
}

function renderPythonType(
  schema: OpenApiSchema | undefined,
  registry: PythonRegistry,
  currentName?: string,
): string {
  if (!schema) return 'JSONValue'
  if (schema.$ref) return toPascalCase(resolveRefName(schema.$ref))

  const namedType = registry.namesBySchema.get(schema)
  if (namedType && namedType !== currentName) {
    return wrapPythonOptional(namedType, schema)
  }

  if (schema.enum?.length) {
    return wrapPythonOptional(
      `Literal[${schema.enum.map((value) => toPythonLiteral(value)).join(', ')}]`,
      schema,
    )
  }

  const unionVariants = schema.oneOf ?? schema.anyOf
  if (unionVariants?.length) {
    return wrapPythonOptional(
      `Union[${Array.from(new Set(unionVariants.map((variant) => renderPythonType(variant, registry)))).join(', ')}]`,
      schema,
    )
  }

  if (schema.allOf?.length) {
    return namedType && namedType !== currentName ? wrapPythonOptional(namedType, schema) : 'JSONValue'
  }

  switch (schema.type) {
    case 'string':
      return wrapPythonOptional('str', schema)
    case 'integer':
      return wrapPythonOptional('int', schema)
    case 'number':
      return wrapPythonOptional('float', schema)
    case 'boolean':
      return wrapPythonOptional('bool', schema)
    case 'array':
      return wrapPythonOptional(`List[${renderPythonType(schema.items, registry)}]`, schema)
    case 'object':
    default:
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        return namedType && namedType !== currentName
          ? wrapPythonOptional(namedType, schema)
          : wrapPythonOptional('Dict[str, JSONValue]', schema)
      }
      if (typeof schema.additionalProperties === 'object') {
        return wrapPythonOptional(`Dict[str, ${renderPythonType(schema.additionalProperties, registry)}]`, schema)
      }
      if (schema.type === 'object' || schema.additionalProperties === true) {
        return wrapPythonOptional('Dict[str, JSONValue]', schema)
      }
      return 'JSONValue'
  }
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

function buildPythonTypedDictBlock(
  name: string,
  schema: OpenApiSchema,
  registry: PythonRegistry,
  baseTypes: string[] = [],
): string {
  const properties = Object.entries(schema.properties ?? {})
  if (properties.length === 0) {
    if (baseTypes.length > 0) {
      return `class ${name}(${baseTypes.join(', ')}):\n    pass`
    }
    if (typeof schema.additionalProperties === 'object') {
      return `${name} = Dict[str, ${renderPythonType(schema.additionalProperties, registry)}]`
    }
    return `${name} = Dict[str, JSONValue]`
  }

  const required = new Set(schema.required ?? [])
  const requiredEntries = properties
    .filter(([propName]) => required.has(propName))
    .map(([propName, propSchema]) => `    ${JSON.stringify(propName)}: ${renderPythonType(propSchema, registry)},`)
  const optionalEntries = properties
    .filter(([propName]) => !required.has(propName))
    .map(([propName, propSchema]) => `    ${JSON.stringify(propName)}: ${renderPythonType(propSchema, registry)},`)

  const blocks: string[] = []
  const helperTypes: string[] = []

  if (requiredEntries.length > 0) {
    const requiredHelper = `_${name}Required`
    blocks.push(`${requiredHelper} = TypedDict(${JSON.stringify(requiredHelper)}, {\n${requiredEntries.join('\n')}\n})`)
    helperTypes.push(requiredHelper)
  }

  if (optionalEntries.length > 0) {
    const optionalHelper = `_${name}Optional`
    blocks.push(`${optionalHelper} = TypedDict(${JSON.stringify(optionalHelper)}, {\n${optionalEntries.join('\n')}\n}, total=False)`)
    helperTypes.push(optionalHelper)
  }

  const parents = [...baseTypes, ...helperTypes]
  const parentList = parents.length > 0 ? parents.join(', ') : 'TypedDict'
  blocks.push(`class ${name}(${parentList}):\n    pass`)

  return blocks.join('\n\n')
}

function generatePythonDefinition(
  name: string,
  schema: OpenApiSchema,
  registry: PythonRegistry,
): string {
  if (schema.allOf?.length) {
    const baseTypes = schema.allOf
      .filter((part) => Boolean(part.$ref))
      .map((part) => renderPythonType(part, registry))
    const mergedObject = mergeAllOfObjectSchema(schema)
    if (mergedObject) {
      return buildPythonTypedDictBlock(name, mergedObject, registry, baseTypes)
    }
    return `${name} = JSONValue`
  }

  if (schema.type === 'object' || schema.properties) {
    return buildPythonTypedDictBlock(name, schema, registry)
  }

  return `${name} = ${renderPythonType(schema, registry, name)}`
}

function generateTypeModule(
  spec: OpenApiDocument,
  operations: OperationInfo[],
  registry: PythonRegistry,
): string {
  const lines: string[] = [
    'from __future__ import annotations',
    'from typing import Dict, List, Literal, Optional, TypedDict, Union',
    '',
    'JSONPrimitive = Union[str, int, float, bool, None]',
    'JSONValue = Union[JSONPrimitive, Dict[str, "JSONValue"], List["JSONValue"]]',
    '',
  ]

  const knownSchemas = new Set(Object.keys(getComponentSchemas(spec)).map((name) => toPascalCase(name)))
  for (const operation of operations) {
    if (operation.requestBody?.schema && shouldRegisterPythonRootSchema(operation.requestBody.schema)) {
      knownSchemas.add(getOperationRequestModelName(operation))
    }
    if (operation.responseSchema && shouldRegisterPythonRootSchema(operation.responseSchema)) {
      knownSchemas.add(getOperationResponseModelName(operation))
    }
  }

  for (const [name, schema] of registry.schemasByName) {
    if (!knownSchemas.has(name)) continue
    lines.push(generatePythonDefinition(name, schema, registry))
    lines.push('')
  }

  for (const [name, schema] of registry.schemasByName) {
    if (knownSchemas.has(name)) continue
    lines.push(generatePythonDefinition(name, schema, registry))
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}

function buildPathTemplate(path: string): string {
  return path.replace(/\{([^}]+)\}/g, (_, name) => `{${toSnakeCase(name)}}`)
}

function generateEndpointClass(
  tag: string,
  ops: OperationInfo[],
  packageDir: string,
  registry: PythonRegistry,
): string {
  const className = `${toPascalCase(tag)}Api`
  const lines: string[] = [
    'from __future__ import annotations',
    'from typing import Dict, Optional, cast',
    `from ${packageDir}.client import Client, stringify_query_value`,
    `from ${packageDir}.types import *`,
    '',
    '',
    `class ${className}:`,
    '    def __init__(self, client: Client) -> None:',
    '        self._client = client',
    '',
  ]

  for (const op of ops) {
    const methodName = toSnakeCase(op.operationId)
    const pathParams = op.parameters.filter((param) => param.in === 'path')
    const queryParams = op.parameters.filter((param) => param.in === 'query')
    const requestType = op.requestBody ? renderPythonType(op.requestBody.schema, registry) : null
    const returnType = op.responseSchema ? renderPythonType(op.responseSchema, registry) : 'None'

    const args: string[] = ['self']
    for (const param of pathParams) {
      args.push(`${toSnakeCase(param.name)}: ${renderPythonType(param.schema, registry)}`)
    }
    if (requestType) {
      args.push(`body: ${requestType}`)
    }
    for (const param of queryParams) {
      const argName = toSnakeCase(param.name)
      const paramType = renderPythonType(param.schema, registry)
      if (param.required) {
        args.push(`${argName}: ${paramType}`)
      } else {
        args.push(`${argName}: Optional[${paramType}] = None`)
      }
    }

    lines.push(`    def ${methodName}(${args.join(', ')}) -> ${returnType}:`)
    if (op.summary) lines.push(`        """${op.summary}"""`)

    const pathTemplate = buildPathTemplate(op.path)
    if (pathParams.length > 0) {
      lines.push(`        path = f"${pathTemplate}"`)
    } else {
      lines.push(`        path = "${op.path}"`)
    }

    if (queryParams.length > 0) {
      lines.push('        params: Dict[str, str] = {}')
      for (const param of queryParams) {
        const argName = toSnakeCase(param.name)
        if (param.required) {
          lines.push(`        params[${JSON.stringify(param.name)}] = stringify_query_value(${argName})`)
        } else {
          lines.push(`        if ${argName} is not None:`)
          lines.push(`            params[${JSON.stringify(param.name)}] = stringify_query_value(${argName})`)
        }
      }
    }

    const requestArgs: string[] = [`"${op.method.toLowerCase()}"`, 'path']
    if (queryParams.length > 0) requestArgs.push('params=params')
    if (requestType) requestArgs.push('json=body')

    if (returnType === 'None') {
      lines.push(`        self._client.request(${requestArgs.join(', ')})`)
      lines.push('        return None')
    } else {
      lines.push(`        return cast(${returnType}, self._client.request(${requestArgs.join(', ')}))`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function generatePythonSdk(
  spec: OpenApiDocument,
  packageName: string,
  version: string,
): Map<string, string> {
  const files = new Map<string, string>()
  const operations = extractOperations(spec)
  const registry = createPythonRegistry(spec, operations)
  const packageDir = toSnakeCase(packageName.replace(/-/g, '_'))

  files.set(`${packageDir}/types.py`, generateTypeModule(spec, operations, registry))

  files.set(
    `${packageDir}/client.py`,
    `from __future__ import annotations\nfrom typing import Dict, Optional, TypeVar, cast\nimport httpx\n\n\nT = TypeVar("T")\n\n\ndef stringify_query_value(value: object) -> str:\n    if isinstance(value, bool):\n        return "true" if value else "false"\n    return str(value)\n\n\nclass ApiError(Exception):\n    def __init__(self, status_code: int, message: str, body: str) -> None:\n        self.status_code = status_code\n        self.message = message\n        self.body = body\n        super().__init__(f"API Error {status_code}: {message}")\n\n\nclass Client:\n    def __init__(\n        self,\n        base_url: str,\n        api_key: Optional[str] = None,\n        headers: Optional[Dict[str, str]] = None,\n        timeout: float = 30.0,\n    ) -> None:\n        self.base_url = base_url.rstrip("/")\n        self._headers: Dict[str, str] = {"Content-Type": "application/json"}\n        if api_key:\n            self._headers["Authorization"] = f"Bearer {api_key}"\n        if headers:\n            self._headers.update(headers)\n        self._http = httpx.Client(\n            base_url=self.base_url,\n            headers=self._headers,\n            timeout=timeout,\n        )\n\n    def request(\n        self,\n        method: str,\n        path: str,\n        params: Optional[Dict[str, str]] = None,\n        json: object = None,\n    ) -> T:\n        response = self._http.request(method, path, params=params, json=json)\n        if not response.is_success:\n            raise ApiError(response.status_code, response.reason_phrase, response.text)\n        if response.status_code == 204:\n            return cast(T, None)\n        return cast(T, response.json())\n\n    def close(self) -> None:\n        self._http.close()\n\n    def __enter__(self) -> "Client":\n        return self\n\n    def __exit__(self, *args: object) -> None:\n        self.close()\n`,
  )

  const byTag = new Map<string, OperationInfo[]>()
  for (const operation of operations) {
    const tag = operation.tags[0] || 'default'
    if (!byTag.has(tag)) byTag.set(tag, [])
    byTag.get(tag)?.push(operation)
  }

  const endpointImports: string[] = []
  const endpointAssignments: string[] = []
  for (const [tag, ops] of byTag) {
    const fileName = toSnakeCase(tag)
    const className = `${toPascalCase(tag)}Api`
    files.set(`${packageDir}/endpoints/${fileName}.py`, generateEndpointClass(tag, ops, packageDir, registry))
    endpointImports.push(`from ${packageDir}.endpoints.${fileName} import ${className}`)
    endpointAssignments.push(`        self.${toSnakeCase(tag)} = ${className}(self._client)`)
  }

  files.set(`${packageDir}/endpoints/__init__.py`, '')

  const wrapperName = toPascalCase(packageName)
  files.set(
    `${packageDir}/__init__.py`,
    `from typing import Optional\n\nfrom ${packageDir}.client import ApiError, Client\n${endpointImports.join('\n')}\n\n\nclass ${wrapperName}:\n    def __init__(self, base_url: str, api_key: Optional[str] = None, **kwargs) -> None:\n        self._client = Client(base_url=base_url, api_key=api_key, **kwargs)\n${endpointAssignments.join('\n')}\n\n    def close(self) -> None:\n        self._client.close()\n\n    def __enter__(self) -> "${wrapperName}":\n        return self\n\n    def __exit__(self, *args: object) -> None:\n        self.close()\n\n\n__all__ = ["${wrapperName}", "Client", "ApiError"]\n`,
  )

  files.set(
    'setup.py',
    `from setuptools import find_packages, setup\n\nsetup(\n    name="${packageName}",\n    version="${version}",\n    packages=find_packages(),\n    install_requires=["httpx>=0.24"],\n    python_requires=">=3.8",\n    description="Python SDK for ${getSpecTitle(spec)}",\n)\n`,
  )

  files.set('requirements.txt', 'httpx>=0.24\n')

  const firstTag = Array.from(byTag.keys())[0] || 'default'
  const firstOperation = operations[0]
  const exampleMethod = firstOperation ? toSnakeCase(firstOperation.operationId) : 'list_items'

  files.set(
    'README.md',
    `# ${packageName}\n\nPython SDK for ${getSpecTitle(spec)} (v${version}).\n\n## Installation\n\n\`\`\`bash\npip install ${packageName}\n\`\`\`\n\n## Usage\n\n\`\`\`python\nfrom ${packageDir} import ${wrapperName}\n\nclient = ${wrapperName}(\n    base_url="${getPrimaryServerUrl(spec)}",\n    api_key="your-api-key",\n)\n\nresult = client.${toSnakeCase(firstTag)}.${exampleMethod}()\nprint(result)\n\`\`\`\n\n## Context Manager\n\n\`\`\`python\nwith ${wrapperName}(base_url="...", api_key="...") as client:\n    result = client.${toSnakeCase(firstTag)}.${exampleMethod}()\n\`\`\`\n`,
  )

  return files
}

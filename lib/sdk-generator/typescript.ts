import {
  collectSchemaRefs,
  extractOperations,
  getComponentSchemas,
  getPrimaryServerUrl,
  getSpecTitle,
  isValidJsIdentifier,
  toCamelCase,
  toPascalCase,
  toTypescriptPropertyKey,
  toTypescriptType,
  type OpenApiDocument,
  type OperationInfo,
} from './shared'

function generateInterfaces(spec: OpenApiDocument): string {
  const schemas = getComponentSchemas(spec)
  const lines: string[] = []

  for (const [name, schema] of Object.entries(schemas)) {
    const typeName = toPascalCase(name)

    if (schema.enum?.length) {
      const values = schema.enum
        .map((value) => (typeof value === 'string' ? JSON.stringify(value) : String(value)))
        .join(' | ')
      lines.push(`export type ${typeName} = ${values}\n`)
      continue
    }

    if (schema.type === 'object' || schema.properties) {
      const required = new Set(schema.required ?? [])
      lines.push(`export interface ${typeName} {`)
      for (const [propName, propSchema] of Object.entries(schema.properties ?? {})) {
        const optional = required.has(propName) ? '' : '?'
        if (propSchema.description) lines.push(`  /** ${propSchema.description} */`)
        lines.push(`  ${toTypescriptPropertyKey(propName)}${optional}: ${toTypescriptType(propSchema)}`)
      }
      lines.push('}\n')
      continue
    }

    lines.push(`export type ${typeName} = ${toTypescriptType(schema)}\n`)
  }

  return lines.join('\n')
}

function getTypescriptAccess(base: string, propertyName: string): string {
  return isValidJsIdentifier(propertyName)
    ? `${base}.${propertyName}`
    : `${base}[${JSON.stringify(propertyName)}]`
}

function generateParamType(op: OperationInfo): string | null {
  const params = op.parameters.filter((param) => param.in === 'path' || param.in === 'query')
  if (params.length === 0 && !op.requestBody) return null

  const typeName = `${toPascalCase(op.operationId)}Params`
  const lines: string[] = [`export interface ${typeName} {`]

  for (const param of params) {
    const optional = param.required ? '' : '?'
    lines.push(`  ${toTypescriptPropertyKey(param.name)}${optional}: ${toTypescriptType(param.schema)}`)
  }

  if (op.requestBody) {
    lines.push(`  body: ${toTypescriptType(op.requestBody.schema)}`)
  }

  lines.push('}')
  return lines.join('\n')
}

function generateReturnType(op: OperationInfo): string {
  if (op.responseSchema) return toTypescriptType(op.responseSchema)
  return 'void'
}

function buildUrlTemplate(path: string): string {
  return path.replace(/\{([^}]+)\}/g, (_, name) => {
    const access = getTypescriptAccess('params', name)
    return `\${encodeURIComponent(String(${access}))}`
  })
}

function collectOperationRefs(op: OperationInfo): string[] {
  const refs = new Set<string>()
  for (const param of op.parameters) collectSchemaRefs(param.schema, refs)
  if (op.requestBody) collectSchemaRefs(op.requestBody.schema, refs)
  if (op.responseSchema) collectSchemaRefs(op.responseSchema, refs)
  return Array.from(refs).sort()
}

function generateEndpointMethods(ops: OperationInfo[]): string {
  const lines: string[] = []

  for (const op of ops) {
    const methodName = toCamelCase(op.operationId)
    const hasParams = op.parameters.length > 0 || Boolean(op.requestBody)
    const paramType = `${toPascalCase(op.operationId)}Params`
    const returnType = generateReturnType(op)
    const paramArg = hasParams ? `params: ${paramType}` : ''
    const pathParams = op.parameters.filter((param) => param.in === 'path')
    const queryParams = op.parameters.filter((param) => param.in === 'query')

    if (op.summary) lines.push(`  /** ${op.summary} */`)
    lines.push(`  async ${methodName}(${paramArg}): Promise<${returnType}> {`)

    const urlExpr = pathParams.length > 0 ? `\`${buildUrlTemplate(op.path)}\`` : `'${op.path}'`

    if (queryParams.length > 0) {
      lines.push('    const query = new URLSearchParams()')
      for (const queryParam of queryParams) {
        const access = getTypescriptAccess('params', queryParam.name)
        if (queryParam.required) {
          lines.push(`    query.set(${JSON.stringify(queryParam.name)}, String(${access}))`)
        } else {
          lines.push(`    if (${access} !== undefined) query.set(${JSON.stringify(queryParam.name)}, String(${access}))`)
        }
      }
      lines.push('    const qs = query.toString()')
      lines.push(`    const url = qs ? ${urlExpr} + '?' + qs : ${urlExpr}`)
    } else {
      lines.push(`    const url = ${urlExpr}`)
    }

    const fetchOptions: string[] = [`method: '${op.method}'`]
    if (op.requestBody) fetchOptions.push('body: JSON.stringify(params.body)')

    if (returnType === 'void') {
      lines.push(`    await this.request(url, { ${fetchOptions.join(', ')} })`)
    } else {
      lines.push(`    return this.request<${returnType}>(url, { ${fetchOptions.join(', ')} })`)
    }

    lines.push('  }')
    lines.push('')
  }

  return lines.join('\n')
}

export function generateTypescriptSdk(
  spec: OpenApiDocument,
  packageName: string,
  version: string,
): Map<string, string> {
  const files = new Map<string, string>()
  const operations = extractOperations(spec)

  files.set(
    'src/types.ts',
    `// Auto-generated types for ${packageName}\n// Do not edit manually\n\n${generateInterfaces(spec)}`,
  )

  const byTag = new Map<string, OperationInfo[]>()
  for (const operation of operations) {
    const tag = operation.tags[0] || 'default'
    if (!byTag.has(tag)) byTag.set(tag, [])
    byTag.get(tag)?.push(operation)
  }

  const endpointExports: string[] = []
  for (const [tag, ops] of byTag) {
    const fileName = toCamelCase(tag)
    const className = `${toPascalCase(tag)}Api`
    const paramTypes = ops
      .map((operation) => generateParamType(operation))
      .filter((value): value is string => Boolean(value))

    const typeRefs = new Set<string>()
    for (const operation of ops) {
      for (const ref of collectOperationRefs(operation)) typeRefs.add(ref)
    }

    const imports: string[] = []
    if (typeRefs.size > 0) {
      imports.push(`import type { ${Array.from(typeRefs).join(', ')} } from '../types'`)
    }
    imports.push(`import type { ApiClient } from '../client'`)

    files.set(
      `src/endpoints/${fileName}.ts`,
      `${imports.join('\n')}\n\n${paramTypes.join('\n\n')}\n\nexport class ${className} {\n  constructor(private client: ApiClient) {}\n\n  private request<T = void>(path: string, init?: RequestInit): Promise<T> {\n    return this.client.request<T>(path, init)\n  }\n\n${generateEndpointMethods(ops)}}\n`,
    )

    endpointExports.push(`export { ${className} } from './endpoints/${fileName}'`)
  }

  const clientImports = Array.from(byTag.keys())
    .map((tag) => `import { ${toPascalCase(tag)}Api } from './endpoints/${toCamelCase(tag)}'`)
    .join('\n')
  const clientProps = Array.from(byTag.keys())
    .map((tag) => `  readonly ${toCamelCase(tag)}: ${toPascalCase(tag)}Api`)
    .join('\n')
  const clientInit = Array.from(byTag.keys())
    .map((tag) => `    this.${toCamelCase(tag)} = new ${toPascalCase(tag)}Api(this)`)
    .join('\n')

  files.set(
    'src/client.ts',
    `${clientImports}\n\nexport interface ClientOptions {\n  baseUrl: string\n  apiKey?: string\n  headers?: Record<string, string>\n}\n\nexport class ApiClient {\n  private baseUrl: string\n  private apiKey?: string\n  private headers: Record<string, string>\n\n${clientProps}\n\n  constructor(options: ClientOptions) {\n    this.baseUrl = options.baseUrl.replace(/\\\/$/, '')\n    this.apiKey = options.apiKey\n    this.headers = options.headers ?? {}\n${clientInit}\n  }\n\n  async request<T = void>(path: string, init?: RequestInit): Promise<T> {\n    const headers: Record<string, string> = {\n      'Content-Type': 'application/json',\n      ...this.headers,\n    }\n    if (this.apiKey) {\n      headers.Authorization = \`Bearer \${this.apiKey}\`\n    }\n\n    const response = await fetch(\`\${this.baseUrl}\${path}\`, {\n      ...init,\n      headers: { ...headers, ...Object.fromEntries(new Headers(init?.headers).entries()) },\n    })\n\n    if (!response.ok) {\n      const body = await response.text().catch(() => '')\n      throw new ApiError(response.status, response.statusText, body)\n    }\n\n    if (response.status === 204) return undefined as T\n    return response.json() as Promise<T>\n  }\n}\n\nexport class ApiError extends Error {\n  constructor(\n    public readonly status: number,\n    public readonly statusText: string,\n    public readonly body: string,\n  ) {\n    super(\`API Error \${status}: \${statusText}\`)\n    this.name = 'ApiError'\n  }\n}\n`,
  )

  files.set(
    'src/index.ts',
    `export { ApiClient, ApiError } from './client'\nexport type { ClientOptions } from './client'\nexport * from './types'\n${endpointExports.join('\n')}\n`,
  )

  files.set(
    'package.json',
    JSON.stringify(
      {
        name: packageName,
        version,
        description: `SDK client for ${getSpecTitle(spec)}`,
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        scripts: {
          build: 'tsc',
          clean: 'rm -rf dist',
        },
        files: ['dist'],
        license: 'MIT',
      },
      null,
      2,
    ),
  )

  files.set(
    'tsconfig.json',
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          lib: ['ES2020'],
          declaration: true,
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: 'dist',
          rootDir: 'src',
          moduleResolution: 'node',
        },
        include: ['src'],
      },
      null,
      2,
    ),
  )

  const firstTag = byTag.keys().next().value || 'default'
  const firstOperation = operations[0]
  const exampleMethod = firstOperation ? toCamelCase(firstOperation.operationId) : 'listItems'

  files.set(
    'README.md',
    `# ${packageName}\n\nTypeScript SDK for ${getSpecTitle(spec)} (v${version}).\n\n## Installation\n\n\`\`\`bash\nnpm install ${packageName}\n\`\`\`\n\n## Usage\n\n\`\`\`typescript\nimport { ApiClient } from '${packageName}'\n\nconst client = new ApiClient({\n  baseUrl: '${getPrimaryServerUrl(spec)}',\n  apiKey: 'your-api-key',\n})\n\nconst result = await client.${toCamelCase(firstTag)}.${exampleMethod}()\nconsole.log(result)\n\`\`\`\n\n## Error Handling\n\n\`\`\`typescript\nimport { ApiClient, ApiError } from '${packageName}'\n\ntry {\n  await client.${toCamelCase(firstTag)}.${exampleMethod}()\n} catch (error) {\n  if (error instanceof ApiError) {\n    console.error(\`Status: \${error.status}, Body: \${error.body}\`)\n  }\n}\n\`\`\`\n`,
  )

  return files
}

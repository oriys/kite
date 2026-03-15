import {
  extractOperations,
  toTypescriptType,
  toPascalCase,
  toCamelCase,
  type OperationInfo,
} from './shared'

function generateInterfaces(spec: Record<string, unknown>): string {
  const components = spec.components as Record<string, unknown> | undefined
  const schemas = (components?.schemas || {}) as Record<string, Record<string, unknown>>
  const lines: string[] = []

  for (const [name, schema] of Object.entries(schemas)) {
    const typeName = toPascalCase(name)

    if (schema.enum) {
      const values = (schema.enum as unknown[]).map((v: unknown) => typeof v === 'string' ? `'${v}'` : String(v)).join(' | ')
      lines.push(`export type ${typeName} = ${values}\n`)
      continue
    }

    if (schema.type === 'object' || schema.properties) {
      const props = (schema.properties || {}) as Record<string, Record<string, unknown>>
      const required = new Set((schema.required || []) as string[])
      lines.push(`export interface ${typeName} {`)
      for (const [propName, propSchema] of Object.entries(props)) {
        const opt = required.has(propName) ? '' : '?'
        if (propSchema.description) lines.push(`  /** ${propSchema.description} */`)
        lines.push(`  ${propName}${opt}: ${toTypescriptType(propSchema)}`)
      }
      lines.push('}\n')
    } else {
      lines.push(`export type ${typeName} = ${toTypescriptType(schema)}\n`)
    }
  }

  return lines.join('\n')
}

function generateParamType(op: OperationInfo): string | null {
  const params = op.parameters.filter((p) => p.in === 'path' || p.in === 'query')
  if (params.length === 0 && !op.requestBody) return null

  const lines: string[] = []
  const typeName = `${toPascalCase(op.operationId)}Params`
  lines.push(`export interface ${typeName} {`)

  for (const p of params) {
    const opt = p.required ? '' : '?'
    lines.push(`  ${p.name}${opt}: ${toTypescriptType(p.schema)}`)
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
  return path.replace(/\{([^}]+)\}/g, '${params.$1}')
}

function generateEndpointMethods(ops: OperationInfo[]): string {
  const lines: string[] = []

  for (const op of ops) {
    const methodName = toCamelCase(op.operationId)
    const hasParams = op.parameters.length > 0 || op.requestBody
    const paramType = `${toPascalCase(op.operationId)}Params`
    const returnType = generateReturnType(op)
    const paramArg = hasParams ? `params: ${paramType}` : ''
    const pathParams = op.parameters.filter((p) => p.in === 'path')
    const queryParams = op.parameters.filter((p) => p.in === 'query')

    if (op.summary) lines.push(`  /** ${op.summary} */`)
    lines.push(`  async ${methodName}(${paramArg}): Promise<${returnType}> {`)

    let urlExpr: string
    if (pathParams.length > 0) {
      urlExpr = `\`${buildUrlTemplate(op.path)}\``
    } else {
      urlExpr = `'${op.path}'`
    }

    if (queryParams.length > 0) {
      lines.push(`    const query = new URLSearchParams()`)
      for (const q of queryParams) {
        if (q.required) {
          lines.push(`    query.set('${q.name}', String(params.${q.name}))`)
        } else {
          lines.push(`    if (params.${q.name} !== undefined) query.set('${q.name}', String(params.${q.name}))`)
        }
      }
      lines.push(`    const qs = query.toString()`)
      lines.push(`    const url = qs ? ${urlExpr} + '?' + qs : ${urlExpr}`)
    } else {
      lines.push(`    const url = ${urlExpr}`)
    }

    const fetchOpts: string[] = [`method: '${op.method}'`]
    if (op.requestBody) fetchOpts.push('body: JSON.stringify(params.body)')

    if (returnType === 'void') {
      lines.push(`    await this.request(url, { ${fetchOpts.join(', ')} })`)
    } else {
      lines.push(`    return this.request<${returnType}>(url, { ${fetchOpts.join(', ')} })`)
    }
    lines.push('  }')
    lines.push('')
  }

  return lines.join('\n')
}

export function generateTypescriptSdk(spec: Record<string, unknown>, packageName: string, version: string): Map<string, string> {
  const files = new Map<string, string>()
  const operations = extractOperations(spec)

  // src/types.ts
  files.set('src/types.ts', `// Auto-generated types for ${packageName}
// Do not edit manually

${generateInterfaces(spec)}`)

  // Group operations by tag
  const byTag = new Map<string, OperationInfo[]>()
  for (const op of operations) {
    const tag = op.tags[0] || 'default'
    if (!byTag.has(tag)) byTag.set(tag, [])
    byTag.get(tag)!.push(op)
  }

  // src/endpoints/[tag].ts
  const endpointExports: string[] = []
  for (const [tag, ops] of byTag) {
    const fileName = toCamelCase(tag)
    const className = `${toPascalCase(tag)}Api`

    const paramTypes: string[] = []
    for (const op of ops) {
      const pt = generateParamType(op)
      if (pt) paramTypes.push(pt)
    }

    const imports: string[] = []
    const typeRefs = new Set<string>()
    for (const op of ops) {
      if (op.responseSchema?.$ref) typeRefs.add(toPascalCase((op.responseSchema.$ref as string).split('/').pop()!))
      if (op.requestBody?.schema?.$ref) typeRefs.add(toPascalCase((op.requestBody.schema.$ref as string).split('/').pop()!))
    }
    if (typeRefs.size > 0) {
      imports.push(`import type { ${Array.from(typeRefs).join(', ')} } from '../types'`)
    }
    imports.push(`import type { ApiClient } from '../client'`)

    const content = `${imports.join('\n')}

${paramTypes.join('\n\n')}

export class ${className} {
  constructor(private client: ApiClient) {}

  private request<T = void>(path: string, init?: RequestInit): Promise<T> {
    return this.client.request<T>(path, init)
  }

${generateEndpointMethods(ops)}}
`
    files.set(`src/endpoints/${fileName}.ts`, content)
    endpointExports.push(`export { ${className} } from './endpoints/${fileName}'`)
  }

  // src/client.ts
  const clientImports = Array.from(byTag.entries())
    .map(([tag]) => `import { ${toPascalCase(tag)}Api } from './endpoints/${toCamelCase(tag)}'`)
    .join('\n')
  const clientProps = Array.from(byTag.entries())
    .map(([tag]) => `  readonly ${toCamelCase(tag)}: ${toPascalCase(tag)}Api`)
    .join('\n')
  const clientInit = Array.from(byTag.entries())
    .map(([tag]) => `    this.${toCamelCase(tag)} = new ${toPascalCase(tag)}Api(this)`)
    .join('\n')

  files.set('src/client.ts', `${clientImports}

export interface ClientOptions {
  baseUrl: string
  apiKey?: string
  headers?: Record<string, string>
}

export class ApiClient {
  private baseUrl: string
  private apiKey?: string
  private headers: Record<string, string>

${clientProps}

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\\/$/, '')
    this.apiKey = options.apiKey
    this.headers = options.headers ?? {}
${clientInit}
  }

  async request<T = void>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.headers,
    }
    if (this.apiKey) {
      headers['Authorization'] = \`Bearer \${this.apiKey}\`
    }

    const response = await fetch(\`\${this.baseUrl}\${path}\`, {
      ...init,
      headers: { ...headers, ...Object.fromEntries(new Headers(init?.headers).entries()) },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new ApiError(response.status, response.statusText, body)
    }

    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(\`API Error \${status}: \${statusText}\`)
    this.name = 'ApiError'
  }
}
`)

  // src/index.ts
  files.set('src/index.ts', `export { ApiClient, ApiError } from './client'
export type { ClientOptions } from './client'
export * from './types'
${endpointExports.join('\n')}
`)

  // package.json
  files.set('package.json', JSON.stringify({
    name: packageName,
    version,
    description: `SDK client for ${(spec.info as Record<string, unknown>)?.title || 'API'}`,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      clean: 'rm -rf dist',
    },
    files: ['dist'],
    license: 'MIT',
  }, null, 2))

  // tsconfig.json
  files.set('tsconfig.json', JSON.stringify({
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
  }, null, 2))

  // README.md
  const firstTag = byTag.keys().next().value || 'default'
  const firstOp = operations[0]
  const exampleMethod = firstOp ? toCamelCase(firstOp.operationId) : 'listItems'

  files.set('README.md', `# ${packageName}

TypeScript SDK for ${(spec.info as Record<string, unknown>)?.title || 'the API'} (v${version}).

## Installation

\`\`\`bash
npm install ${packageName}
\`\`\`

## Usage

\`\`\`typescript
import { ApiClient } from '${packageName}'

const client = new ApiClient({
  baseUrl: '${((spec.servers as Record<string, unknown>[] | undefined)?.[0] as Record<string, unknown> | undefined)?.url || 'https://api.example.com'}',
  apiKey: 'your-api-key',
})

// Example: call an endpoint
const result = await client.${toCamelCase(firstTag)}.${exampleMethod}()
console.log(result)
\`\`\`

## Error Handling

\`\`\`typescript
import { ApiClient, ApiError } from '${packageName}'

try {
  await client.${toCamelCase(firstTag)}.${exampleMethod}()
} catch (error) {
  if (error instanceof ApiError) {
    console.error(\`Status: \${error.status}, Body: \${error.body}\`)
  }
}
\`\`\`
`)

  return files
}

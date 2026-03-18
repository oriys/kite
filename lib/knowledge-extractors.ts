import { unzipSync } from 'fflate'
import { parseOpenAPISpec } from '@/lib/openapi/parser'
import { sanitizePlainText } from '@/lib/sanitize'

/**
 * Convert an OpenAPI spec into headed markdown that the chunker can split
 * meaningfully by endpoint and schema.
 */
export async function extractOpenApiContent(
  rawContent: string,
): Promise<{ title: string; content: string }> {
  const spec = await parseOpenAPISpec(rawContent)
  const title = `${spec.title} v${spec.version}`
  const lines: string[] = [`# ${title}`]

  const info = rawContent
  let description: string | undefined
  try {
    const parsed = JSON.parse(info)
    description = parsed?.info?.description
  } catch {
    // Try YAML-style: just skip description extraction on failure
  }
  if (description) {
    lines.push('', description.trim())
  }

  // Group endpoints by first tag
  const groups = new Map<string, typeof spec.endpoints>()
  for (const ep of spec.endpoints) {
    const tag = ep.tags[0] || 'General'
    const group = groups.get(tag) ?? []
    group.push(ep)
    groups.set(tag, group)
  }

  for (const [tag, endpoints] of groups) {
    lines.push('', `## ${tag}`)

    for (const ep of endpoints) {
      lines.push('', `### ${ep.method} ${ep.path}`)
      if (ep.summary) lines.push(ep.summary)
      if (ep.description && ep.description !== ep.summary) {
        lines.push('', ep.description.trim())
      }

      // Parameters
      if (ep.parameters.length > 0) {
        const paramParts = ep.parameters.map((p) => {
          const name = p.name as string
          const location = p.in as string
          const schema = p.schema as Record<string, unknown> | undefined
          const type = (schema?.type as string) ?? ''
          const required = p.required ? 'required' : 'optional'
          const desc = (p.description as string) ?? ''
          return `${name} (${location}, ${type}, ${required})${desc ? ` — ${desc}` : ''}`
        })
        lines.push(`**Parameters:** ${paramParts.join('; ')}`)
      }

      // Request body
      if (ep.requestBody) {
        const rb = ep.requestBody as Record<string, unknown>
        const contentMap = (rb.content ?? {}) as Record<string, unknown>
        const mediaType = Object.keys(contentMap)[0]
        if (mediaType) {
          lines.push(`**Request Body** (${mediaType}):`)
          const media = contentMap[mediaType] as Record<string, unknown>
          const schema = media?.schema as Record<string, unknown> | undefined
          if (schema) {
            const json = JSON.stringify(schema, null, 2)
            lines.push('```json', json.slice(0, 800), '```')
          }
        }
      }

      // Responses
      const responseCodes = Object.keys(ep.responses)
      if (responseCodes.length > 0) {
        lines.push(`**Responses:** ${responseCodes.join(', ')}`)
      }
    }
  }

  // Schemas section
  const schemaNames = Object.keys(spec.rawSchemas)
  if (schemaNames.length > 0) {
    lines.push('', '## Schemas')
    for (const name of schemaNames) {
      lines.push('', `### ${name}`)
      const json = JSON.stringify(spec.rawSchemas[name], null, 2)
      lines.push('```json', json.slice(0, 800), '```')
    }
  }

  return { title, content: lines.join('\n') }
}

/**
 * Convert a GraphQL schema (SDL or introspection JSON) into headed markdown.
 */
export function extractGraphQlContent(
  rawContent: string,
): { title: string; content: string } {
  const trimmed = rawContent.trim()

  // Detect format: JSON introspection vs SDL
  let isJson = false
  try {
    JSON.parse(trimmed)
    isJson = true
  } catch {
    // Not JSON — treat as SDL
  }

  if (isJson) {
    return extractGraphQlFromIntrospection(trimmed)
  }
  return extractGraphQlFromSdl(trimmed)
}

// ---------------------------------------------------------------------------
// SDL path
// ---------------------------------------------------------------------------

const SDL_DEFINITION_RE =
  /("""[\s\S]*?"""\s*)?(type|input|enum|interface|union|scalar)\s+(\w+)/g

const ROOT_TYPE_NAMES: Record<string, string> = {
  Query: 'Queries',
  Mutation: 'Mutations',
  Subscription: 'Subscriptions',
}

function extractGraphQlFromSdl(
  sdl: string,
): { title: string; content: string } {
  const lines: string[] = ['# GraphQL Schema']

  // Find all definition boundaries
  const matches: Array<{
    kind: string
    name: string
    description: string
    startIndex: number
  }> = []
  let match: RegExpExecArray | null
  const re = new RegExp(SDL_DEFINITION_RE.source, 'g')
  while ((match = re.exec(sdl)) !== null) {
    const description = (match[1] ?? '').replace(/"""/g, '').trim()
    matches.push({
      kind: match[2],
      name: match[3],
      description,
      startIndex: match.index,
    })
  }

  if (matches.length === 0) {
    return { title: 'GraphQL Schema', content: sdl }
  }

  for (let i = 0; i < matches.length; i++) {
    const def = matches[i]
    const nextStart = i + 1 < matches.length ? matches[i + 1].startIndex : sdl.length
    const body = sdl.slice(def.startIndex, nextStart).trim()

    const rootHeading = ROOT_TYPE_NAMES[def.name]
    if (rootHeading) {
      lines.push('', `## ${rootHeading}`)
    } else {
      const kindLabel = def.kind.charAt(0).toUpperCase() + def.kind.slice(1)
      lines.push('', `## ${kindLabel}: ${def.name}`)
    }

    if (def.description) {
      lines.push('', def.description)
    }

    lines.push('', '```graphql', body, '```')
  }

  return { title: 'GraphQL Schema', content: lines.join('\n') }
}

// ---------------------------------------------------------------------------
// Introspection JSON path
// ---------------------------------------------------------------------------

const BUILTIN_SCALARS = new Set(['String', 'Boolean', 'Int', 'Float', 'ID'])

function extractGraphQlFromIntrospection(
  json: string,
): { title: string; content: string } {
  const parsed = JSON.parse(json)
  const schema = parsed.__schema ?? parsed.data?.__schema
  if (!schema?.types) {
    return { title: 'GraphQL Schema', content: json.slice(0, 2000) }
  }

  const rootTypeNames = new Set<string>()
  if (schema.queryType?.name) rootTypeNames.add(schema.queryType.name)
  if (schema.mutationType?.name) rootTypeNames.add(schema.mutationType.name)
  if (schema.subscriptionType?.name) rootTypeNames.add(schema.subscriptionType.name)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type IntrospectionType = Record<string, any>

  const types = (schema.types as IntrospectionType[]).filter(
    (t) => !t.name.startsWith('__') && !BUILTIN_SCALARS.has(t.name),
  )

  // Group types
  const groups = new Map<string, IntrospectionType[]>()
  for (const t of types) {
    const key = rootTypeNames.has(t.name) ? 'ROOT' : (t.kind as string)
    const group = groups.get(key) ?? []
    group.push(t)
    groups.set(key, group)
  }

  const lines: string[] = ['# GraphQL Schema']

  // Root types first
  const rootTypes = groups.get('ROOT') ?? []
  for (const t of rootTypes) {
    const heading = ROOT_TYPE_NAMES[t.name] ?? t.name
    lines.push('', `## ${heading}`)
    if (t.description) lines.push('', t.description)
    renderFields(lines, t.fields)
  }
  groups.delete('ROOT')

  // Other types by kind
  const kindLabels: Record<string, string> = {
    OBJECT: 'Type',
    INPUT_OBJECT: 'Input',
    ENUM: 'Enum',
    INTERFACE: 'Interface',
    UNION: 'Union',
    SCALAR: 'Scalar',
  }

  for (const [kind, kindTypes] of groups) {
    for (const t of kindTypes) {
      const label = kindLabels[kind] ?? kind
      lines.push('', `## ${label}: ${t.name}`)
      if (t.description) lines.push('', t.description)

      if (kind === 'ENUM' && t.enumValues) {
        const vals = t.enumValues.map(
          (v: { name: string; description?: string }) =>
            v.description ? `- \`${v.name}\` — ${v.description}` : `- \`${v.name}\``,
        )
        lines.push('', vals.join('\n'))
      } else if (t.fields) {
        renderFields(lines, t.fields)
      } else if (kind === 'UNION' && t.possibleTypes) {
        const members = t.possibleTypes.map((p: { name: string }) => p.name).join(' | ')
        lines.push('', `Members: ${members}`)
      }
    }
  }

  return { title: 'GraphQL Schema', content: lines.join('\n') }
}

function renderTypeRef(typeRef: Record<string, unknown>): string {
  if (!typeRef) return 'Unknown'
  if (typeRef.kind === 'NON_NULL') return `${renderTypeRef(typeRef.ofType as Record<string, unknown>)}!`
  if (typeRef.kind === 'LIST') return `[${renderTypeRef(typeRef.ofType as Record<string, unknown>)}]`
  return (typeRef.name as string) ?? 'Unknown'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderFields(lines: string[], fields: any[]) {
  if (!fields || fields.length === 0) return
  const fieldLines = fields.map((f: Record<string, unknown>) => {
    const type = renderTypeRef(f.type as Record<string, unknown>)
    const args = f.args as Array<Record<string, unknown>> | undefined
    const argStr =
      args && args.length > 0
        ? `(${args.map((a) => `${a.name}: ${renderTypeRef(a.type as Record<string, unknown>)}`).join(', ')})`
        : ''
    const desc = f.description ? ` — ${f.description}` : ''
    return `- \`${f.name}${argStr}\`: ${type}${desc}`
  })
  lines.push('', fieldLines.join('\n'))
}

// ---------------------------------------------------------------------------
// Zip archive extractor
// ---------------------------------------------------------------------------

const SUPPORTED_ZIP_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.yaml', '.yml',
  '.graphql', '.gql', '.xml', '.html', '.csv',
  '.tsv', '.proto', '.rst', '.adoc', '.asciidoc',
  '.asc', '.sql', '.ddl', '.ts', '.d.ts',
])

const MAX_ENTRY_SIZE = 500 * 1024 // 500 KB

export interface ZipExtractedDocument {
  path: string
  content: string
}

function normalizeZipPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/{2,}/g, '/')
}

function shouldIgnoreZipPath(path: string) {
  const normalizedPath = normalizeZipPath(path)
  if (!normalizedPath || normalizedPath.endsWith('/')) return true

  const segments = normalizedPath.split('/').filter(Boolean)
  if (segments.length === 0) return true

  if (segments.some((segment) => segment === '__MACOSX')) {
    return true
  }

  const basename = segments[segments.length - 1]
  if (basename === '.DS_Store' || basename.startsWith('._')) {
    return true
  }

  return false
}

function compareZipPaths(left: string, right: string) {
  return normalizeZipPath(left).localeCompare(normalizeZipPath(right))
}

export function extractZipDocuments(rawContent: string): ZipExtractedDocument[] {
  const bytes = Buffer.from(rawContent, 'base64')
  const entries = unzipSync(new Uint8Array(bytes))
  const textDecoder = new TextDecoder('utf-8', { fatal: false })

  return Object.keys(entries)
    .sort(compareZipPaths)
    .flatMap((path): ZipExtractedDocument[] => {
      const normalizedPath = normalizeZipPath(path)
      if (shouldIgnoreZipPath(normalizedPath)) {
        return []
      }

      const data = entries[path]
      if (!data || data.byteLength > MAX_ENTRY_SIZE) {
        return []
      }

      const dotIndex = normalizedPath.lastIndexOf('.')
      const ext = dotIndex >= 0 ? normalizedPath.slice(dotIndex).toLowerCase() : ''
      if (!SUPPORTED_ZIP_EXTENSIONS.has(ext)) {
        return []
      }

      const content = sanitizePlainText(textDecoder.decode(data)).trimEnd()
      if (!content.trim()) {
        return []
      }

      return [{ path: normalizedPath, content }]
    })
}

/**
 * Extract text content from a base64-encoded zip archive.
 * Each supported text file becomes a headed section in the output markdown.
 */
export function extractZipContent(
  rawContent: string,
): { title: string; content: string } {
  const lines: string[] = []
  const documents = extractZipDocuments(rawContent)

  for (const document of documents) {
    lines.push(`## ${document.path}`, '', document.content, '')
  }

  return {
    title: 'Zip Archive',
    content: lines.join('\n').trimEnd(),
  }
}

// ---------------------------------------------------------------------------
// AsyncAPI extractor
// ---------------------------------------------------------------------------

/**
 * Convert an AsyncAPI spec (JSON or YAML text) into headed markdown.
 * Lightweight: regex/JSON-based, no full parser dependency.
 */
export function extractAsyncApiContent(
  rawContent: string,
): { title: string; content: string } {
  const trimmed = rawContent.trim()
  let parsed: Record<string, unknown> | null = null

  try {
    parsed = JSON.parse(trimmed)
  } catch {
    // Try naive YAML key extraction
  }

  const lines: string[] = []
  let title = 'AsyncAPI Schema'

  if (parsed) {
    const info = parsed.info as Record<string, unknown> | undefined
    if (info?.title) {
      title = `${info.title}${info.version ? ` v${info.version}` : ''}`
    }
    lines.push(`# ${title}`)
    if (info?.description) {
      lines.push('', String(info.description).trim())
    }

    // Channels
    const channels = (parsed.channels ?? {}) as Record<string, Record<string, unknown>>
    if (Object.keys(channels).length > 0) {
      lines.push('', '## Channels')
      for (const [name, channel] of Object.entries(channels)) {
        lines.push('', `### ${name}`)
        if (channel.description) lines.push(String(channel.description))

        for (const op of ['subscribe', 'publish'] as const) {
          const operation = channel[op] as Record<string, unknown> | undefined
          if (!operation) continue
          lines.push('', `**${op}**`)
          if (operation.summary) lines.push(String(operation.summary))
          if (operation.message) {
            const msg = operation.message as Record<string, unknown>
            if (msg.payload) {
              lines.push('```json', JSON.stringify(msg.payload, null, 2).slice(0, 800), '```')
            }
          }
        }
      }
    }

    // Components / schemas
    const components = parsed.components as Record<string, unknown> | undefined
    const schemas = (components?.schemas ?? {}) as Record<string, unknown>
    if (Object.keys(schemas).length > 0) {
      lines.push('', '## Schemas')
      for (const [name, schema] of Object.entries(schemas)) {
        lines.push('', `### ${name}`)
        lines.push('```json', JSON.stringify(schema, null, 2).slice(0, 800), '```')
      }
    }
  } else {
    // Plain text fallback — store as-is with title extracted from first line
    lines.push(`# ${title}`, '', trimmed)
  }

  return { title, content: lines.join('\n') }
}

// ---------------------------------------------------------------------------
// Protobuf extractor
// ---------------------------------------------------------------------------

const PROTO_SERVICE_RE = /service\s+(\w+)\s*\{([^}]*)}/g
const PROTO_MESSAGE_RE = /message\s+(\w+)\s*\{([^}]*)}/g
const PROTO_ENUM_RE = /enum\s+(\w+)\s*\{([^}]*)}/g
const PROTO_RPC_RE = /rpc\s+(\w+)\s*\(([^)]*)\)\s*returns\s*\(([^)]*)\)/g
const PROTO_PACKAGE_RE = /^package\s+([\w.]+)\s*;/m

/**
 * Convert a .proto file into headed markdown.
 */
export function extractProtobufContent(
  rawContent: string,
): { title: string; content: string } {
  const lines: string[] = []
  const packageMatch = PROTO_PACKAGE_RE.exec(rawContent)
  const title = packageMatch ? `Protobuf: ${packageMatch[1]}` : 'Protobuf Schema'
  lines.push(`# ${title}`)

  // Services
  let match: RegExpExecArray | null
  const serviceRe = new RegExp(PROTO_SERVICE_RE.source, 'g')
  while ((match = serviceRe.exec(rawContent)) !== null) {
    lines.push('', `## Service: ${match[1]}`)
    const body = match[2]
    const rpcRe = new RegExp(PROTO_RPC_RE.source, 'g')
    let rpc: RegExpExecArray | null
    while ((rpc = rpcRe.exec(body)) !== null) {
      lines.push(`- \`${rpc[1]}(${rpc[2].trim()}) → ${rpc[3].trim()}\``)
    }
  }

  // Messages
  const msgRe = new RegExp(PROTO_MESSAGE_RE.source, 'g')
  while ((match = msgRe.exec(rawContent)) !== null) {
    lines.push('', `## Message: ${match[1]}`)
    lines.push('```protobuf', `message ${match[1]} {${match[2]}}`, '```')
  }

  // Enums
  const enumRe = new RegExp(PROTO_ENUM_RE.source, 'g')
  while ((match = enumRe.exec(rawContent)) !== null) {
    lines.push('', `## Enum: ${match[1]}`)
    lines.push('```protobuf', `enum ${match[1]} {${match[2]}}`, '```')
  }

  return { title, content: lines.join('\n') }
}

// ---------------------------------------------------------------------------
// reStructuredText extractor
// ---------------------------------------------------------------------------

const RST_HEADING_CHARS = ['=', '-', '~', '^', '"', '+', '#', '*']

/**
 * Convert reStructuredText into headed markdown.
 * Maps RST underline-style headings to markdown # headings.
 */
export function extractRstContent(
  rawContent: string,
): { title: string; content: string } {
  const inputLines = rawContent.split('\n')
  const outputLines: string[] = []
  let title = 'reStructuredText'
  const seenChars: string[] = []

  let i = 0
  while (i < inputLines.length) {
    const line = inputLines[i]
    const nextLine = inputLines[i + 1] ?? ''

    // Check for RST heading pattern: text line followed by underline of same length
    if (
      line.trim().length > 0 &&
      nextLine.trim().length >= line.trim().length &&
      RST_HEADING_CHARS.includes(nextLine.trim()[0]) &&
      nextLine.trim().split('').every((c) => c === nextLine.trim()[0])
    ) {
      const headChar = nextLine.trim()[0]
      if (!seenChars.includes(headChar)) seenChars.push(headChar)
      const level = Math.min(seenChars.indexOf(headChar) + 1, 6)
      const heading = '#'.repeat(level) + ' ' + line.trim()
      outputLines.push(heading)

      if (level === 1 && title === 'reStructuredText') {
        title = line.trim()
      }
      i += 2 // skip the underline
      continue
    }

    // Convert RST directives to plain text
    outputLines.push(line)
    i++
  }

  return { title, content: outputLines.join('\n') }
}

// ---------------------------------------------------------------------------
// AsciiDoc extractor
// ---------------------------------------------------------------------------

const ADOC_HEADING_RE = /^(={1,6})\s+(.+)$/

/**
 * Convert AsciiDoc into headed markdown.
 */
export function extractAsciidocContent(
  rawContent: string,
): { title: string; content: string } {
  const inputLines = rawContent.split('\n')
  const outputLines: string[] = []
  let title = 'AsciiDoc'

  for (const line of inputLines) {
    const headingMatch = ADOC_HEADING_RE.exec(line)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      outputLines.push('#'.repeat(level) + ' ' + text)
      if (level === 1 && title === 'AsciiDoc') {
        title = text
      }
    } else {
      outputLines.push(line)
    }
  }

  return { title, content: outputLines.join('\n') }
}

// ---------------------------------------------------------------------------
// CSV / TSV extractor
// ---------------------------------------------------------------------------

/**
 * Convert CSV/TSV content into a headed markdown table.
 */
export function extractCsvContent(
  rawContent: string,
): { title: string; content: string } {
  const trimmed = rawContent.trim()
  const isTsv = trimmed.split('\n')[0]?.includes('\t')
  const separator = isTsv ? '\t' : ','

  const rows = trimmed.split('\n').map((line) => {
    // Simple CSV split — handles basic cases (no quoted commas)
    return line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ''))
  })

  if (rows.length === 0) {
    return { title: 'CSV Data', content: '' }
  }

  const header = rows[0]
  const lines: string[] = [
    '# CSV Data',
    '',
    '| ' + header.join(' | ') + ' |',
    '| ' + header.map(() => '---').join(' | ') + ' |',
  ]

  for (let i = 1; i < rows.length; i++) {
    // Pad row to match header length
    const row = rows[i]
    while (row.length < header.length) row.push('')
    lines.push('| ' + row.slice(0, header.length).join(' | ') + ' |')
  }

  return { title: 'CSV Data', content: lines.join('\n') }
}

// ---------------------------------------------------------------------------
// SQL DDL extractor
// ---------------------------------------------------------------------------

const SQL_CREATE_TABLE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+(?:\.\w+)?)[`"']?\s*\(([\s\S]*?)\)\s*;/gi

/**
 * Convert SQL DDL (CREATE TABLE statements) into headed markdown.
 */
export function extractSqlDdlContent(
  rawContent: string,
): { title: string; content: string } {
  const lines: string[] = ['# SQL Schema']
  const re = new RegExp(SQL_CREATE_TABLE_RE.source, 'gi')
  let match: RegExpExecArray | null
  let count = 0

  while ((match = re.exec(rawContent)) !== null) {
    const tableName = match[1]
    const body = match[2].trim()
    lines.push('', `## Table: ${tableName}`)

    // Parse columns
    const columnLines = body
      .split('\n')
      .map((l) => l.trim().replace(/,$/, ''))
      .filter((l) => l.length > 0 && !l.toUpperCase().startsWith('CONSTRAINT') && !l.toUpperCase().startsWith('PRIMARY KEY') && !l.toUpperCase().startsWith('UNIQUE') && !l.toUpperCase().startsWith('FOREIGN KEY') && !l.toUpperCase().startsWith('CHECK'))

    for (const col of columnLines) {
      lines.push(`- \`${col}\``)
    }
    count++
  }

  if (count === 0) {
    // Fallback: no CREATE TABLE found, just show raw
    lines.push('', '```sql', rawContent.slice(0, 5000), '```')
  }

  return { title: 'SQL Schema', content: lines.join('\n') }
}

// ---------------------------------------------------------------------------
// TypeScript definitions extractor
// ---------------------------------------------------------------------------

const TS_INTERFACE_RE = /(?:export\s+)?interface\s+(\w+)(?:<[^>]*>)?\s*(?:extends\s+[^{]*)?\{/g
const TS_TYPE_RE = /(?:export\s+)?type\s+(\w+)(?:<[^>]*>)?\s*=/g
const TS_FUNCTION_RE = /(?:export\s+)?(?:declare\s+)?function\s+(\w+)(?:<[^>]*>)?\s*\(/g
const TS_CLASS_RE = /(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?class\s+(\w+)/g
const TS_ENUM_RE = /(?:export\s+)?(?:declare\s+)?(?:const\s+)?enum\s+(\w+)/g

/**
 * Convert TypeScript definitions into headed markdown with code blocks.
 */
export function extractTypeScriptDefsContent(
  rawContent: string,
): { title: string; content: string } {
  const lines: string[] = ['# TypeScript Definitions']

  // Collect all named exports
  const items: Array<{ kind: string; name: string; index: number }> = []

  for (const [re, kind] of [
    [TS_INTERFACE_RE, 'Interface'],
    [TS_TYPE_RE, 'Type'],
    [TS_FUNCTION_RE, 'Function'],
    [TS_CLASS_RE, 'Class'],
    [TS_ENUM_RE, 'Enum'],
  ] as const) {
    const localRe = new RegExp(re.source, 'g')
    let m: RegExpExecArray | null
    while ((m = localRe.exec(rawContent)) !== null) {
      items.push({ kind, name: m[1], index: m.index })
    }
  }

  items.sort((a, b) => a.index - b.index)

  if (items.length === 0) {
    // Fallback
    lines.push('', '```typescript', rawContent.slice(0, 5000), '```')
  } else {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const nextIndex = i + 1 < items.length ? items[i + 1].index : rawContent.length
      const snippet = rawContent.slice(item.index, nextIndex).trim()

      lines.push('', `## ${item.kind}: ${item.name}`)
      lines.push('```typescript', snippet.slice(0, 1500), '```')
    }
  }

  return { title: 'TypeScript Definitions', content: lines.join('\n') }
}

// ---------------------------------------------------------------------------
// Postman Collection extractor
// ---------------------------------------------------------------------------

interface PostmanItem {
  name?: string
  request?: {
    method?: string
    url?: string | { raw?: string }
    description?: string
    header?: Array<{ key: string; value: string }>
    body?: { raw?: string; mode?: string }
  }
  item?: PostmanItem[]
  description?: string
}

/**
 * Convert a Postman Collection JSON into headed markdown.
 */
export function extractPostmanContent(
  rawContent: string,
): { title: string; content: string } {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    return { title: 'Postman Collection', content: rawContent.slice(0, 5000) }
  }

  const info = parsed.info as Record<string, unknown> | undefined
  const title = (info?.name as string) ?? 'Postman Collection'
  const lines: string[] = [`# ${title}`]

  if (info?.description) {
    lines.push('', String(info.description).trim())
  }

  const items = (parsed.item ?? []) as PostmanItem[]
  renderPostmanItems(lines, items, 2)

  return { title, content: lines.join('\n') }
}

function renderPostmanItems(lines: string[], items: PostmanItem[], depth: number) {
  const prefix = '#'.repeat(Math.min(depth, 6))

  for (const item of items) {
    if (item.item && item.item.length > 0) {
      // Folder
      lines.push('', `${prefix} ${item.name ?? 'Folder'}`)
      if (item.description) lines.push(String(item.description))
      renderPostmanItems(lines, item.item, depth + 1)
    } else if (item.request) {
      const method = item.request.method ?? 'GET'
      const url =
        typeof item.request.url === 'string'
          ? item.request.url
          : item.request.url?.raw ?? ''
      lines.push('', `${prefix} ${method} ${url}`)
      if (item.name) lines.push(`**${item.name}**`)
      if (item.request.description) lines.push(String(item.request.description))

      if (item.request.body?.raw) {
        lines.push('```json', item.request.body.raw.slice(0, 800), '```')
      }
    }
  }
}

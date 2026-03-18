import type {
  ParsedEndpoint,
  ParsedSecurityScheme,
  ParsedServer,
} from './parser'
import {
  getOpenApiDocumentTypeMeta,
  getTemplateCategoryLabel,
  type OpenApiDocumentType,
} from './document-types'

const MAX_SCHEMA_JSON_LENGTH = 3_000
const MAX_EXAMPLES_PER_SECTION = 2
const MAX_TEMPLATE_CONTENT_LENGTH = 4_000

interface EndpointDocPromptOptions {
  apiTitle?: string
  apiVersion?: string | null
  servers?: ParsedServer[]
  securitySchemes?: Record<string, ParsedSecurityScheme>
  schemaJsonMaxLength?: number
}

export interface OpenApiDocumentTemplateContext {
  name: string
  description?: string
  category?: string | null
  content: string
}

export interface OpenApiDocumentRetrievedContext {
  contextText: string
  materialCount?: number
  materialTitles?: string[]
  queryVariants?: string[]
}

export function buildEndpointDocUserPrompt(
  endpoint: ParsedEndpoint,
  options: EndpointDocPromptOptions = {},
) {
  return [
    `Generate complete API documentation for this endpoint${options.apiTitle ? ` from the "${options.apiTitle}" API` : ''}.`,
    '',
    'Requirements:',
    '- Write clean, production-ready Markdown.',
    '- Do not include a top-level H1 heading.',
    '- Use the same language as the endpoint metadata when possible. If metadata is mostly English or empty, write in English.',
    '- Ground every claim in the provided metadata. If something is not declared, say so clearly instead of inventing details.',
    '- Use these H2 headings in this exact order:',
    '  1. `## Endpoint Summary`',
    '  2. `## Authentication`',
    '  3. `## Request`',
    '  4. `## Response`',
    '  5. `## Error Handling`',
    '  6. `## User Scenarios & Examples`',
    '  7. `## Risk Notes`',
    '- In **Endpoint Summary**, explicitly state the interface path, HTTP method, purpose, and when the endpoint should be used.',
    '- In **Authentication**, explain the declared auth requirement, credential placement, and scopes if present. If auth is not declared, say that explicitly.',
    '- In **Request**, cover parameters, headers, body fields, important constraints, and include a realistic example request when applicable.',
    '- In **Response**, explain successful responses and include a realistic example response.',
    '- In **Error Handling**, focus on declared non-2xx responses and what integrators should do next.',
    '- In **User Scenarios & Examples**, provide 2–3 concrete business or product scenarios showing when a developer or operator would call this endpoint.',
    '- In **Risk Notes**, highlight practical integration risks such as auth failures, rate limits, retries, idempotency, destructive writes, stale data, schema drift, or deprecation. If no special risk is declared, say the main risks are standard validation and auth handling.',
    '',
    '<endpoint_context>',
    formatEndpointContext(endpoint, options),
    '</endpoint_context>',
  ].join('\n')
}

export function formatEndpointContext(
  endpoint: ParsedEndpoint,
  options: EndpointDocPromptOptions = {},
) {
  const schemaJsonMaxLength =
    options.schemaJsonMaxLength ?? MAX_SCHEMA_JSON_LENGTH
  const lines: string[] = []

  if (options.apiTitle) {
    lines.push(`API: ${options.apiTitle}`)
  }
  if (options.apiVersion) {
    lines.push(`API Version: ${options.apiVersion}`)
  }
  if (options.servers && options.servers.length > 0) {
    lines.push(
      `Base URLs: ${options.servers.map((server) => server.url).join(', ')}`,
    )
  }

  lines.push(`Method: ${endpoint.method}`)
  lines.push(`Path: ${endpoint.path}`)

  if (endpoint.operationId) {
    lines.push(`Operation ID: ${endpoint.operationId}`)
  }
  if (endpoint.summary) {
    lines.push(`Summary: ${endpoint.summary}`)
  }
  if (endpoint.description) {
    lines.push(`Description: ${endpoint.description}`)
  }
  if (endpoint.tags.length > 0) {
    lines.push(`Tags: ${endpoint.tags.join(', ')}`)
  }
  if (endpoint.deprecated) {
    lines.push('Status: DEPRECATED')
  }

  lines.push('')
  lines.push('Authentication:')
  for (const line of buildAuthenticationLines(
    endpoint,
    options.securitySchemes ?? {},
  )) {
    lines.push(`  - ${line}`)
  }

  if (endpoint.parameters.length > 0) {
    lines.push('')
    lines.push('Parameters:')
    for (const param of endpoint.parameters) {
      lines.push(`  - ${formatParameter(param)}`)
    }
  }

  if (endpoint.requestBody) {
    lines.push('')
    lines.push('Request Body:')
    const required =
      endpoint.requestBody.required === true ? 'required' : 'optional'
    lines.push(`  Requirement: ${required}`)
    formatContentEntries(
      endpoint.requestBody,
      '  ',
      lines,
      schemaJsonMaxLength,
    )
  }

  const responseEntries = Object.entries(endpoint.responses)
  if (responseEntries.length > 0) {
    const successResponses = responseEntries.filter(([code]) =>
      isSuccessStatusCode(code),
    )
    const errorResponses = responseEntries.filter(
      ([code]) => !isSuccessStatusCode(code),
    )

    if (successResponses.length > 0) {
      lines.push('')
      lines.push('Success Responses:')
      for (const [code, resp] of successResponses) {
        formatResponseEntry(code, resp, lines, schemaJsonMaxLength)
      }
    }

    if (errorResponses.length > 0) {
      lines.push('')
      lines.push('Error Responses:')
      for (const [code, resp] of errorResponses) {
        formatResponseEntry(code, resp, lines, schemaJsonMaxLength)
      }
    }
  }

  lines.push('')
  lines.push('Suggested User Scenarios:')
  for (const line of inferUserScenarioHints(endpoint)) {
    lines.push(`  - ${line}`)
  }

  lines.push('')
  lines.push('Integration Risk Hints:')
  for (const line of inferRiskHints(endpoint)) {
    lines.push(`  - ${line}`)
  }

  return lines.join('\n')
}

function buildAuthenticationLines(
  endpoint: ParsedEndpoint,
  schemes: Record<string, ParsedSecurityScheme>,
) {
  if (Array.isArray(endpoint.security)) {
    if (endpoint.security.length === 0) {
      return ['This endpoint explicitly declares no authentication requirement.']
    }

    return endpoint.security.map((requirement, index) => {
      const alternatives = Object.entries(requirement).map(
        ([schemeName, scopes]) =>
          describeSecurityRequirement(schemeName, scopes, schemes),
      )
      const prefix =
        endpoint.security && endpoint.security.length > 1
          ? `Option ${index + 1}: `
          : ''
      return `${prefix}${alternatives.join(' + ')}`
    })
  }

  const authParameters = endpoint.parameters.filter(isAuthParameter)
  if (authParameters.length > 0) {
    return authParameters.map((param) => {
      const location = (param.in as string) || 'header'
      const name = (param.name as string) || 'credential'
      return `Credential-like parameter \`${name}\` is passed in ${location}, but the OpenAPI metadata does not define a formal security scheme.`
    })
  }

  return ['OpenAPI metadata does not declare authentication requirements for this endpoint.']
}

function describeSecurityRequirement(
  schemeName: string,
  scopes: string[],
  schemes: Record<string, ParsedSecurityScheme>,
) {
  const scheme = schemes[schemeName]
  if (!scheme) {
    return scopes.length > 0
      ? `${schemeName} with scopes ${scopes.join(', ')}`
      : schemeName
  }

  const descriptionSuffix =
    typeof scheme.description === 'string' && scheme.description.trim().length > 0
      ? ` — ${scheme.description.trim()}`
      : ''

  switch (scheme.type) {
    case 'http': {
      const schemeLabel =
        typeof scheme.scheme === 'string' && scheme.scheme.length > 0
          ? scheme.scheme.toUpperCase()
          : 'HTTP auth'
      const bearerFormat =
        typeof scheme.bearerFormat === 'string' &&
        scheme.bearerFormat.length > 0
          ? ` (${scheme.bearerFormat})`
          : ''
      return `${schemeName}: ${schemeLabel}${bearerFormat} via the Authorization header${descriptionSuffix}`
    }
    case 'apiKey': {
      const location =
        typeof scheme.in === 'string' && scheme.in.length > 0
          ? scheme.in
          : 'header'
      const parameterName =
        typeof scheme.name === 'string' && scheme.name.length > 0
          ? scheme.name
          : schemeName
      return `${schemeName}: API key in ${location} parameter \`${parameterName}\`${descriptionSuffix}`
    }
    case 'oauth2': {
      const flowNames =
        scheme.flows && isRecord(scheme.flows)
          ? Object.keys(scheme.flows).join(', ')
          : 'oauth2'
      const scopeText =
        scopes.length > 0 ? ` with scopes ${scopes.join(', ')}` : ''
      return `${schemeName}: OAuth 2.0 (${flowNames})${scopeText}${descriptionSuffix}`
    }
    case 'openIdConnect': {
      const connectUrl =
        typeof scheme.openIdConnectUrl === 'string' &&
        scheme.openIdConnectUrl.length > 0
          ? ` via ${scheme.openIdConnectUrl}`
          : ''
      const scopeText =
        scopes.length > 0 ? ` with scopes ${scopes.join(', ')}` : ''
      return `${schemeName}: OpenID Connect${connectUrl}${scopeText}${descriptionSuffix}`
    }
    default: {
      const scopeText =
        scopes.length > 0 ? ` with scopes ${scopes.join(', ')}` : ''
      return `${schemeName}: ${scheme.type ?? 'security scheme'}${scopeText}${descriptionSuffix}`
    }
  }
}

function formatParameter(param: Record<string, unknown>) {
  const name = (param.name as string) || '?'
  const location = (param.in as string) || '?'
  const schema = (param.schema as Record<string, unknown>) ?? {}
  const required = param.required ? 'required' : 'optional'
  const description = (param.description as string) || ''
  const schemaBits = describeSchema(schema)
  const examples = describeExampleSources([param, schema])

  return `${name} [${location}] ${schemaBits} (${required})${description ? ` — ${description}` : ''}${examples ? `; ${examples}` : ''}`
}

function formatResponseEntry(
  code: string,
  response: unknown,
  lines: string[],
  schemaJsonMaxLength: number,
) {
  const record = isRecord(response) ? response : {}
  const description =
    typeof record.description === 'string' && record.description.length > 0
      ? record.description
      : 'No description provided'
  lines.push(`  ${code}: ${description}`)
  formatContentEntries(record, '    ', lines, schemaJsonMaxLength)
}

function formatContentEntries(
  value: Record<string, unknown>,
  indent: string,
  lines: string[],
  schemaJsonMaxLength: number,
) {
  const content = isRecord(value.content)
    ? (value.content as Record<string, unknown>)
    : {}

  if (Object.keys(content).length === 0) {
    return
  }

  for (const [mediaType, mediaObj] of Object.entries(content)) {
    if (!isRecord(mediaObj)) continue

    lines.push(`${indent}Content-Type: ${mediaType}`)

    if (mediaObj.schema) {
      lines.push(
        `${indent}Schema: ${truncateJson(mediaObj.schema, schemaJsonMaxLength)}`,
      )
    }

    for (const exampleLine of formatExamples(mediaObj, schemaJsonMaxLength)) {
      lines.push(`${indent}${exampleLine}`)
    }
  }
}

function formatExamples(
  mediaObj: Record<string, unknown>,
  maxLength: number,
) {
  const lines: string[] = []

  if (mediaObj.example !== undefined) {
    lines.push(`Example: ${truncateJson(mediaObj.example, maxLength)}`)
  }

  if (isRecord(mediaObj.examples)) {
    const exampleEntries = Object.entries(mediaObj.examples).slice(
      0,
      MAX_EXAMPLES_PER_SECTION,
    )
    for (const [name, example] of exampleEntries) {
      const exampleValue =
        isRecord(example) && example.value !== undefined
          ? example.value
          : example
      lines.push(`Example (${name}): ${truncateJson(exampleValue, maxLength)}`)
    }
  }

  return lines
}

function describeSchema(schema: Record<string, unknown>) {
  const parts: string[] = []
  const type = schema.type as string | undefined
  const format = schema.format as string | undefined

  parts.push(type ?? inferSchemaShape(schema))

  if (format) {
    parts.push(`format: ${format}`)
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    parts.push(`enum: ${schema.enum.map(String).join(', ')}`)
  }

  if (typeof schema.minimum === 'number') {
    parts.push(`min: ${schema.minimum}`)
  }
  if (typeof schema.maximum === 'number') {
    parts.push(`max: ${schema.maximum}`)
  }
  if (typeof schema.minLength === 'number') {
    parts.push(`minLength: ${schema.minLength}`)
  }
  if (typeof schema.maxLength === 'number') {
    parts.push(`maxLength: ${schema.maxLength}`)
  }
  if (typeof schema.pattern === 'string' && schema.pattern.length > 0) {
    parts.push(`pattern: ${schema.pattern}`)
  }

  return parts.join(', ')
}

function inferSchemaShape(schema: Record<string, unknown>) {
  if (schema.properties) return 'object'
  if (schema.items) return 'array'
  if (schema.allOf) return 'allOf composition'
  if (schema.oneOf) return 'oneOf union'
  if (schema.anyOf) return 'anyOf union'
  if (schema.$ref) return `ref: ${String(schema.$ref)}`
  return 'unknown'
}

function describeExampleSources(values: Record<string, unknown>[]) {
  for (const value of values) {
    if (value.example !== undefined) {
      return `example: ${stringifyInline(value.example)}`
    }
    if (value.default !== undefined) {
      return `default: ${stringifyInline(value.default)}`
    }
  }

  return ''
}

function inferUserScenarioHints(endpoint: ParsedEndpoint) {
  const hints: string[] = []
  const method = endpoint.method.toUpperCase()

  if (method === 'GET' && endpoint.path.includes('{')) {
    hints.push(
      'Fetch a single existing record for detail screens, audits, or follow-up workflows.',
    )
  } else if (method === 'GET') {
    hints.push(
      'Load a list or filtered collection for dashboards, selectors, or sync jobs.',
    )
  } else if (method === 'POST') {
    hints.push(
      'Create a new resource from a user form submission or an automation workflow.',
    )
  } else if (method === 'PUT' || method === 'PATCH') {
    hints.push(
      'Update an existing resource from a settings screen or a multi-step operational flow.',
    )
  } else if (method === 'DELETE') {
    hints.push(
      'Remove or archive a resource as part of cleanup, moderation, or admin maintenance.',
    )
  }

  if (endpoint.parameters.some((param) => param.in === 'query')) {
    hints.push(
      'Apply query parameters to drive filtering, sorting, pagination, or incremental sync behavior.',
    )
  }

  if (endpoint.tags.some((tag) => /admin|settings|management/i.test(tag))) {
    hints.push(
      'Support internal back-office operations where access control and auditability matter.',
    )
  }

  if (hints.length === 0) {
    hints.push(
      'Use this endpoint as part of a broader application workflow that needs the underlying resource metadata.',
    )
  }

  return hints.slice(0, 3)
}

function inferRiskHints(endpoint: ParsedEndpoint) {
  const hints: string[] = []
  const method = endpoint.method.toUpperCase()
  const responseCodes = Object.keys(endpoint.responses)

  if (Array.isArray(endpoint.security) && endpoint.security.length > 0) {
    hints.push(
      'Authentication or authorization failures can block the request, so token scope and credential placement must match the declared scheme.',
    )
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    hints.push(
      'This endpoint changes server state, so callers should consider retries, duplicate submissions, and idempotency expectations.',
    )
  }

  if (endpoint.requestBody) {
    hints.push(
      'Schema drift in request fields can break clients, so validate payload shape before rollout and monitor required fields closely.',
    )
  }

  if (responseCodes.includes('401') || responseCodes.includes('403')) {
    hints.push(
      'Permission and token handling should fail gracefully so clients can distinguish authentication issues from business validation errors.',
    )
  }

  if (responseCodes.includes('409')) {
    hints.push(
      'Conflict responses usually indicate concurrent edits or business-rule collisions and may require retry or user resolution flows.',
    )
  }

  if (responseCodes.includes('429')) {
    hints.push(
      'Rate limiting can affect bulk or background jobs, so implement backoff, jitter, and visibility into throttling behavior.',
    )
  }

  if (endpoint.deprecated) {
    hints.push(
      'The endpoint is marked deprecated, so new integrations should plan a migration path and avoid depending on long-term stability.',
    )
  }

  if (hints.length === 0) {
    hints.push(
      'No special risks are declared in the OpenAPI metadata beyond standard validation, auth, and network error handling.',
    )
  }

  return hints.slice(0, 5)
}

function isAuthParameter(param: Record<string, unknown>) {
  const name = String(param.name ?? '').toLowerCase()
  return ['authorization', 'x-api-key', 'api-key', 'x-auth-token'].includes(name)
}

function isSuccessStatusCode(code: string) {
  return /^2\d\d$/.test(code)
}

function stringifyInline(value: unknown) {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  return truncateJson(value, 240)
}

function truncateJson(value: unknown, maxLength: number) {
  const json = JSON.stringify(value, null, 2) ?? ''
  if (json.length <= maxLength) return json
  return `${json.slice(0, maxLength)}\n// ... truncated`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function buildOpenApiDocumentUserPrompt(input: {
  sourceName: string
  endpoints: ParsedEndpoint[]
  apiTitle?: string
  apiVersion?: string | null
  servers?: ParsedServer[]
  securitySchemes?: Record<string, ParsedSecurityScheme>
  userPrompt?: string
  documentType?: OpenApiDocumentType | null
  template?: OpenApiDocumentTemplateContext | null
  retrievedContext?: OpenApiDocumentRetrievedContext | null
}) {
  const typeMeta = getOpenApiDocumentTypeMeta(input.documentType)
  const lines: string[] = []

  lines.push(
    `Create a single coherent ${typeMeta?.label.toLowerCase() ?? 'OpenAPI document'}${input.apiTitle ? ` for the "${input.apiTitle}" API` : ''}.`,
  )
  lines.push('')
  lines.push('Requirements:')
  lines.push('- Write production-ready Markdown with no top-level H1 heading.')
  lines.push('- Synthesize all selected endpoints into one document instead of generating isolated mini-docs.')
  lines.push('- Ground every claim in the provided metadata and template. If details are missing, say so explicitly.')
  lines.push('- Keep the writing practical, specific, and useful to engineers or technical operators.')

  if (typeMeta) {
    lines.push(
      `- Target document type: ${typeMeta.label}. ${typeMeta.description}`,
    )
    for (const instruction of typeMeta.aiInstructions) {
      lines.push(`- ${instruction}`)
    }
  } else {
    lines.push(
      '- Choose a structure that best matches the user prompt, template, and selected endpoint set.',
    )
  }

  if (input.userPrompt?.trim()) {
    lines.push('- Follow the custom user prompt when it does not conflict with the grounded metadata.')
    lines.push('')
    lines.push('<custom_prompt>')
    lines.push(input.userPrompt.trim())
    lines.push('</custom_prompt>')
  }

  if (input.template) {
    lines.push('')
    lines.push('<template_guidance>')
    lines.push(`Template Name: ${input.template.name}`)
    if (input.template.category) {
      lines.push(
        `Template Category: ${getTemplateCategoryLabel(input.template.category)}`,
      )
    }
    if (input.template.description?.trim()) {
      lines.push(`Template Description: ${input.template.description.trim()}`)
    }
    if (input.template.content.trim()) {
      lines.push(
        `Template Content:\n${truncateText(input.template.content.trim(), MAX_TEMPLATE_CONTENT_LENGTH)}`,
      )
    }
    lines.push('</template_guidance>')
  }

  if (input.retrievedContext?.contextText.trim()) {
    lines.push('')
    lines.push(
      '- Use the supplemental context below as a secondary grounding source when it adds operational, architectural, or policy detail that the OpenAPI metadata does not contain.',
    )
    lines.push(
      '- If supplemental context conflicts with explicit OpenAPI metadata, prefer the OpenAPI metadata and call out the discrepancy instead of blending both as facts.',
    )
    lines.push('')
    lines.push('<supplemental_context>')
    lines.push(input.retrievedContext.contextText.trim())
    lines.push('</supplemental_context>')
  }

  lines.push('')
  lines.push('<selected_endpoints>')

  if (input.endpoints.length === 0) {
    lines.push('No endpoints selected.')
  } else {
    for (const [index, endpoint] of input.endpoints.entries()) {
      lines.push(`### Endpoint ${index + 1}`)
      lines.push(
        formatEndpointContext(endpoint, {
          apiTitle: input.apiTitle,
          apiVersion: input.apiVersion,
          servers: input.servers,
          securitySchemes: input.securitySchemes,
          schemaJsonMaxLength: 1_200,
        }),
      )
      if (index < input.endpoints.length - 1) {
        lines.push('')
      }
    }
  }

  lines.push('</selected_endpoints>')
  lines.push('')
  lines.push(
    `Source Name: ${input.sourceName}${input.apiVersion ? ` (version ${input.apiVersion})` : ''}`,
  )

  return lines.join('\n')
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength).trimEnd()}\n…`
}

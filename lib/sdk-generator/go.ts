import {
  extractOperations,
  toGoType,
  toPascalCase,
  type OperationInfo,
} from './shared'

function generateStructs(spec: Record<string, unknown>): string {
  const components = spec.components as Record<string, unknown> | undefined
  const schemas = (components?.schemas || {}) as Record<string, Record<string, unknown>>
  const lines: string[] = ['package sdk', '', 'import "time"', '', '// Suppress unused import warning', 'var _ = time.Now', '']

  for (const [name, schema] of Object.entries(schemas)) {
    const structName = toPascalCase(name)

    if (schema.enum) {
      lines.push(`type ${structName} string`)
      lines.push('')
      lines.push('const (')
      for (const v of schema.enum as string[]) {
        const constName = `${structName}${toPascalCase(v)}`
        lines.push(`\t${constName} ${structName} = "${v}"`)
      }
      lines.push(')')
      lines.push('')
      continue
    }

    if (schema.type === 'object' || schema.properties) {
      const props = (schema.properties || {}) as Record<string, Record<string, unknown>>
      const required = new Set((schema.required || []) as string[])
      if (schema.description) lines.push(`// ${structName} ${schema.description}`)
      lines.push(`type ${structName} struct {`)
      for (const [propName, propSchema] of Object.entries(props)) {
        const goName = toPascalCase(propName)
        let goType = toGoType(propSchema)
        if (!required.has(propName) && !goType.startsWith('[]') && !goType.startsWith('map')) {
          goType = `*${goType}`
        }
        const jsonTag = `\`json:"${propName},omitempty"\``
        lines.push(`\t${goName} ${goType} ${jsonTag}`)
      }
      lines.push('}')
      lines.push('')
    }
  }

  return lines.join('\n')
}

function buildPathFormat(path: string, params: { name: string }[]): { format: string; args: string[] } {
  let format = path
  const args: string[] = []
  for (const p of params) {
    format = format.replace(`{${p.name}}`, '%v')
    args.push(toCamelCaseGo(p.name))
  }
  return { format, args }
}

function toCamelCaseGo(s: string): string {
  const parts = s.split(/[^a-zA-Z0-9]/).filter(Boolean)
  return parts.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

function generateEndpointMethods(operations: OperationInfo[]): string {
  const lines: string[] = []

  for (const op of operations) {
    const methodName = toPascalCase(op.operationId)
    const pathParams = op.parameters.filter((p) => p.in === 'path')
    const queryParams = op.parameters.filter((p) => p.in === 'query')
    const returnType = op.responseSchema ? toGoType(op.responseSchema) : ''
    const hasReturn = returnType && returnType !== 'interface{}'

    const funcArgs: string[] = []
    for (const p of pathParams) {
      funcArgs.push(`${toCamelCaseGo(p.name)} ${toGoType(p.schema)}`)
    }
    if (op.requestBody) {
      funcArgs.push(`body ${toGoType(op.requestBody.schema)}`)
    }
    for (const q of queryParams) {
      funcArgs.push(`${toCamelCaseGo(q.name)} ${toGoType(q.schema)}`)
    }

    const returnSig = hasReturn ? `(*${returnType === 'string' || returnType === 'int' || returnType === 'bool' || returnType === 'float64' ? returnType : returnType}, error)` : 'error'

    if (op.summary) lines.push(`// ${methodName} ${op.summary}`)
    lines.push(`func (c *Client) ${methodName}(${funcArgs.join(', ')}) ${returnSig} {`)

    // Build path
    const { format: pathFmt, args: pathArgs } = buildPathFormat(op.path, pathParams)
    if (pathParams.length > 0) {
      lines.push(`\tpath := fmt.Sprintf("${pathFmt}", ${pathArgs.join(', ')})`)
    } else {
      lines.push(`\tpath := "${op.path}"`)
    }

    // Build query string
    if (queryParams.length > 0) {
      lines.push('\tquery := url.Values{}')
      for (const q of queryParams) {
        const varName = toCamelCaseGo(q.name)
        lines.push(`\tif ${varName} != "" {`)
        lines.push(`\t\tquery.Set("${q.name}", fmt.Sprint(${varName}))`)
        lines.push('\t}')
      }
      lines.push('\tif qs := query.Encode(); qs != "" {')
      lines.push('\t\tpath += "?" + qs')
      lines.push('\t}')
    }

    const httpMethod = `"${op.method}"`
    if (op.requestBody) {
      lines.push('\tvar bodyReader io.Reader')
      lines.push('\tjsonBody, err := json.Marshal(body)')
      lines.push('\tif err != nil {')
      lines.push(hasReturn ? '\t\treturn nil, err' : '\t\treturn err')
      lines.push('\t}')
      lines.push('\tbodyReader = bytes.NewReader(jsonBody)')
      if (hasReturn) {
        lines.push(`\tvar result ${returnType}`)
        lines.push(`\terr = c.do(${httpMethod}, path, bodyReader, &result)`)
        lines.push('\treturn &result, err')
      } else {
        lines.push(`\treturn c.do(${httpMethod}, path, bodyReader, nil)`)
      }
    } else {
      if (hasReturn) {
        lines.push(`\tvar result ${returnType}`)
        lines.push(`\terr := c.do(${httpMethod}, path, nil, &result)`)
        lines.push('\treturn &result, err')
      } else {
        lines.push(`\treturn c.do(${httpMethod}, path, nil, nil)`)
      }
    }

    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}

export function generateGoSdk(spec: Record<string, unknown>, packageName: string, version: string): Map<string, string> {
  const files = new Map<string, string>()
  const operations = extractOperations(spec)
  const moduleName = `github.com/user/${packageName}`

  // types.go
  files.set('types.go', generateStructs(spec))

  // client.go
  files.set('client.go', `package sdk

import (
\t"bytes"
\t"encoding/json"
\t"fmt"
\t"io"
\t"net/http"
\t"net/url"
)

// Suppress unused imports
var (
\t_ = bytes.NewReader
\t_ = fmt.Sprintf
\t_ = url.Values{}
)

type Client struct {
\tBaseURL    string
\tAPIKey     string
\tHTTPClient *http.Client
}

func NewClient(baseURL string, apiKey string) *Client {
\treturn &Client{
\t\tBaseURL:    baseURL,
\t\tAPIKey:     apiKey,
\t\tHTTPClient: &http.Client{},
\t}
}

type APIError struct {
\tStatusCode int
\tMessage    string
\tBody       string
}

func (e *APIError) Error() string {
\treturn fmt.Sprintf("API Error %d: %s", e.StatusCode, e.Message)
}

func (c *Client) do(method, path string, body io.Reader, result interface{}) error {
\treq, err := http.NewRequest(method, c.BaseURL+path, body)
\tif err != nil {
\t\treturn err
\t}

\treq.Header.Set("Content-Type", "application/json")
\tif c.APIKey != "" {
\t\treq.Header.Set("Authorization", "Bearer "+c.APIKey)
\t}

\tresp, err := c.HTTPClient.Do(req)
\tif err != nil {
\t\treturn err
\t}
\tdefer resp.Body.Close()

\tif resp.StatusCode >= 400 {
\t\trespBody, _ := io.ReadAll(resp.Body)
\t\treturn &APIError{
\t\t\tStatusCode: resp.StatusCode,
\t\t\tMessage:    resp.Status,
\t\t\tBody:       string(respBody),
\t\t}
\t}

\tif result != nil && resp.StatusCode != 204 {
\t\treturn json.NewDecoder(resp.Body).Decode(result)
\t}
\treturn nil
}
`)

  // endpoints.go
  files.set('endpoints.go', `package sdk

import (
\t"bytes"
\t"encoding/json"
\t"fmt"
\t"io"
\t"net/url"
)

// Suppress unused imports
var (
\t_ = bytes.NewReader
\t_ = json.Marshal
\t_ = fmt.Sprintf
\t_ = io.NopCloser
\t_ = url.Values{}
)

${generateEndpointMethods(operations)}`)

  // go.mod
  files.set('go.mod', `module ${moduleName}

go 1.21
`)

  // README.md
  const firstOp = operations[0]
  const exampleMethod = firstOp ? toPascalCase(firstOp.operationId) : 'ListItems'

  files.set('README.md', `# ${packageName}

Go SDK for ${(spec.info as Record<string, unknown>)?.title || 'the API'} (v${version}).

## Installation

\`\`\`bash
go get ${moduleName}
\`\`\`

## Usage

\`\`\`go
package main

import (
\t"fmt"
\t"log"

\tsdk "${moduleName}"
)

func main() {
\tclient := sdk.NewClient(
\t\t"${((spec.servers as Record<string, unknown>[] | undefined)?.[0] as Record<string, unknown> | undefined)?.url || 'https://api.example.com'}",
\t\t"your-api-key",
\t)

\tresult, err := client.${exampleMethod}()
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\tfmt.Printf("%+v\\n", result)
}
\`\`\`

## Error Handling

\`\`\`go
result, err := client.${exampleMethod}()
if err != nil {
\tif apiErr, ok := err.(*sdk.APIError); ok {
\t\tfmt.Printf("Status: %d, Body: %s\\n", apiErr.StatusCode, apiErr.Body)
\t}
}
\`\`\`
`)

  return files
}

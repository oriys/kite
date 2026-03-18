'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  generateCodeSnippet,
  CODE_TARGETS,
  type RequestConfig,
} from '@/lib/code-generation'
import { Loader2, Play, Copy, Check, Plus, X } from 'lucide-react'

interface Parameter {
  name: string
  in: string
  required?: boolean
  description?: string
  schema?: { type?: string; default?: unknown }
}

interface EndpointTryItProps {
  method: string
  path: string
  parameters: Record<string, unknown>[]
  requestBody: Record<string, unknown> | null
}

const BASE_URL_KEY = 'kite:openapi:try-it:base-url'

export function EndpointTryIt({
  method,
  path,
  parameters,
  requestBody,
}: EndpointTryItProps) {
  const [baseUrl, setBaseUrl] = useState('')
  const [pathParams, setPathParams] = useState<Record<string, string>>({})
  const [queryParams, setQueryParams] = useState<Record<string, string>>({})
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([
    { key: 'Content-Type', value: 'application/json' },
  ])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    duration: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [codeTab, setCodeTab] = useState('curl')
  const [codeSnippets, setCodeSnippets] = useState<Record<string, string>>({})
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [copiedResponse, setCopiedResponse] = useState(false)
  const [activeTab, setActiveTab] = useState<'params' | 'response' | 'code'>('params')

  const typedParams = parameters as unknown as Parameter[]
  const pathParamNames = path.match(/\{(\w+)\}/g)?.map((m) => m.slice(1, -1)) ?? []
  const queryParamDefs = typedParams.filter((p) => p.in === 'query')
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())

  // Load base URL from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(BASE_URL_KEY)
    if (stored) setBaseUrl(stored)
  }, [])

  // Persist base URL
  const baseUrlRef = useRef(baseUrl)
  baseUrlRef.current = baseUrl
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (baseUrlRef.current) {
        localStorage.setItem(BASE_URL_KEY, baseUrlRef.current)
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [baseUrl])

  // Initialize body with schema example
  useEffect(() => {
    if (hasBody && requestBody && !body) {
      const content = requestBody.content as Record<string, unknown> | undefined
      if (content) {
        const jsonContent = content['application/json'] as Record<string, unknown> | undefined
        if (jsonContent?.schema) {
          const schema = jsonContent.schema as Record<string, unknown>
          const example = generateExampleFromSchema(schema)
          if (example !== undefined) {
            setBody(JSON.stringify(example, null, 2))
          }
        }
      }
    }
  }, [hasBody, requestBody]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildUrl = useCallback(() => {
    let resolvedPath = path
    for (const name of pathParamNames) {
      resolvedPath = resolvedPath.replace(`{${name}}`, encodeURIComponent(pathParams[name] || `{${name}}`))
    }
    const base = baseUrl.replace(/\/$/, '')
    const url = new URL(resolvedPath, base || 'https://example.com')
    for (const [key, value] of Object.entries(queryParams)) {
      if (value) url.searchParams.set(key, value)
    }
    return url.toString()
  }, [baseUrl, path, pathParams, pathParamNames, queryParams])

  const buildRequestConfig = useCallback((): RequestConfig => ({
    method: method.toUpperCase(),
    url: buildUrl(),
    headers: headers.filter((h) => h.key && h.value),
    body: hasBody ? body : undefined,
  }), [method, buildUrl, headers, hasBody, body])

  // Generate code snippets when config changes
  useEffect(() => {
    const config = buildRequestConfig()
    const generateAll = async () => {
      const snippets: Record<string, string> = {}
      for (const target of CODE_TARGETS) {
        snippets[target.id] = await generateCodeSnippet(config, target)
      }
      setCodeSnippets(snippets)
    }
    generateAll()
  }, [buildRequestConfig])

  const sendRequest = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)
    setActiveTab('response')

    try {
      const config = buildRequestConfig()
      const res = await fetch('/api/openapi/try-it', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: config.method,
          url: config.url,
          headers: Object.fromEntries(config.headers.map((h) => [h.key, h.value])),
          body: config.body,
        }),
      })

      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResponse(data)
      }
    } catch {
      setError('Failed to send request')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, type: 'snippet' | 'response') => {
    await navigator.clipboard.writeText(text)
    if (type === 'snippet') {
      setCopiedSnippet(true)
      setTimeout(() => setCopiedSnippet(false), 2000)
    } else {
      setCopiedResponse(true)
      setTimeout(() => setCopiedResponse(false), 2000)
    }
  }

  const formatResponseBody = (body: string) => {
    try {
      return JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      return body
    }
  }

  return (
    <div className="mt-3 space-y-4 rounded-md border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Try It
        </span>
      </div>

      {/* Base URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Base URL</label>
        <Input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com"
          className="h-8 font-mono text-sm"
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'params' | 'response' | 'code')}>
        <div className="flex items-center justify-between gap-2">
          <TabsList className="h-8">
            <TabsTrigger value="params" className="text-xs">
              Parameters
            </TabsTrigger>
            <TabsTrigger value="response" className="text-xs">
              Response
              {response && (
                <StatusDot status={response.status} />
              )}
            </TabsTrigger>
            <TabsTrigger value="code" className="text-xs">
              Code
            </TabsTrigger>
          </TabsList>

          <Button
            size="sm"
            onClick={sendRequest}
            disabled={loading || !baseUrl}
            className="h-8 gap-1.5"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Send
          </Button>
        </div>

        {/* Parameters Tab */}
        <TabsContent value="params" className="space-y-4">
          {/* Path Parameters */}
          {pathParamNames.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground">Path Parameters</h5>
              {pathParamNames.map((name) => {
                const def = typedParams.find((p) => p.name === name && p.in === 'path')
                return (
                  <div key={name} className="flex items-center gap-2">
                    <label className="min-w-[120px] font-mono text-xs">
                      {name}
                      {def?.required && <span className="text-tone-caution-text">*</span>}
                    </label>
                    <Input
                      value={pathParams[name] || ''}
                      onChange={(e) => setPathParams((prev) => ({ ...prev, [name]: e.target.value }))}
                      placeholder={def?.schema?.type || 'string'}
                      className="h-7 flex-1 font-mono text-xs"
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Query Parameters */}
          {queryParamDefs.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground">Query Parameters</h5>
              {queryParamDefs.map((param) => (
                <div key={param.name} className="flex items-center gap-2">
                  <label className="min-w-[120px] font-mono text-xs">
                    {param.name}
                    {param.required && <span className="text-tone-caution-text">*</span>}
                  </label>
                  <Input
                    value={queryParams[param.name] || ''}
                    onChange={(e) => setQueryParams((prev) => ({ ...prev, [param.name]: e.target.value }))}
                    placeholder={param.schema?.type || 'string'}
                    className="h-7 flex-1 font-mono text-xs"
                  />
                  {param.description && (
                    <span className="hidden text-xs text-muted-foreground lg:inline">
                      {param.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Headers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-medium text-muted-foreground">Headers</h5>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => setHeaders((prev) => [...prev, { key: '', value: '' }])}
              >
                <Plus className="size-3" />
                Add
              </Button>
            </div>
            {headers.map((header, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={header.key}
                  onChange={(e) => {
                    const next = [...headers]
                    next[i] = { ...next[i], key: e.target.value }
                    setHeaders(next)
                  }}
                  placeholder="Header name"
                  className="h-7 flex-1 font-mono text-xs"
                />
                <Input
                  value={header.value}
                  onChange={(e) => {
                    const next = [...headers]
                    next[i] = { ...next[i], value: e.target.value }
                    setHeaders(next)
                  }}
                  placeholder="Value"
                  className="h-7 flex-1 font-mono text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setHeaders((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>

          {/* Request Body */}
          {hasBody && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground">Request Body</h5>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"key": "value"}'
                className="min-h-[120px] font-mono text-xs"
              />
            </div>
          )}
        </TabsContent>

        {/* Response Tab */}
        <TabsContent value="response">
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Sending request...
            </div>
          )}

          {error && (
            <div className="rounded-md border border-tone-error-border bg-tone-error-bg p-3 text-sm text-tone-error-text">
              {error}
            </div>
          )}

          {response && (
            <div className="space-y-3">
              {/* Status line */}
              <div className="flex items-center gap-3">
                <ResponseStatusBadge status={response.status} />
                <span className="text-xs text-muted-foreground">{response.statusText}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {response.duration}ms
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 gap-1 px-2 text-xs"
                  onClick={() => copyToClipboard(formatResponseBody(response.body), 'response')}
                >
                  {copiedResponse ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copiedResponse ? 'Copied' : 'Copy'}
                </Button>
              </div>

              {/* Response headers */}
              {Object.keys(response.headers).length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                    Response Headers ({Object.keys(response.headers).length})
                  </summary>
                  <div className="mt-1 rounded-md bg-muted/50 p-2">
                    {Object.entries(response.headers).map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-xs">
                        <span className="font-mono font-medium text-foreground">{key}:</span>
                        <span className="font-mono text-muted-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Response body */}
              <pre className="max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                {formatResponseBody(response.body)}
              </pre>
            </div>
          )}

          {!loading && !error && !response && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Send a request to see the response here.
            </div>
          )}
        </TabsContent>

        {/* Code Tab */}
        <TabsContent value="code">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {CODE_TARGETS.map((target) => (
                <button
                  key={target.id}
                  onClick={() => setCodeTab(target.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    codeTab === target.id
                      ? 'bg-foreground/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {target.label}
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 gap-1 px-2 text-xs"
                onClick={() => copyToClipboard(codeSnippets[codeTab] || '', 'snippet')}
              >
                {copiedSnippet ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copiedSnippet ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
              {codeSnippets[codeTab] || 'Generating...'}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatusDot({ status }: { status: number }) {
  return (
    <span
      className={cn(
        'ml-1 inline-block size-1.5 rounded-full',
        status >= 200 && status < 300
          ? 'bg-tone-success-text'
          : status >= 400
            ? 'bg-tone-error-text'
            : 'bg-tone-caution-text',
      )}
    />
  )
}

function ResponseStatusBadge({ status }: { status: number }) {
  let color = 'bg-muted text-muted-foreground'
  if (status >= 200 && status < 300) color = 'bg-tone-success-bg text-tone-success-text'
  else if (status >= 300 && status < 400) color = 'bg-tone-info-bg text-tone-info-text'
  else if (status >= 400 && status < 500) color = 'bg-tone-caution-bg text-tone-caution-text'
  else if (status >= 500) color = 'bg-tone-error-bg text-tone-error-text'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-bold tabular-nums',
        color,
      )}
    >
      {status}
    </span>
  )
}

function generateExampleFromSchema(schema: Record<string, unknown>): unknown {
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0]

  const allOf = schema.allOf as Record<string, unknown>[] | undefined
  if (Array.isArray(allOf) && allOf.length > 0) {
    return allOf.reduce<unknown>((merged, subSchema) => {
      const nextExample = generateExampleFromSchema(subSchema)
      if (isRecord(merged) && isRecord(nextExample)) {
        return { ...merged, ...nextExample }
      }

      return nextExample ?? merged
    }, {})
  }

  const variants =
    (schema.oneOf as Record<string, unknown>[] | undefined) ??
    (schema.anyOf as Record<string, unknown>[] | undefined)
  if (Array.isArray(variants) && variants.length > 0) {
    return generateExampleFromSchema(variants[0])
  }

  const properties = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined
  if (properties) {
    const obj: Record<string, unknown> = {}
    for (const [key, propSchema] of Object.entries(properties)) {
      obj[key] = generateExampleFromSchema(propSchema)
    }
    return obj
  }

  const items = schema.items as Record<string, unknown> | undefined
  if (items) {
    return [generateExampleFromSchema(items)]
  }

  const type = schema.type as string | undefined
  switch (type) {
    case 'string':
      return 'string'
    case 'number':
    case 'integer':
      return 0
    case 'boolean':
      return true
    case 'array': {
      if (items) return [generateExampleFromSchema(items)]
      return []
    }
    case 'object':
      return {}
    default:
      return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

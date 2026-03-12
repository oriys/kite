'use client'

import * as React from 'react'
import {
  Play,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  Code,
  ChevronDown,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { CodeSnippetTabs } from '@/components/code-snippet-tabs'
import {
  HttpRequest,
  type HttpMethod,
} from '@/components/ui/http-request'

interface ApiPlaygroundProps extends React.ComponentProps<'div'> {
  initialMethod?: HttpMethod
  initialUrl?: string
  initialBody?: string
}

type KeyValue = { id: string; key: string; value: string; enabled: boolean }

export function ApiPlayground({
  initialMethod = 'GET',
  initialUrl = 'https://api.example.com/v1/users',
  initialBody = '',
  className,
  ...props
}: ApiPlaygroundProps) {
  const [method, setMethod] = React.useState<HttpMethod>(initialMethod)
  const [url, setUrl] = React.useState(initialUrl)
  const [loading, setLoading] = React.useState(false)
  const [params, setParams] = React.useState<KeyValue[]>([
    { id: '1', key: '', value: '', enabled: true },
  ])
  const [headers, setHeaders] = React.useState<KeyValue[]>([
    { id: '1', key: 'Accept', value: 'application/json', enabled: true },
  ])
  const [body, setBody] = React.useState(initialBody)
  const [response, setResponse] = React.useState<{
    status: number
    statusText: string
    data: unknown
    headers: Record<string, string>
    time: number
    size: string
  } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [showCode, setShowCode] = React.useState(false)

  const handleSend = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)
    const startTime = performance.now()

    try {
      // Construct URL with params
      const urlObj = new URL(url)
      params.forEach((p) => {
        if (p.enabled && p.key) {
          urlObj.searchParams.append(p.key, p.value)
        }
      })

      // Construct headers
      const headersObj: Record<string, string> = {}
      headers.forEach((h) => {
        if (h.enabled && h.key) {
          headersObj[h.key] = h.value
        }
      })

      const options: RequestInit = {
        method,
        headers: headersObj,
      }

      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        options.body = body
      }

      const res = await fetch(urlObj.toString(), options)
      const endTime = performance.now()

      const resData = await res.text()
      let parsedData: unknown = resData
      try {
        parsedData = JSON.parse(resData)
      } catch {
        // Not JSON
      }

      const resHeaders: Record<string, string> = {}
      res.headers.forEach((val, key) => {
        resHeaders[key] = val
      })

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data: parsedData,
        headers: resHeaders,
        time: Math.round(endTime - startTime),
        size: (resData.length / 1024).toFixed(2) + ' KB',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const isCors = message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('CORS')
      setError(isCors ? `${message} — Most APIs block browser requests due to CORS. Use a server-side proxy or test from a terminal.` : message)
    } finally {
      setLoading(false)
    }
  }

  const addKeyValue = (
    list: KeyValue[],
    setList: React.Dispatch<React.SetStateAction<KeyValue[]>>,
  ) => {
    setList([
      ...list,
      { id: Math.random().toString(36).substr(2, 9), key: '', value: '', enabled: true },
    ])
  }

  const removeKeyValue = (
    id: string,
    list: KeyValue[],
    setList: React.Dispatch<React.SetStateAction<KeyValue[]>>,
  ) => {
    setList(list.filter((item) => item.id !== id))
  }

  const updateKeyValue = (
    id: string,
    field: 'key' | 'value' | 'enabled',
    value: string | boolean,
    list: KeyValue[],
    setList: React.Dispatch<React.SetStateAction<KeyValue[]>>,
  ) => {
    setList(
      list.map((item) => {
        if (item.id !== id) return item

        switch (field) {
          case 'key':
            return { ...item, key: typeof value === 'string' ? value : item.key }
          case 'value':
            return {
              ...item,
              value: typeof value === 'string' ? value : item.value,
            }
          case 'enabled':
            return {
              ...item,
              enabled: typeof value === 'boolean' ? value : item.enabled,
            }
        }
      }),
    )
  }

  return (
    <HttpRequest className={cn('flex flex-col', className)} {...props}>
      {/* Request Bar */}
      <div className="flex flex-col gap-3 border-b border-border/75 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <Select
            value={method}
            onValueChange={(v) => setMethod(v as HttpMethod)}
          >
            <SelectTrigger className="w-[110px] shrink-0 font-medium" aria-label="HTTP method">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                <SelectItem key={m} value={m}>
                   {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 font-mono text-[13px]"
            placeholder="https://api.example.com/..."
            aria-label="Request URL"
          />
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button onClick={handleSend} disabled={loading} className="flex-1 sm:flex-initial">
            {loading ? (
              <Loader2 className="mr-2 size-4 motion-safe:animate-spin" />
            ) : (
              <Play className="mr-2 size-4" />
            )}
            Send
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCode((prev) => !prev)}
            className={cn(
              'flex-1 sm:flex-initial',
              showCode && 'bg-accent text-accent-foreground',
            )}
          >
            <Code className="mr-2 size-4" />
            Code
            <ChevronDown
              className={cn(
                'ml-1 size-3 transition-transform',
                showCode && 'rotate-180',
              )}
            />
          </Button>
        </div>
      </div>

      {/* Request Details Tabs */}
      <div className="border-b border-border/75 bg-background/50">
        <Tabs defaultValue="params" className="w-full">
          <div className="px-4 py-2">
            <TabsList className="h-9 w-full justify-start bg-transparent p-0 sm:w-auto">
              <TabsTrigger
                value="params"
                className="data-[state=active]:bg-background/80"
              >
                Params
              </TabsTrigger>
              <TabsTrigger
                value="headers"
                className="data-[state=active]:bg-background/80"
              >
                Headers
              </TabsTrigger>
              <TabsTrigger
                value="body"
                className="data-[state=active]:bg-background/80"
              >
                Body
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="bg-background/80 p-4">
            <TabsContent value="params" className="mt-0 space-y-2">
              {params.map((param, index) => (
                <div key={param.id} className="flex gap-2">
                  <Input
                    placeholder="Key"
                    aria-label={`Parameter ${index + 1} key`}
                    value={param.key}
                    onChange={(e) =>
                      updateKeyValue(param.id, 'key', e.target.value, params, setParams)
                    }
                    className="flex-1"
                  />
                  <Input
                    placeholder="Value"
                    aria-label={`Parameter ${index + 1} value`}
                    value={param.value}
                    onChange={(e) =>
                      updateKeyValue(param.id, 'value', e.target.value, params, setParams)
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove parameter ${index + 1}`}
                    onClick={() => removeKeyValue(param.id, params, setParams)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addKeyValue(params, setParams)}
                className="mt-2"
              >
                <Plus className="mr-2 size-3" /> Add Param
              </Button>
            </TabsContent>

            <TabsContent value="headers" className="mt-0 space-y-2">
              {headers.map((header, index) => (
                <div key={header.id} className="flex gap-2">
                  <Input
                    placeholder="Key"
                    aria-label={`Header ${index + 1} key`}
                    value={header.key}
                    onChange={(e) =>
                      updateKeyValue(
                        header.id,
                        'key',
                        e.target.value,
                        headers,
                        setHeaders,
                      )
                    }
                    className="flex-1"
                  />
                  <Input
                    placeholder="Value"
                    aria-label={`Header ${index + 1} value`}
                    value={header.value}
                    onChange={(e) =>
                      updateKeyValue(
                        header.id,
                        'value',
                        e.target.value,
                        headers,
                        setHeaders,
                      )
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove header ${index + 1}`}
                    onClick={() => removeKeyValue(header.id, headers, setHeaders)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addKeyValue(headers, setHeaders)}
                className="mt-2"
              >
                <Plus className="mr-2 size-3" /> Add Header
              </Button>
            </TabsContent>

            <TabsContent value="body" className="mt-0">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"key": "value"}'
                aria-label="Request body"
                className="min-h-[200px] font-mono text-sm"
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Response Area */}
      {(response || error) && (
        <div className="bg-background/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Response</h3>
            {response && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {response.time}ms
                </span>
                <span className="flex items-center gap-1">
                  <ArrowRightLeft className="size-3" /> {response.size}
                </span>
              </div>
            )}
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {error}
            </div>
          ) : (
            response && (
              <div className="overflow-hidden rounded-md border border-border/80">
                <div className="flex items-center gap-2 border-b border-border/80 bg-muted/40 px-3 py-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      response.status >= 200 && response.status < 300
                        ? 'border-tone-success-border bg-tone-success-bg text-tone-success-text'
                        : 'border-tone-error-border bg-tone-error-bg text-tone-error-text',
                    )}
                  >
                    {response.status} {response.statusText}
                  </Badge>
                  <span className="text-xs text-muted-foreground">JSON</span>
                </div>
                <div className="max-h-[400px] overflow-auto bg-card p-4">
                  <CodeBlock
                    code={JSON.stringify(response.data, null, 2)}
                    language="json"
                  />
                </div>
              </div>
            )
          )}
        </div>
      )}
      {/* Code Snippets Panel */}
      {showCode && (
        <div className="border-t border-border/75 bg-background/80 p-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Generated Code</h3>
          <CodeSnippetTabs
            config={{
              method,
              url: (() => {
                try {
                  const urlObj = new URL(url)
                  params.forEach((p) => {
                    if (p.enabled && p.key) {
                      urlObj.searchParams.append(p.key, p.value)
                    }
                  })
                  return urlObj.toString()
                } catch {
                  return url
                }
              })(),
              headers: headers
                .filter((h) => h.enabled && h.key && h.value)
                .map((h) => ({ key: h.key, value: h.value })),
              body: body || undefined,
            }}
          />
        </div>
      )}
    </HttpRequest>
  )
}

'use client'

import * as React from 'react'
import { Check, ChevronRight, ChevronDown, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

type JsonCollection = Record<string, unknown> | unknown[]

interface JsonViewerProps {
  data: unknown
  className?: string
  initialExpanded?: boolean
  maxHeight?: string | number
}

export function JsonViewer({
  data,
  className,
  initialExpanded = false,
  maxHeight = '400px',
}: JsonViewerProps) {
  const [copied, setCopied] = React.useState(false)
  const viewerHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        'relative min-w-0 overflow-hidden rounded-md border bg-muted/30 font-mono text-xs',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
        <span className="text-muted-foreground">JSON</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          aria-label={copied ? 'Copied JSON' : 'Copy JSON'}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <ScrollArea className="w-full" style={{ height: viewerHeight }}>
        <div className="p-4">
          <JsonNode
            keyName="root"
            value={data}
            isLast={true}
            initialExpanded={initialExpanded}
          />
        </div>
      </ScrollArea>
    </div>
  )
}

interface JsonNodeProps {
  keyName: string
  value: unknown
  isLast: boolean
  initialExpanded: boolean
  level?: number
}

function isJsonCollection(value: unknown): value is JsonCollection {
  return typeof value === 'object' && value !== null
}

function JsonNode({
  keyName,
  value,
  isLast,
  initialExpanded,
  level = 0,
}: JsonNodeProps) {
  const [expanded, setExpanded] = React.useState(initialExpanded || level < 1)

  const isObject = isJsonCollection(value)
  const isArray = Array.isArray(value)
  const entries = isObject ? Object.entries(value) : []
  const isEmpty = isObject && entries.length === 0

  if (!isObject) {
    return (
      <div className="flex min-w-0 items-start rounded-sm px-1 hover:bg-muted/50">
        <span className="mr-2 text-blue-600 dark:text-blue-400">
          &quot;{keyName}&quot;:
        </span>
        <JsonPrimitive value={value} />
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="flex min-w-0 items-center rounded-sm px-1 hover:bg-muted/50">
        <span className="mr-2 text-purple-600 dark:text-purple-400">
          &quot;{keyName}&quot;:
        </span>
        <span className="text-muted-foreground">{isArray ? '[]' : '{}'}</span>
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <div
        className="flex min-w-0 cursor-pointer items-center rounded-sm px-1 select-none hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="mr-1 text-muted-foreground">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="mr-2 text-purple-600 dark:text-purple-400">
          &quot;{keyName}&quot;:
        </span>
        <span className="text-muted-foreground">
          {isArray ? '[' : '{'}
          {!expanded && (
            <span className="mx-1 text-xs opacity-60">...</span>
          )}
          {!expanded && (isArray ? ']' : '}')}
          {!expanded && !isLast && ','}
        </span>
        {!expanded && (
          <span className="ml-2 text-[10px] text-muted-foreground opacity-50">
            {entries.length} items
          </span>
        )}
      </div>

      {expanded && (
        <div className="ml-4 min-w-0 border-l border-border pl-2">
          {entries.map(([k, v], i, arr) => (
            <JsonNode
              key={k}
              keyName={k}
              value={v}
              isLast={i === arr.length - 1}
              initialExpanded={initialExpanded}
              level={level + 1}
            />
          ))}
        </div>
      )}

      {expanded && (
        <div className="hover:bg-muted/50 rounded-sm px-1">
          <span className="text-muted-foreground">{isArray ? ']' : '}'}</span>
          {!isLast && <span className="text-muted-foreground">,</span>}
        </div>
      )}
    </div>
  )
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <span className="text-green-600 dark:text-green-400">&quot;{value}&quot;</span>
  }
  if (typeof value === 'number') {
    return <span className="text-orange-600 dark:text-orange-400">{value}</span>
  }
  if (typeof value === 'boolean') {
    return <span className="text-red-600 dark:text-red-400">{value.toString()}</span>
  }
  if (value === null) {
    return <span className="text-gray-500 italic">null</span>
  }
  return <span className="text-foreground">{String(value)}</span>
}

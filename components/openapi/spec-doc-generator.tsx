'use client'

import { useState, useCallback } from 'react'
import { Sparkles, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { getDocEditorHref } from '@/lib/documents'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-[oklch(0.42_0.10_145)]',
  POST: 'text-[oklch(0.42_0.08_244)]',
  PUT: 'text-[oklch(0.48_0.10_83)]',
  PATCH: 'text-[oklch(0.48_0.10_83)]',
  DELETE: 'text-[oklch(0.50_0.10_25)]',
}

interface Endpoint {
  id: string
  path: string
  method: string
  operationId?: string | null
  summary?: string | null
}

interface GeneratedDoc {
  endpointMethod: string
  endpointPath: string
  documentId: string
  title: string
}

interface SpecDocGeneratorProps {
  sourceId: string
  endpoints: Endpoint[]
}

export function SpecDocGenerator({ sourceId, endpoints }: SpecDocGeneratorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<GeneratedDoc[] | null>(null)

  const toggleAll = useCallback(() => {
    if (selected.size === endpoints.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(endpoints.map((e) => e.id)))
    }
  }, [selected.size, endpoints])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleGenerate = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) {
      toast.error('Select at least one endpoint')
      return
    }

    setGenerating(true)
    setResults(null)

    try {
      const res = await fetch('/api/ai/generate-docs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          openapiSourceId: sourceId,
          endpointIds: ids,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Generation failed')
      }

      const data = await res.json()
      setResults(data.documents ?? [])
      toast.success(`Generated ${data.generated} document(s)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  if (endpoints.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No endpoints available. Upload a spec with endpoints first.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">
                AI Documentation Generator
              </CardTitle>
              <CardDescription className="text-xs">
                Generate rich documentation for each endpoint using AI.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={toggleAll}
              >
                {selected.size === endpoints.length ? 'Deselect all' : 'Select all'}
              </Button>
              <Button
                size="xs"
                onClick={handleGenerate}
                disabled={generating || selected.size === 0}
              >
                {generating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {generating
                  ? 'Generating…'
                  : `Generate (${selected.size})`}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="divide-y rounded-md border">
            {endpoints.map((ep) => {
              const isSelected = selected.has(ep.id)
              return (
                <label
                  key={ep.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/40',
                    isSelected && 'bg-accent/5',
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggle(ep.id)}
                  />
                  <span
                    className={cn(
                      'w-16 shrink-0 font-mono text-xs font-semibold uppercase',
                      METHOD_COLORS[ep.method.toUpperCase()] ?? 'text-muted-foreground',
                    )}
                  >
                    {ep.method}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {ep.path}
                  </span>
                  {ep.summary && (
                    <span className="hidden truncate text-xs text-muted-foreground sm:block sm:max-w-[200px]">
                      {ep.summary}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && results.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="size-4 text-[oklch(0.42_0.10_145)]" />
              Generated Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y rounded-md border">
              {results.map((doc) => (
                <a
                  key={doc.documentId}
                  href={getDocEditorHref(doc.documentId)}
                  className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                >
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{doc.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Open in editor →
                  </span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

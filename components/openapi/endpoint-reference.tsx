'use client'

import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Search, ChevronRight } from 'lucide-react'
import { EndpointTryIt } from './endpoint-try-it'

interface Endpoint {
  id: string
  path: string
  method: string
  operationId?: string | null
  summary?: string | null
  description?: string | null
  tags: string[]
  parameters: Record<string, unknown>[]
  requestBody: Record<string, unknown> | null
  responses: Record<string, unknown>
  deprecated: boolean
}

interface EndpointReferenceProps {
  endpoints: Endpoint[]
  className?: string
}

const FILTER_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-method-get/15 text-method-get border-method-get/25',
  POST: 'bg-method-post/15 text-method-post border-method-post/25',
  PUT: 'bg-method-put/15 text-method-put border-method-put/25',
  DELETE: 'bg-method-delete/15 text-method-delete border-method-delete/25',
  PATCH: 'bg-method-patch/15 text-method-patch border-method-patch/25',
  OPTIONS: 'bg-muted text-muted-foreground border-border/50',
  HEAD: 'bg-muted text-muted-foreground border-border/50',
}

const METHOD_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  GET: {
    active: 'bg-method-get/15 text-method-get border-method-get/30',
    inactive: 'bg-transparent text-muted-foreground border-border/50 hover:border-method-get/30 hover:text-method-get',
  },
  POST: {
    active: 'bg-method-post/15 text-method-post border-method-post/30',
    inactive: 'bg-transparent text-muted-foreground border-border/50 hover:border-method-post/30 hover:text-method-post',
  },
  PUT: {
    active: 'bg-method-put/15 text-method-put border-method-put/30',
    inactive: 'bg-transparent text-muted-foreground border-border/50 hover:border-method-put/30 hover:text-method-put',
  },
  DELETE: {
    active: 'bg-method-delete/15 text-method-delete border-method-delete/30',
    inactive: 'bg-transparent text-muted-foreground border-border/50 hover:border-method-delete/30 hover:text-method-delete',
  },
  PATCH: {
    active: 'bg-method-patch/15 text-method-patch border-method-patch/30',
    inactive: 'bg-transparent text-muted-foreground border-border/50 hover:border-method-patch/30 hover:text-method-patch',
  },
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  // Check direct substring
  if (lower.includes(q)) return true
  // Check each query word
  const words = q.split(/\s+/).filter(Boolean)
  return words.every((w) => lower.includes(w))
}

export function EndpointReference({
  endpoints,
  className,
}: EndpointReferenceProps) {
  const [search, setSearch] = useState('')
  const [methodFilters, setMethodFilters] = useState<Set<string>>(new Set())
  const [tagFilter, setTagFilter] = useState<string>('__all__')

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const ep of endpoints) {
      for (const t of ep.tags) tags.add(t)
    }
    return Array.from(tags).sort()
  }, [endpoints])

  const showTagFilter = allTags.length > 1

  // Filter endpoints
  const filtered = useMemo(() => {
    return endpoints.filter((ep) => {
      // Method filter
      if (methodFilters.size > 0 && !methodFilters.has(ep.method.toUpperCase())) {
        return false
      }
      // Tag filter
      if (tagFilter !== '__all__' && !ep.tags.includes(tagFilter)) {
        return false
      }
      // Search filter
      if (search) {
        const searchable = [
          ep.path,
          ep.operationId ?? '',
          ep.summary ?? '',
          ep.description ?? '',
        ].join(' ')
        if (!fuzzyMatch(searchable, search)) return false
      }
      return true
    })
  }, [endpoints, methodFilters, tagFilter, search])

  // Group filtered endpoints by first tag
  const groups = useMemo(() => {
    const map = new Map<string, Endpoint[]>()
    for (const ep of filtered) {
      const tag = ep.tags?.[0] || 'Untagged'
      if (!map.has(tag)) map.set(tag, [])
      map.get(tag)!.push(ep)
    }
    return map
  }, [filtered])

  const toggleMethod = (method: string) => {
    setMethodFilters((prev) => {
      const next = new Set(prev)
      if (next.has(method)) {
        next.delete(method)
      } else {
        next.add(method)
      }
      return next
    })
  }

  if (endpoints.length === 0) {
    return (
      <div className={cn('py-12 text-center text-sm text-muted-foreground', className)}>
        No endpoints found.
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search & Filter Bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search endpoints..."
              className="h-8 pl-8 text-sm"
            />
          </div>
          {showTagFilter && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger size="sm" className="w-[160px]">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {FILTER_METHODS.map((method) => (
              <button
                key={method}
                onClick={() => toggleMethod(method)}
                className={cn(
                  'rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide transition-colors',
                  methodFilters.has(method)
                    ? METHOD_PILL_COLORS[method].active
                    : METHOD_PILL_COLORS[method].inactive,
                )}
              >
                {method}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filtered.length === endpoints.length
              ? `${endpoints.length} endpoints`
              : `${filtered.length} of ${endpoints.length} endpoints`}
          </span>
        </div>
      </div>

      {/* Endpoint List */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No endpoints match your filters.
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(groups).map(([tag, eps]) => (
            <section key={tag}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tag}
              </h3>

              <Accordion type="multiple" className="space-y-1">
                {eps.map((ep) => (
                  <AccordionItem
                    key={ep.id}
                    value={ep.id}
                    className="rounded-md border bg-card px-0"
                  >
                    <AccordionTrigger className="gap-3 px-3 py-2.5 hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <MethodBadge method={ep.method} />
                        <code className="text-sm font-medium">{ep.path}</code>
                        {ep.summary && (
                          <span className="hidden text-sm text-muted-foreground sm:inline">
                            — {ep.summary}
                          </span>
                        )}
                        {ep.deprecated && (
                          <Badge
                            variant="outline"
                            className="border-tone-caution-border text-tone-caution-text"
                          >
                            Deprecated
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-3 pb-4 pt-1">
                      <EndpointDetails endpoint={ep} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[4rem] items-center justify-center rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
        METHOD_COLORS[method] ?? METHOD_COLORS.GET,
      )}
    >
      {method}
    </span>
  )
}

function EndpointDetails({ endpoint }: { endpoint: Endpoint }) {
  const [showTryIt, setShowTryIt] = useState(false)

  return (
    <div className="space-y-4">
      {endpoint.description && (
        <p className="text-sm text-muted-foreground">
          {endpoint.description}
        </p>
      )}

      <div className="flex items-center gap-3">
        {endpoint.operationId && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Operation ID:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5">
              {endpoint.operationId}
            </code>
          </p>
        )}
        <button
          onClick={() => setShowTryIt((v) => !v)}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
            showTryIt
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border/60 text-muted-foreground hover:border-primary/30 hover:text-primary',
          )}
        >
          Try It
        </button>
      </div>

      {showTryIt && (
        <EndpointTryIt
          method={endpoint.method}
          path={endpoint.path}
          parameters={endpoint.parameters}
          requestBody={endpoint.requestBody}
        />
      )}

      {/* Parameters */}
      {endpoint.parameters.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Parameters
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Name</TableHead>
                <TableHead className="w-[80px]">In</TableHead>
                <TableHead className="w-[80px]">Type</TableHead>
                <TableHead className="w-[70px]">Required</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoint.parameters.map((param, i) => {
                const schema = (param.schema as Record<string, unknown>) ?? {}
                return (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">
                      {param.name as string}
                    </TableCell>
                    <TableCell className="text-xs">
                      {param.in as string}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(schema.type as string) || '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {param.required ? (
                        <span className="text-tone-caution-text">
                          Yes
                        </span>
                      ) : (
                        'No'
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(param.description as string) || '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Request Body */}
      {endpoint.requestBody && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Request Body
          </h4>
          {renderContentBlock(endpoint.requestBody)}
        </div>
      )}

      {/* Responses */}
      {Object.keys(endpoint.responses).length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Responses
          </h4>
          <div className="space-y-2">
            {Object.entries(endpoint.responses)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([code, resp]) => {
                const r = resp as Record<string, unknown>
                return (
                  <div key={code} className="rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge code={code} />
                      {typeof r.description === 'string' && (
                        <span className="text-xs text-muted-foreground">
                          {r.description}
                        </span>
                      )}
                    </div>
                    {typeof r.content === 'object' && r.content !== null && (
                      <div className="mt-2">
                        {renderContentBlock(r)}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ code }: { code: string }) {
  const num = parseInt(code, 10)
  let color = 'bg-muted text-muted-foreground'
  if (num >= 200 && num < 300) color = 'bg-tone-success-bg text-tone-success-text'
  else if (num >= 300 && num < 400) color = 'bg-tone-info-bg text-tone-info-text'
  else if (num >= 400 && num < 500) color = 'bg-tone-caution-bg text-tone-caution-text'
  else if (num >= 500) color = 'bg-tone-error-bg text-tone-error-text'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold tabular-nums',
        color,
      )}
    >
      {code}
    </span>
  )
}

// --- Schema Tree Renderer ---

function SchemaTree({
  schema,
  depth = 0,
}: {
  schema: Record<string, unknown>
  depth?: number
}) {
  const type = schema.type as string | undefined
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined
  const items = schema.items as Record<string, unknown> | undefined
  const required = (schema.required as string[]) ?? []
  const enumValues = schema.enum as unknown[] | undefined

  // Simple type with no children
  if (!properties && !items && type !== 'object' && type !== 'array') {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {type || 'any'}
        {enumValues && (
          <span className="ml-1 text-muted-foreground/70">
            enum: [{enumValues.map(String).join(', ')}]
          </span>
        )}
      </span>
    )
  }

  if (type === 'array' && items) {
    return (
      <div>
        <span className="font-mono text-xs text-muted-foreground">array of:</span>
        <div className="ml-3 mt-1 border-l border-border/50 pl-3">
          <SchemaTree schema={items} depth={depth + 1} />
        </div>
      </div>
    )
  }

  if (properties) {
    return <SchemaProperties properties={properties} required={required} depth={depth} />
  }

  return (
    <span className="font-mono text-xs text-muted-foreground">
      {type || 'any'}
    </span>
  )
}

function SchemaProperties({
  properties,
  required,
  depth,
}: {
  properties: Record<string, Record<string, unknown>>
  required: string[]
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const entries = Object.entries(properties)

  if (entries.length === 0) {
    return <span className="font-mono text-xs text-muted-foreground">object</span>
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="size-3" />
        <span className="font-mono">object</span>
        <span className="text-muted-foreground/60">({entries.length} properties)</span>
      </button>
    )
  }

  return (
    <div className="space-y-0.5">
      {depth >= 1 && (
        <button
          onClick={() => setExpanded(false)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-3 rotate-90 transition-transform" />
          <span className="font-mono">object</span>
        </button>
      )}
      <div className={cn(depth >= 1 && 'ml-3 border-l border-border/50 pl-3')}>
        {entries.map(([name, propSchema]) => {
          const propType = propSchema.type as string | undefined
          const isRequired = required.includes(name)
          const hasChildren =
            propType === 'object' ||
            propType === 'array' ||
            propSchema.properties !== undefined ||
            propSchema.items !== undefined

          return (
            <div key={name} className="py-0.5">
              <div className="flex items-center gap-2">
                <code className="text-xs font-medium text-foreground">{name}</code>
                <span className="font-mono text-xs text-muted-foreground/70">
                  {propType || 'any'}
                </span>
                {isRequired && (
                  <Badge
                    variant="outline"
                    className="h-4 border-tone-caution-border px-1 text-[10px] leading-none text-tone-caution-text"
                  >
                    required
                  </Badge>
                )}
                {typeof propSchema.description === 'string' && (
                  <span className="hidden text-xs text-muted-foreground lg:inline">
                    {propSchema.description as string}
                  </span>
                )}
              </div>
              {hasChildren && (
                <div className="mt-0.5">
                  <SchemaTree schema={propSchema} depth={depth + 1} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function renderContentBlock(obj: Record<string, unknown>) {
  const content = (obj.content as Record<string, unknown>) ?? {}
  return (
    <div className="space-y-2">
      {Object.entries(content).map(([mediaType, mediaObj]) => {
        const schema = (mediaObj as Record<string, unknown>).schema as
          | Record<string, unknown>
          | undefined
        return (
          <div key={mediaType}>
            <code className="text-xs text-muted-foreground">{mediaType}</code>
            {schema && (
              <div className="mt-1 rounded-md bg-muted/50 p-2">
                <SchemaTree schema={schema} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

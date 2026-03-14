'use client'

import { useMemo } from 'react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

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

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-method-get/15 text-method-get border-method-get/25',
  POST: 'bg-method-post/15 text-method-post border-method-post/25',
  PUT: 'bg-method-put/15 text-method-put border-method-put/25',
  DELETE: 'bg-method-delete/15 text-method-delete border-method-delete/25',
  PATCH: 'bg-method-patch/15 text-method-patch border-method-patch/25',
  OPTIONS: 'bg-muted text-muted-foreground border-border/50',
  HEAD: 'bg-muted text-muted-foreground border-border/50',
}

export function EndpointReference({
  endpoints,
  className,
}: EndpointReferenceProps) {
  // Group endpoints by first tag
  const groups = useMemo(() => {
    const map = new Map<string, Endpoint[]>()
    for (const ep of endpoints) {
      const tag = ep.tags?.[0] || 'Untagged'
      if (!map.has(tag)) map.set(tag, [])
      map.get(tag)!.push(ep)
    }
    return map
  }, [endpoints])

  if (endpoints.length === 0) {
    return (
      <div className={cn('py-12 text-center text-sm text-muted-foreground', className)}>
        No endpoints found.
      </div>
    )
  }

  return (
    <div className={cn('space-y-8', className)}>
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
  return (
    <div className="space-y-4">
      {endpoint.description && (
        <p className="text-sm text-muted-foreground">
          {endpoint.description}
        </p>
      )}

      {endpoint.operationId && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Operation ID:</span>{' '}
          <code className="rounded bg-muted px-1 py-0.5">
            {endpoint.operationId}
          </code>
        </p>
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
              <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
                {JSON.stringify(schema, null, 2)}
              </pre>
            )}
          </div>
        )
      })}
    </div>
  )
}

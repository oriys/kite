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
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import { MethodDetail } from './method-detail'
import { MethodTryIt } from './method-try-it'

interface GrpcMethod {
  id: string
  name: string
  inputType: Record<string, unknown>
  outputType: Record<string, unknown>
  clientStreaming: boolean
  serverStreaming: boolean
}

interface GrpcService {
  id: string
  packageName: string
  serviceName: string
  description?: string | null
  methods: GrpcMethod[]
}

interface ServiceReferenceProps {
  services: GrpcService[]
  protoContent?: string
  className?: string
}

const STREAMING_LABELS: Record<string, string> = {
  unary: 'Unary',
  server: 'Server Stream',
  client: 'Client Stream',
  bidi: 'Bidi Stream',
}

const STREAMING_COLORS: Record<string, string> = {
  unary: 'bg-tone-info-bg text-tone-info-text border-tone-info-border',
  server: 'bg-method-get/15 text-method-get border-method-get/25',
  client: 'bg-method-post/15 text-method-post border-method-post/25',
  bidi: 'bg-method-put/15 text-method-put border-method-put/25',
}

function getStreamingType(method: GrpcMethod): string {
  if (method.clientStreaming && method.serverStreaming) return 'bidi'
  if (method.serverStreaming) return 'server'
  if (method.clientStreaming) return 'client'
  return 'unary'
}

export function ServiceReference({
  services,
  protoContent,
  className,
}: ServiceReferenceProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return services

    const q = search.toLowerCase()
    return services
      .map((svc) => {
        const svcMatch =
          svc.serviceName.toLowerCase().includes(q) ||
          svc.packageName.toLowerCase().includes(q)

        const matchingMethods = svc.methods.filter(
          (m) =>
            svcMatch ||
            m.name.toLowerCase().includes(q),
        )

        if (matchingMethods.length === 0 && !svcMatch) return null

        return {
          ...svc,
          methods: svcMatch ? svc.methods : matchingMethods,
        }
      })
      .filter((s): s is GrpcService => s !== null)
  }, [services, search])

  const totalMethods = services.reduce((sum, s) => sum + s.methods.length, 0)
  const filteredMethods = filtered.reduce((sum, s) => sum + s.methods.length, 0)

  if (services.length === 0) {
    return (
      <div className={cn('py-12 text-center text-sm text-muted-foreground', className)}>
        No services found.
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services and methods..."
              className="h-8 pl-8 text-sm"
            />
          </div>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filteredMethods === totalMethods
              ? `${services.length} services · ${totalMethods} methods`
              : `${filtered.length} of ${services.length} services · ${filteredMethods} methods`}
          </span>
        </div>
      </div>

      {/* Service List */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No services match your search.
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((svc) => (
            <section key={svc.id}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {svc.packageName ? `${svc.packageName}.` : ''}
                  {svc.serviceName}
                </h3>
                <Badge variant="secondary" className="text-[10px]">
                  {svc.methods.length} methods
                </Badge>
              </div>

              <Accordion type="multiple" className="space-y-1">
                {svc.methods.map((method) => {
                  const streamType = getStreamingType(method)
                  return (
                    <AccordionItem
                      key={method.id}
                      value={method.id}
                      className="rounded-md border bg-card px-0"
                    >
                      <AccordionTrigger className="gap-3 px-3 py-2.5 hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          <span
                            className={cn(
                              'inline-flex min-w-[5.5rem] items-center justify-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                              STREAMING_COLORS[streamType],
                            )}
                          >
                            {STREAMING_LABELS[streamType]}
                          </span>
                          <code className="text-sm font-medium">{method.name}</code>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-3 pb-4 pt-1">
                        <MethodDetailInline
                          method={method}
                          serviceName={`${svc.packageName}.${svc.serviceName}`}
                          protoContent={protoContent}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function MethodDetailInline({
  method,
  serviceName,
  protoContent,
}: {
  method: GrpcMethod
  serviceName: string
  protoContent?: string
}) {
  const [showTryIt, setShowTryIt] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
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

      {showTryIt && protoContent && (
        <MethodTryIt
          protoContent={protoContent}
          serviceName={serviceName}
          methodName={method.name}
          inputType={method.inputType}
        />
      )}

      <MethodDetail
        inputType={method.inputType}
        outputType={method.outputType}
      />
    </div>
  )
}

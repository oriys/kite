import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { CodeBlock } from '@/components/ui/code-block'
import {
  HttpMethodBadge,
  type HttpMethod,
} from '@/components/ui/http-request'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const responseToneClasses = {
  success:
    'border-tone-success-border bg-tone-success-bg text-tone-success-text',
  caution:
    'border-tone-caution-border bg-tone-caution-bg text-tone-caution-text',
  error:
    'border-tone-error-border bg-tone-error-bg text-tone-error-text',
  neutral:
    'border-border/80 bg-muted/60 text-muted-foreground',
} as const

const deliveryToneClasses = {
  delivered:
    'border-tone-success-border bg-tone-success-bg text-tone-success-text',
  retrying:
    'border-tone-caution-border bg-tone-caution-bg text-tone-caution-text',
  failed:
    'border-tone-error-border bg-tone-error-bg text-tone-error-text',
  pending:
    'border-border/80 bg-muted/60 text-muted-foreground',
} as const

const operationToneClasses = {
  Query:
    'border-tone-query-border bg-tone-query-bg text-tone-query-text',
  Mutation:
    'border-tone-mutation-border bg-tone-mutation-bg text-tone-mutation-text',
  Subscription:
    'border-tone-subscription-border bg-tone-subscription-bg text-tone-subscription-text',
} as const

type ApiResponseTone = keyof typeof responseToneClasses
type DeliveryTone = keyof typeof deliveryToneClasses
type GraphqlOperationTone = keyof typeof operationToneClasses

function ApiEndpointCard({
  className,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="api-endpoint-card"
      className={cn(
        'overflow-hidden rounded-lg border border-border/75 bg-card/90 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_20px_48px_-40px_rgba(15,23,42,0.22)]',
        className,
      )}
      {...props}
    />
  )
}

function ApiEndpointHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="api-endpoint-header"
      className={cn('space-y-4 border-b border-border/75 p-4 sm:p-5', className)}
      {...props}
    />
  )
}

function ApiEndpointPath({
  method,
  path,
  stability,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  method: HttpMethod
  path: React.ReactNode
  stability?: React.ReactNode
}) {
  return (
    <div
      data-slot="api-endpoint-path"
      className={cn('flex flex-wrap items-center gap-3', className)}
      {...props}
    >
      <HttpMethodBadge method={method} />
      <div className="min-w-0 flex-1 rounded-md border border-border/75 bg-background/85 px-3 py-2 font-mono text-[13px] leading-6 text-foreground">
        {path}
      </div>
      {stability ? (
        <Badge variant="outline" className="border-border/80 bg-muted/60 text-foreground">
          {stability}
        </Badge>
      ) : null}
    </div>
  )
}

function ApiEndpointMeta({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="api-endpoint-meta"
      className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}
      {...props}
    />
  )
}

function ApiEndpointMetaItem({
  label,
  value,
  note,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  label: string
  value: React.ReactNode
  note?: React.ReactNode
}) {
  return (
    <div
      data-slot="api-endpoint-meta-item"
      className={cn(
        'rounded-md border border-border/75 bg-background/80 px-3 py-3',
        className,
      )}
      {...props}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
      {note ? (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{note}</p>
      ) : null}
    </div>
  )
}

function ApiResponseBadge({
  code,
  label,
  tone = 'neutral',
  className,
  ...props
}: React.ComponentProps<'span'> & {
  code: string
  label: string
  tone?: ApiResponseTone
}) {
  return (
    <Badge
      data-slot="api-response-badge"
      variant="outline"
      className={cn('gap-2', responseToneClasses[tone], className)}
      {...props}
    >
      <span className="font-mono text-[10px] tracking-[0.16em]">{code}</span>
      <span className="text-[11px] tracking-[0.12em]">{label}</span>
    </Badge>
  )
}

function ApiCodeTabs({
  items,
  defaultValue,
  className,
}: {
  items: ReadonlyArray<{
    value: string
    label: string
    language?: string
    caption?: string
    code: string
  }>
  defaultValue?: string
  className?: string
}) {
  const initialValue = defaultValue ?? items[0]?.value

  if (!initialValue) {
    return null
  }

  return (
    <Tabs defaultValue={initialValue} className={cn('gap-3', className)}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className="flex-none">
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value}>
          <div className="overflow-hidden rounded-md border border-border/75 bg-background/85">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {item.language ?? item.label}
              </span>
              {item.caption ? (
                <span className="text-xs text-muted-foreground">
                  {item.caption}
                </span>
              ) : null}
            </div>
            <CodeBlock
              code={item.code}
              language={item.language ?? item.label}
              className="px-3 py-3"
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}

function WebhookEventCard({
  event,
  title,
  description,
  destination,
  deliveryMode,
  className,
  ...props
}: React.ComponentProps<'article'> & {
  event: string
  title: string
  description: string
  destination: React.ReactNode
  deliveryMode?: React.ReactNode
}) {
  return (
    <article
      data-slot="webhook-event-card"
      className={cn(
        'space-y-3 rounded-md border border-border/75 bg-background/80 p-4',
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-border/80 bg-muted/60 text-foreground">
          {event}
        </Badge>
        {deliveryMode ? (
          <Badge variant="outline" className="border-border/70 bg-background text-muted-foreground">
            {deliveryMode}
          </Badge>
        ) : null}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-md border border-border/70 bg-card/80 px-3 py-2 font-mono text-[12px] leading-6 text-muted-foreground">
        {destination}
      </div>
    </article>
  )
}

function WebhookDeliveryList({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="webhook-delivery-list"
      className={cn(
        'divide-y divide-border/70 rounded-md border border-border/75 bg-background/80',
        className,
      )}
      {...props}
    />
  )
}

function WebhookDeliveryItem({
  event,
  status,
  timestamp,
  note,
  tone = 'pending',
  className,
  ...props
}: React.ComponentProps<'div'> & {
  event: string
  status: string
  timestamp: string
  note?: React.ReactNode
  tone?: DeliveryTone
}) {
  return (
    <div
      data-slot="webhook-delivery-item"
      className={cn(
        'grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4',
        className,
      )}
      {...props}
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{event}</p>
          <Badge
            variant="outline"
            className={cn(deliveryToneClasses[tone])}
          >
            {status}
          </Badge>
        </div>
        {note ? (
          <p className="text-sm leading-6 text-muted-foreground">{note}</p>
        ) : null}
      </div>
      <p className="justify-self-start text-xs text-muted-foreground sm:justify-self-end">
        {timestamp}
      </p>
    </div>
  )
}

function GraphqlOperationCard({
  kind,
  name,
  description,
  signature,
  returns,
  className,
  children,
  ...props
}: React.ComponentProps<'article'> & {
  kind: GraphqlOperationTone
  name: string
  description: string
  signature: string
  returns?: React.ReactNode
}) {
  return (
    <article
      data-slot="graphql-operation-card"
      className={cn(
        'space-y-4 rounded-md border border-border/75 bg-background/80 p-4',
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(operationToneClasses[kind])}
            >
              {kind}
            </Badge>
            <p className="text-sm font-medium text-foreground">{name}</p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        {returns ? (
          <div className="rounded-md border border-border/70 bg-card/80 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {returns}
          </div>
        ) : null}
      </div>
      <div className="rounded-md border border-border/70 bg-card/80 px-3 py-2 font-mono text-[12px] leading-6 text-foreground">
        {signature}
      </div>
      {children}
    </article>
  )
}

function GraphqlFieldList({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="graphql-field-list"
      className={cn(
        'divide-y divide-border/70 rounded-md border border-border/75 bg-card/75',
        className,
      )}
      {...props}
    />
  )
}

function GraphqlField({
  name,
  type,
  description,
  required = false,
  deprecated = false,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  name: string
  type: string
  description: string
  required?: boolean
  deprecated?: boolean
}) {
  return (
    <div
      data-slot="graphql-field"
      className={cn(
        'grid gap-2 px-3 py-3 lg:grid-cols-[minmax(0,170px)_minmax(0,1fr)_auto] lg:items-start lg:gap-3',
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{name}</span>
        {required ? (
          <Badge variant="outline" className="border-border/70 bg-background text-foreground">
            Non-null
          </Badge>
        ) : null}
        {deprecated ? (
          <Badge variant="outline" className="border-tone-caution-border bg-tone-caution-bg text-tone-caution-text">
            Deprecated
          </Badge>
        ) : null}
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="justify-self-start font-mono text-[12px] leading-6 text-muted-foreground lg:justify-self-end">
        {type}
      </div>
    </div>
  )
}

export {
  ApiCodeTabs,
  ApiEndpointCard,
  ApiEndpointHeader,
  ApiEndpointMeta,
  ApiEndpointMetaItem,
  ApiEndpointPath,
  ApiResponseBadge,
  GraphqlField,
  GraphqlFieldList,
  GraphqlOperationCard,
  WebhookDeliveryItem,
  WebhookDeliveryList,
  WebhookEventCard,
}

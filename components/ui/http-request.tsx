import * as React from 'react'

import { cn } from '@/lib/utils'

const methodColorVars = {
  GET: '--method-get',
  POST: '--method-post',
  PUT: '--method-put',
  PATCH: '--method-patch',
  DELETE: '--method-delete',
} as const

type HttpMethod = keyof typeof methodColorVars

function HttpRequest({
  className,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="http-request"
      className={cn(
        'overflow-hidden rounded-lg border border-border/75 bg-card/85',
        className,
      )}
      {...props}
    />
  )
}

function HttpRequestBar({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="http-request-bar"
      className={cn(
        'flex flex-col gap-3 border-b border-border/75 p-4 sm:flex-row sm:items-center',
        className,
      )}
      {...props}
    />
  )
}

function HttpMethodBadge({
  method,
  className,
  style,
  ...props
}: React.ComponentProps<'span'> & {
  method: HttpMethod
}) {
  const tone = `var(${methodColorVars[method]})`

  return (
    <span
      data-slot="http-method-badge"
      data-method={method}
      className={cn(
        'inline-flex h-10 shrink-0 items-center rounded-md border px-4 font-mono text-[12px] font-semibold tracking-[0.16em] uppercase',
        className,
      )}
      style={{
        borderColor: `color-mix(in oklab, ${tone} 24%, var(--border))`,
        backgroundColor: `color-mix(in oklab, ${tone} 14%, transparent)`,
        color: `color-mix(in oklab, ${tone} 72%, var(--foreground))`,
        ...style,
      }}
      {...props}
    >
      {method}
    </span>
  )
}

function HttpRequestUrl({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="http-request-url"
      className={cn(
        'flex min-h-10 min-w-0 flex-1 items-center rounded-md border border-border/75 bg-background/85 px-4 py-2 font-mono text-[13px] leading-6 text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function HttpRequestSection({
  title,
  description,
  className,
  children,
  ...props
}: React.ComponentProps<'section'> & {
  title: string
  description?: string
}) {
  return (
    <section
      data-slot="http-request-section"
      className={cn('space-y-3 p-3', className)}
      {...props}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function HttpRequestItems({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="http-request-items"
      className={cn(
        'divide-y divide-border/70 rounded-md border border-border/75 bg-background/80',
        className,
      )}
      {...props}
    />
  )
}

function HttpRequestItem({
  name,
  value,
  meta,
  required = false,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  name: React.ReactNode
  value: React.ReactNode
  meta?: React.ReactNode
  required?: boolean
}) {
  return (
    <div
      data-slot="http-request-item"
      className={cn(
        'grid gap-2 px-4 py-3 xl:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto] xl:items-start xl:gap-4',
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground xl:pt-0.5">
        <span className="min-w-0">{name}</span>
        {required ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-destructive">
            Required
          </span>
        ) : null}
      </div>
      <div className="min-w-0 break-words font-mono text-[13px] leading-7 text-muted-foreground">
        {value}
      </div>
      {meta ? (
        <div className="justify-self-start xl:justify-self-end">
          <div className="inline-flex rounded-sm bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {meta}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function HttpRequestBody({
  language = 'json',
  className,
  children,
  ...props
}: React.ComponentProps<'pre'> & {
  language?: string
}) {
  return (
    <div
      data-slot="http-request-body"
      className="overflow-hidden rounded-md border border-border/75 bg-background/85"
    >
      <div className="border-b border-border/70 px-3 py-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {language}
        </span>
      </div>
      <pre
        className={cn(
          'overflow-x-auto px-3 py-3 font-mono text-[13px] leading-6 text-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </pre>
    </div>
  )
}

export {
  HttpMethodBadge,
  HttpRequest,
  HttpRequestBar,
  HttpRequestBody,
  HttpRequestItem,
  HttpRequestItems,
  HttpRequestSection,
  HttpRequestUrl,
}

export type { HttpMethod }

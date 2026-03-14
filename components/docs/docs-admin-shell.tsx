import * as React from 'react'

import { cn } from '@/lib/utils'

interface DocsAdminShellProps {
  kicker: string
  title: string
  description: string
  actions?: React.ReactNode
  meta?: React.ReactNode
  notice?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function DocsAdminShell({
  kicker,
  title,
  description,
  actions,
  meta,
  notice,
  children,
  className,
}: DocsAdminShellProps) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6',
        className,
      )}
    >
      <header className="editorial-surface overflow-hidden editorial-reveal">
        <div className="px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="editorial-section-kicker">{kicker}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.95rem]">
                {title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {actions}
              </div>
            ) : null}
          </div>
          {meta ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>
        {notice ? (
          <div className="border-t border-border/70 px-4 py-3 sm:px-5">
            {notice}
          </div>
        ) : null}
      </header>
      {children}
    </div>
  )
}

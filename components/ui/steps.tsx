import * as React from 'react'

import { cn } from '@/lib/utils'

export function Steps({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mb-12 ml-4 border-l border-border pl-8 [counter-reset:step]',
        className
      )}
      {...props}
    />
  )
}

export function Step({
  className,
  title,
  children,
  ...props
}: React.ComponentProps<'div'> & { title: string }) {
    return (
        <div className={cn('relative mt-8 first:mt-0 [counter-increment:step]', className)} {...props}>
            <div className="absolute -left-8 -top-1 flex h-8 w-8 items-center justify-center rounded-full border bg-background text-sm font-bold shadow-sm ring-4 ring-background">
                <span className="before:content-[counter(step)]" />
            </div>
            <h3 className="mb-2 text-base font-semibold tracking-tight">{title}</h3>
            <div className="text-sm text-muted-foreground">{children}</div>
        </div>
    )
}

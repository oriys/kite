import * as React from 'react'

import { cn } from '@/lib/utils'

export function Steps({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'relative space-y-8 pl-14 before:absolute before:bottom-3 before:left-5 before:top-3 before:w-px before:bg-border [counter-reset:step]',
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
    <div className={cn('relative [counter-increment:step]', className)} {...props}>
      <div className="absolute left-[-3.5rem] top-0 flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background text-sm font-semibold text-foreground shadow-sm ring-4 ring-background">
        <span className="before:content-[counter(step)]" />
      </div>
      <h3 className="mb-2 pt-0.5 text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <div className="text-sm leading-7 text-muted-foreground">{children}</div>
    </div>
  )
}

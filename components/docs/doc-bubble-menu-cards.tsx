import * as React from 'react'
import { cn } from '@/lib/utils'

export function AiMenuCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={style}
      className={cn(
        'rounded-xl border border-border/80 bg-background/96 p-1 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.32)] backdrop-blur-md',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function AiMenuItemContent({
  icon,
  title,
  description,
  trailing,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  trailing?: React.ReactNode
}) {
  return (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/25 text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">{title}</div>
        {description ? (
          <div className="truncate text-[10px] leading-4 text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {trailing}
    </>
  )
}

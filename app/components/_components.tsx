import type { ComponentType } from 'react'

import { Badge } from '@/components/ui/badge'

export function reveal(delay: number) {
  return { animationDelay: `${delay}ms` }
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="space-y-3">
      <p className="editorial-section-kicker">{eyebrow}</p>
      <div className="space-y-2">
        <h2 className="text-2xl tracking-tight md:text-3xl">{title}</h2>
        <p className="max-w-[68ch] text-sm leading-7 text-muted-foreground md:text-base">
          {description}
        </p>
      </div>
    </div>
  )
}

export function MetricTile({
  value,
  label,
  note,
}: {
  value: string
  label: string
  note: string
}) {
  return (
    <div className="editorial-panel p-3">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{note}</p>
    </div>
  )
}

function TokenSwatch({
  label,
  token,
  note,
}: {
  label: string
  token: string
  note: string
}) {
  return (
    <div className="editorial-panel p-3">
      <div
        className="h-16 rounded-md border border-black/5"
        style={{ backgroundColor: `var(--${token})` }}
      />
      <div className="mt-4 space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{note}</p>
        <code className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          --{token}
        </code>
      </div>
    </div>
  )
}

export function TokenGroupSection({
  title,
  description,
  tokens,
}: {
  title: string
  description: string
  tokens: ReadonlyArray<{
    label: string
    token: string
    note: string
  }>
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <Badge variant="outline">{tokens.length} tokens</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tokens.map((token) => (
          <TokenSwatch key={token.token} {...token} />
        ))}
      </div>
    </div>
  )
}

export function FeatureTile({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="editorial-panel p-3">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted/80">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

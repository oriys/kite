'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface VersionBadgeProps {
  status: 'active' | 'beta' | 'deprecated' | 'retired'
  label?: string
  className?: string
}

const statusConfig: Record<
  VersionBadgeProps['status'],
  { label: string; className: string }
> = {
  active: {
    label: 'Active',
    className:
      'border-tone-success-border bg-tone-success-bg text-tone-success-text',
  },
  beta: {
    label: 'Beta',
    className:
      'border-tone-caution-border bg-tone-caution-bg text-tone-caution-text',
  },
  deprecated: {
    label: 'Deprecated',
    className:
      'border-tone-error-border bg-tone-error-bg text-tone-error-text',
  },
  retired: {
    label: 'Retired',
    className:
      'border-border bg-muted/50 text-muted-foreground',
  },
}

export function VersionBadge({ status, label, className }: VersionBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[11px] font-medium uppercase tracking-wide',
        config.className,
        className,
      )}
    >
      {label ?? config.label}
    </Badge>
  )
}

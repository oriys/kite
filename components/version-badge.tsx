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
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  },
  beta: {
    label: 'Beta',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  },
  deprecated: {
    label: 'Deprecated',
    className:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
  },
  retired: {
    label: 'Retired',
    className:
      'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700',
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

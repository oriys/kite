'use client'

import { Badge } from '@/components/ui/badge'
import { Globe, Users, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VisibilityBadgeProps {
  visibility: 'public' | 'partner' | 'private'
  className?: string
  compact?: boolean
}

const config = {
  public: {
    label: 'Public',
    icon: Globe,
    classes:
      'border-tone-success-border bg-tone-success-bg text-tone-success-text',
  },
  partner: {
    label: 'Partner',
    icon: Users,
    classes:
      'border-tone-caution-border bg-tone-caution-bg text-tone-caution-text',
  },
  private: {
    label: 'Private',
    icon: Lock,
    classes:
      'border-tone-error-border bg-tone-error-bg text-tone-error-text',
  },
} as const

export function VisibilityBadge({
  visibility,
  className,
  compact = false,
}: VisibilityBadgeProps) {
  const { label, icon: Icon, classes } = config[visibility]

  return (
    <Badge
      variant="outline"
      className={cn(
        classes,
        compact && 'rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-[0.08em] [&>svg]:size-2.5',
        className,
      )}
    >
      <Icon className="size-3" />
      {label}
    </Badge>
  )
}

'use client'

import { Badge } from '@/components/ui/badge'
import { Globe, Users, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VisibilityBadgeProps {
  visibility: 'public' | 'partner' | 'private'
  className?: string
}

const config = {
  public: {
    label: 'Public',
    icon: Globe,
    classes:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400',
  },
  partner: {
    label: 'Partner',
    icon: Users,
    classes:
      'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400',
  },
  private: {
    label: 'Private',
    icon: Lock,
    classes:
      'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-400',
  },
} as const

export function VisibilityBadge({ visibility, className }: VisibilityBadgeProps) {
  const { label, icon: Icon, classes } = config[visibility]

  return (
    <Badge variant="outline" className={cn(classes, className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  )
}

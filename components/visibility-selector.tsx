'use client'

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Globe, Users, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

type VisibilityLevel = 'public' | 'partner' | 'private'

interface VisibilitySelectorProps {
  value: VisibilityLevel
  onChange: (value: VisibilityLevel) => void
  disabled?: boolean
  className?: string
}

const options = [
  {
    value: 'public' as const,
    label: 'Public',
    description: 'Visible to everyone',
    icon: Globe,
    iconClass: 'text-tone-success-text',
  },
  {
    value: 'partner' as const,
    label: 'Partner',
    description: 'Visible to partner groups',
    icon: Users,
    iconClass: 'text-tone-caution-text',
  },
  {
    value: 'private' as const,
    label: 'Private',
    description: 'Visible to workspace members only',
    icon: Lock,
    iconClass: 'text-tone-error-text',
  },
]

export function VisibilitySelector({
  value,
  onChange,
  disabled,
  className,
}: VisibilitySelectorProps) {
  const selected = options.find((o) => o.value === value)

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as VisibilityLevel)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className={cn('gap-1.5', className)}>
        <SelectValue>
          {selected && (
            <>
              <selected.icon className={cn('size-3.5', selected.iconClass)} />
              <span>{selected.label}</span>
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <div className="flex items-center gap-2">
              <opt.icon className={cn('size-4 shrink-0', opt.iconClass)} />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">
                  {opt.description}
                </span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

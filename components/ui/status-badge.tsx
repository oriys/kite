import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const statusToneClasses = {
  ready:
    'border-tone-success-border bg-tone-success-bg text-tone-success-text',
  live:
    'border-tone-info-border bg-tone-info-bg text-tone-info-text',
  draft:
    'border-tone-caution-border bg-tone-caution-bg text-tone-caution-text',
} as const

type StatusTone = keyof typeof statusToneClasses

function StatusBadge({
  label,
  tone,
  compact = false,
  className,
  ...props
}: React.ComponentProps<typeof Badge> & {
  label: string
  tone: StatusTone
  compact?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        statusToneClasses[tone],
        compact && 'rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-[0.08em]',
        className,
      )}
      {...props}
    >
      {label}
    </Badge>
  )
}

export { StatusBadge }
export type { StatusTone }

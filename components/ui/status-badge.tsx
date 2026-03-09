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
  className,
  ...props
}: React.ComponentProps<typeof Badge> & {
  label: string
  tone: StatusTone
}) {
  return (
    <Badge
      variant="outline"
      className={cn(statusToneClasses[tone], className)}
      {...props}
    >
      {label}
    </Badge>
  )
}

export { StatusBadge }
export type { StatusTone }

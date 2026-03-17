import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, Info, CheckCircle, XCircle, Lightbulb } from 'lucide-react'

import { cn } from '@/lib/utils'

const calloutVariants = cva(
  'my-6 flex items-start gap-3 rounded-lg border p-4 text-sm shadow-sm',
  {
    variants: {
      type: {
        default: 'border-border bg-card text-foreground',
        info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
        warning: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
        error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
        success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200',
        tip: 'border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200',
      },
    },
    defaultVariants: {
      type: 'default',
    },
  }
)

const icons = {
  default: Info,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle,
  tip: Lightbulb,
}

interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  icon?: React.ReactNode
  title?: string
}

export function Callout({
  className,
  title,
  children,
  icon,
  type = 'default',
  ...props
}: CalloutProps) {
  const Icon = icons[type || 'default']

  return (
    <div className={cn(calloutVariants({ type }), className)} {...props}>
      {icon ?? <Icon className="h-5 w-5 shrink-0 mt-0.5" />}
      <div className="grid gap-1">
        {title && <h5 className="font-medium leading-none tracking-tight">{title}</h5>}
        <div className="text-sm [&_p]:leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

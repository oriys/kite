'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button, ButtonProps } from '@/components/ui/button'

interface CopyButtonProps extends ButtonProps {
  value: string
  src?: string
}

export function CopyButton({
  value,
  className,
  src,
  variant = 'ghost',
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false)

  React.useEffect(() => {
    setTimeout(() => {
      setHasCopied(false)
    }, 2000)
  }, [hasCopied])

  return (
    <Button
      size="icon"
      variant={variant}
      className={cn(
        'relative z-10 size-6 hover:bg-muted text-muted-foreground hover:text-foreground',
        className
      )}
      onClick={() => {
        navigator.clipboard.writeText(value)
        setHasCopied(true)
      }}
      {...props}
    >
      <span className="sr-only">Copy</span>
      {hasCopied ? (
        <Check className="size-3" />
      ) : (
        <Copy className="size-3" />
      )}
    </Button>
  )
}

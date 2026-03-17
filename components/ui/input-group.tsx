'use client'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        'group/input-group relative flex w-full items-stretch overflow-hidden rounded-md border border-input/80 bg-background/80 shadow-none transition-[border-color,box-shadow,background-color] outline-none',
        'min-h-10 has-[>textarea]:min-h-0 has-[>textarea]:items-stretch has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-end]]:flex-col',
        'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/35',
        'has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-2 has-[[data-slot][aria-invalid=true]]:ring-destructive/15',
        className,
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  'text-muted-foreground flex shrink-0 items-center gap-2 text-sm font-medium select-none [&>svg:not([class*="size-"])]:size-4 group-data-[disabled=true]/input-group:opacity-50',
  {
    variants: {
      align: {
        'inline-start': 'order-first border-r border-border/70 bg-muted/30 px-3',
        'inline-end':
          'order-last justify-end border-l border-border/70 bg-background/70 px-2.5',
        'block-start':
          'order-first w-full justify-start border-b border-border/70 px-3 py-2.5',
        'block-end':
          'order-last w-full justify-start border-t border-border/70 px-3 py-2.5',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
)

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) {
          return
        }
        e.currentTarget.parentElement?.querySelector('input')?.focus()
      }}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        'h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none hover:bg-transparent focus-visible:ring-0 dark:bg-transparent',
        className,
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bot,
  BrainCircuit,
  ChevronDown,
  PencilLine,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DocsAiMenuProps {
  align?: 'start' | 'center' | 'end'
  buttonClassName?: string
  triggerLabel?: string
}

function getCurrentLabel(pathname: string) {
  if (pathname.startsWith('/docs/settings/ai-prompts')) {
    return 'AI Prompts'
  }

  if (pathname.startsWith('/docs/settings/ai')) {
    return 'AI Models'
  }

  return 'AI Workspace'
}

export function DocsAiMenu({
  align = 'end',
  buttonClassName,
  triggerLabel,
}: DocsAiMenuProps) {
  const pathname = usePathname()
  const resolvedTriggerLabel = triggerLabel ?? getCurrentLabel(pathname)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2', buttonClassName)}
        >
          <Bot data-icon="inline-start" />
          {resolvedTriggerLabel}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[20rem]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          AI Workspace
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="items-start py-2">
            <Link href="/docs/settings/ai" className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
              <BrainCircuit className="mt-0.5 size-4 text-muted-foreground" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-foreground">AI Models</span>
                <span className="text-xs leading-5 text-muted-foreground">
                  Enable the models the editor can call.
                </span>
              </span>
              {pathname === '/docs/settings/ai' ? <Badge variant="secondary">Current</Badge> : null}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="items-start py-2">
            <Link
              href="/docs/settings/ai-prompts"
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3"
            >
              <PencilLine className="mt-0.5 size-4 text-muted-foreground" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-foreground">AI Prompts</span>
                <span className="text-xs leading-5 text-muted-foreground">
                  Adjust system and action prompts for this workspace.
                </span>
              </span>
              {pathname.startsWith('/docs/settings/ai-prompts') ? (
                <Badge variant="secondary">Current</Badge>
              ) : null}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

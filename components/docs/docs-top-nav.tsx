'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Braces, BrainCircuit, PencilLine, Blocks, BarChart3, LinkIcon, Menu, Search, Shield, Webhook, Palette, LayoutTemplate, ClipboardCheck } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/auth/user-menu'
import { GlobalSearch } from '@/components/global-search'
import { NotificationBell } from '@/components/notification-bell'

const NAV_ITEMS = [
  { href: '/docs', label: 'Documents', icon: FileText },
  { href: '/docs/openapi', label: 'OpenAPI', icon: Braces },
  { href: '/docs/ai', label: 'AI Models', icon: BrainCircuit },
  { href: '/docs/ai/prompts', label: 'AI Prompts', icon: PencilLine },
  { href: '/docs/components', label: 'Quick Insert', icon: Blocks },
  { href: '/docs/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/docs/link-health', label: 'Link Health', icon: LinkIcon },
  { href: '/docs/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/docs/approvals', label: 'Approvals', icon: ClipboardCheck },
  { href: '/docs/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/docs/branding', label: 'Branding', icon: Palette },
  { href: '/docs/audit-logs', label: 'Audit Logs', icon: Shield },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/docs') {
    return pathname === '/docs' || pathname.startsWith('/docs/editor')
  }
  if (href === '/docs/ai') {
    return pathname === '/docs/ai'
  }
  return pathname.startsWith(href)
}

export function DocsTopNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <header className="shrink-0 border-b border-border/60 bg-card/50 backdrop-blur-sm">
      <div className="flex h-12 items-center gap-4 px-4 sm:px-6">
        {/* Mobile hamburger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="px-5 pt-5 pb-3">
              <SheetTitle className="text-sm font-semibold tracking-tight">
                Kite
              </SheetTitle>
            </SheetHeader>
            <Separator />
            <nav className="space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                      active
                        ? 'bg-accent/50 font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link
          href="/docs"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          Kite
        </Link>

        <Separator orientation="vertical" className="!h-5 hidden md:block" />

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-accent/50 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search trigger */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground sm:inline-flex"
        >
          <Search className="size-3" />
          <span>Search docs…</span>
          <kbd className="ml-1 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>

        {/* Utilities */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-4" />
          </Button>
          <NotificationBell />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}

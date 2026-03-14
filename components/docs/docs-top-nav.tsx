'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Blocks,
  Braces,
  ChevronDown,
  ClipboardCheck,
  FileText,
  GitCompareArrows,
  LayoutTemplate,
  LinkIcon,
  Menu,
  Palette,
  Search,
  Settings,
  Shield,
  Webhook,
} from 'lucide-react'

import { usePersonalSettings } from '@/components/personal-settings-provider'
import { cn } from '@/lib/utils'
import type { PersonalFeatureId } from '@/lib/personal-settings'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  { href: '/docs/compare', label: 'Compare', icon: GitCompareArrows },
  {
    href: '/docs/openapi',
    label: 'OpenAPI',
    icon: Braces,
    featureId: 'openApi' as PersonalFeatureId,
  },
  {
    href: '/docs/analytics',
    label: 'Analytics',
    icon: BarChart3,
    featureId: 'analytics' as PersonalFeatureId,
  },
  {
    href: '/docs/templates',
    label: 'Templates',
    icon: LayoutTemplate,
    featureId: 'templates' as PersonalFeatureId,
  },
  {
    href: '/docs/approvals',
    label: 'Approvals',
    icon: ClipboardCheck,
    featureId: 'approvals' as PersonalFeatureId,
  },
  {
    href: '/docs/webhooks',
    label: 'Webhooks',
    icon: Webhook,
    featureId: 'webhooks' as PersonalFeatureId,
  },
  { href: '/docs/branding', label: 'Branding', icon: Palette },
  {
    href: '/docs/link-health',
    label: 'Link Health',
    icon: LinkIcon,
    featureId: 'linkHealth' as PersonalFeatureId,
  },
  {
    href: '/docs/components',
    label: 'Quick Insert',
    icon: Blocks,
    featureId: 'quickInsert' as PersonalFeatureId,
  },
  { href: '/docs/audit-logs', label: 'Audit Logs', icon: Shield },
  { href: '/docs/settings/members', label: 'Settings', icon: Settings },
] as const

const DESKTOP_NAV_LINK_CLASS =
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'
const DESKTOP_NAV_LINK_ACTIVE_CLASS = 'bg-accent/50 text-foreground'
const DESKTOP_NAV_LINK_IDLE_CLASS =
  'text-muted-foreground hover:bg-muted/60 hover:text-foreground'

function getVisibleCount(
  maxWidth: number,
  itemWidths: number[],
  overflowWidth: number,
) {
  let usedWidth = 0
  let count = 0

  for (let index = 0; index < itemWidths.length; index += 1) {
    const nextWidth = itemWidths[index]
    const hasOverflowAfterThisItem = index < itemWidths.length - 1
    const reservedOverflowWidth = hasOverflowAfterThisItem ? overflowWidth : 0

    if (
      count === 0 ||
      usedWidth + nextWidth + reservedOverflowWidth <= maxWidth
    ) {
      usedWidth += nextWidth
      count += 1
      continue
    }

    break
  }

  return count
}

function isActive(pathname: string, href: string) {
  if (href === '/docs') {
    return pathname === '/docs' || pathname.startsWith('/docs/editor')
  }
  if (href === '/docs/compare') {
    return pathname.startsWith('/docs/compare')
  }
  return pathname.startsWith(href)
}

export function DocsTopNav() {
  const pathname = usePathname()
  const { featureVisibility } = usePersonalSettings()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const desktopNavRef = React.useRef<HTMLDivElement | null>(null)
  const desktopMeasureRef = React.useRef<HTMLDivElement | null>(null)
  const navItems = React.useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) =>
          !('featureId' in item) || featureVisibility[item.featureId],
      ),
    [featureVisibility],
  )
  const [visibleCount, setVisibleCount] = React.useState<number>(navItems.length)

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

  const recomputeDesktopNav = React.useCallback(() => {
    if (!desktopNavRef.current || !desktopMeasureRef.current) return

    const maxWidth = Math.min(
      desktopNavRef.current.clientWidth,
      window.innerWidth * 0.5,
    )
    const measurements = Array.from(
      desktopMeasureRef.current.children,
    ) as HTMLElement[]

    if (measurements.length < navItems.length + 1) return

    const itemWidths = measurements
      .slice(0, navItems.length)
      .map((item) => item.offsetWidth)
    const overflowWidth = measurements.at(-1)?.offsetWidth ?? 0
    const nextVisibleCount = getVisibleCount(maxWidth, itemWidths, overflowWidth)

    setVisibleCount((currentCount) =>
      currentCount === nextVisibleCount ? currentCount : nextVisibleCount,
    )
  }, [navItems.length])

  React.useEffect(() => {
    recomputeDesktopNav()

    const navElement = desktopNavRef.current
    if (!navElement) return

    const resizeObserver = new ResizeObserver(() => {
      recomputeDesktopNav()
    })

    resizeObserver.observe(navElement)
    window.addEventListener('resize', recomputeDesktopNav)

    if ('fonts' in document) {
      void document.fonts.ready.then(() => {
        recomputeDesktopNav()
      })
    }

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', recomputeDesktopNav)
    }
  }, [navItems.length, recomputeDesktopNav])

  const visibleItems = navItems.slice(0, visibleCount)
  const overflowItems = navItems.slice(visibleCount)

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

        <div className="hidden flex-1 items-center gap-3 md:flex">
          <Separator orientation="vertical" className="!h-5 shrink-0" />

          <div
            ref={desktopNavRef}
            className="relative min-w-0 w-full max-w-[50vw]"
          >
            <nav className="flex min-w-0 items-center gap-1 overflow-hidden">
              {visibleItems.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      DESKTOP_NAV_LINK_CLASS,
                      active
                        ? DESKTOP_NAV_LINK_ACTIVE_CLASS
                        : DESKTOP_NAV_LINK_IDLE_CLASS,
                    )}
                  >
                    <item.icon className="size-3.5 shrink-0" />
                    {item.label}
                  </Link>
                )
              })}

              {overflowItems.length > 0 ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 px-2.5 text-xs text-muted-foreground"
                    >
                      More
                      <ChevronDown className="size-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>More</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {overflowItems.map((item) => {
                      const active = isActive(pathname, item.href)
                      return (
                        <DropdownMenuItem
                          key={item.href}
                          asChild
                          className={cn(
                            active && 'bg-accent/50 font-medium text-foreground',
                          )}
                        >
                          <Link href={item.href}>
                            <item.icon className="size-4" />
                            <span className="flex-1">{item.label}</span>
                          </Link>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </nav>

            <div
              ref={desktopMeasureRef}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 invisible flex w-max items-center gap-1"
            >
               {navItems.map((item) => (
                 <span
                   key={item.href}
                   className={cn(
                    DESKTOP_NAV_LINK_CLASS,
                    DESKTOP_NAV_LINK_IDLE_CLASS,
                  )}
                >
                  <item.icon className="size-3.5 shrink-0" />
                  {item.label}
                </span>
              ))}
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                More
                <ChevronDown className="size-3 opacity-60" />
              </span>
            </div>
          </div>
        </div>

        {/* Search trigger */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden shrink-0 items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground lg:inline-flex"
        >
          <Search className="size-3" />
          <span>Search docs…</span>
          <kbd className="ml-1 rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>

        {/* Utilities */}
        <div className="flex shrink-0 items-center gap-2">
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

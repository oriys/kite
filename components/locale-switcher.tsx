'use client'

import * as React from 'react'
import { Check, Globe, ChevronDown, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
] as const

interface LocaleSwitcherProps {
  currentLocale: string
  availableLocales?: { code: string; translationId?: string }[]
  pendingLocale?: string | null
  onLocaleChange: (locale: string, translationId: string | undefined, label: string) => void
}

export function LocaleSwitcher({
  currentLocale,
  availableLocales = [],
  pendingLocale = null,
  onLocaleChange,
}: LocaleSwitcherProps) {
  const [open, setOpen] = React.useState(false)

  const currentLabel =
    LOCALES.find((l) => l.code === currentLocale)?.label ?? currentLocale

  const mergedLocales = LOCALES.map((l) => {
    const available = availableLocales.find((a) => a.code === l.code)
    return {
      ...l,
      available: !!available || l.code === currentLocale,
      translationId: available?.translationId,
    }
  })

  const existingLocales = mergedLocales.filter((l) => l.available)
  const creatableLocales = mergedLocales.filter((l) => !l.available)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Globe className="h-3.5 w-3.5" />
          {currentLabel}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        {/* Existing translations */}
        <div className="flex flex-col">
          {existingLocales.map((locale) => {
            const isCurrent = locale.code === currentLocale
            const isPending = pendingLocale === locale.code

            return (
              <button
                key={locale.code}
                type="button"
                disabled={isPending}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors',
                  isCurrent
                    ? 'font-medium text-foreground'
                    : 'text-foreground hover:bg-accent/50',
                  isPending && 'opacity-50',
                )}
                onClick={() => {
                  if (isCurrent) return
                  onLocaleChange(locale.code, locale.translationId, locale.label)
                  setOpen(false)
                }}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {isPending ? (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  ) : isCurrent ? (
                    <Check className="size-3.5" />
                  ) : null}
                </span>
                <span className="flex-1 text-left">{locale.label}</span>
              </button>
            )
          })}
        </div>

        {/* Separator + creatable translations */}
        {creatableLocales.length > 0 ? (
          <>
            <div className="my-1 h-px bg-border" />
            <div className="flex flex-col">
              {creatableLocales.map((locale) => {
                const isPending = pendingLocale === locale.code

                return (
                  <button
                    key={locale.code}
                    type="button"
                    disabled={isPending}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground',
                      isPending && 'opacity-50',
                    )}
                    onClick={() => {
                      onLocaleChange(locale.code, locale.translationId, locale.label)
                    }}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Plus className="size-3 opacity-50" />
                      )}
                    </span>
                    <span className="flex-1 text-left">{locale.label}</span>
                  </button>
                )
              })}
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

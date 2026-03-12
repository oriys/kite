'use client'

import { Globe, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
  availableLocales?: { code: string; label?: string; documentId?: string }[]
  onLocaleChange: (locale: string, documentId?: string) => void
}

export function LocaleSwitcher({
  currentLocale,
  availableLocales = [],
  onLocaleChange,
}: LocaleSwitcherProps) {
  const currentLabel =
    LOCALES.find((l) => l.code === currentLocale)?.label ?? currentLocale

  const mergedLocales = LOCALES.map((l) => {
    const available = availableLocales.find((a) => a.code === l.code)
    return {
      ...l,
      available: !!available || l.code === currentLocale,
      documentId: available?.documentId,
    }
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Globe className="h-3.5 w-3.5" />
          {currentLabel}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {mergedLocales.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            disabled={!locale.available}
            className={
              locale.code === currentLocale ? 'bg-accent/10 font-medium' : ''
            }
            onClick={() => onLocaleChange(locale.code, locale.documentId)}
          >
            <span className="flex-1">{locale.label}</span>
            {!locale.available && (
              <span className="text-[10px] text-muted-foreground">—</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'

import { useAppearanceContext } from '@/components/appearance-provider'
import { ColorInput } from '@/components/settings/color-input'
import { ThemePreview } from '@/components/settings/theme-preview'
import {
  CODE_FONT_PRESETS,
  DARK_DEFAULTS,
  LIGHT_DEFAULTS,
  UI_FONT_PRESETS,
  type ThemeColorOverrides,
  type ThemeDefaults,
  type ThemeFontOverrides,
  type ThemePanelSettings,
} from '@/lib/appearance'
import { useMounted } from '@/hooks/use-mounted'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldTitle,
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type ThemeChoice = 'system' | 'light' | 'dark'

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemeChoice
  label: string
  icon: React.ComponentType<React.ComponentProps<'svg'>>
}> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

function normalizeThemeChoice(value: string | undefined): ThemeChoice {
  if (value === 'light' || value === 'dark') return value
  return 'system'
}

// --- Theme panel card (used twice: light + dark) ---

function ThemePanelCard({
  mode,
  panel,
  defaults,
  onColorChange,
  onFontChange,
  onContrastChange,
  onTranslucentSidebarChange,
  onReset,
}: {
  mode: 'light' | 'dark'
  panel: ThemePanelSettings
  defaults: ThemeDefaults
  onColorChange: (key: keyof ThemeColorOverrides, value: string | null) => void
  onFontChange: (key: keyof ThemeFontOverrides, value: string | null) => void
  onContrastChange: (value: number) => void
  onTranslucentSidebarChange: (value: boolean) => void
  onReset: () => void
}) {
  const hasOverrides =
    panel.colors.accent !== null ||
    panel.colors.background !== null ||
    panel.colors.foreground !== null ||
    panel.fonts.uiFont !== null ||
    panel.fonts.codeFont !== null ||
    panel.translucentSidebar ||
    panel.contrast !== (mode === 'light' ? 45 : 60)

  return (
    <Card>
      <CardHeader>
        <CardAction>
          <Badge variant="secondary">This browser</Badge>
        </CardAction>
        <CardTitle className="flex items-center gap-2">
          {mode === 'light' ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          {mode === 'light' ? 'Light theme' : 'Dark theme'}
        </CardTitle>
        <CardDescription>
          Override colors, fonts, and surface behavior for {mode} mode.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-4">
          {/* Colors */}
          <Field>
            <FieldTitle>Accent</FieldTitle>
            <FieldDescription>
              Used for focus rings, selections, and interactive highlights.
            </FieldDescription>
            <ColorInput
              value={panel.colors.accent}
              defaultValue={defaults.accent}
              onChange={(v) => onColorChange('accent', v)}
            />
          </Field>

          <FieldSeparator />

          <Field>
            <FieldTitle>Background</FieldTitle>
            <FieldDescription>
              The base surface color behind all content.
            </FieldDescription>
            <ColorInput
              value={panel.colors.background}
              defaultValue={defaults.background}
              onChange={(v) => onColorChange('background', v)}
            />
          </Field>

          <FieldSeparator />

          <Field>
            <FieldTitle>Foreground</FieldTitle>
            <FieldDescription>
              The primary text color used across the interface.
            </FieldDescription>
            <ColorInput
              value={panel.colors.foreground}
              defaultValue={defaults.foreground}
              onChange={(v) => onColorChange('foreground', v)}
            />
          </Field>

          <FieldSeparator />

          {/* Fonts */}
          <Field>
            <FieldTitle>UI font</FieldTitle>
            <FieldDescription>
              The typeface for headings, labels, and body text.
            </FieldDescription>
            <Select
              value={panel.fonts.uiFont ?? ''}
              onValueChange={(v) => onFontChange('uiFont', v || null)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Default (Geist)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Default (Geist)</SelectItem>
                {UI_FONT_PRESETS.slice(1).map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FieldSeparator />

          <Field>
            <FieldTitle>Code font</FieldTitle>
            <FieldDescription>
              The monospace typeface for code blocks and inline code.
            </FieldDescription>
            <Select
              value={panel.fonts.codeFont ?? ''}
              onValueChange={(v) => onFontChange('codeFont', v || null)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Default (Geist Mono)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Default (Geist Mono)</SelectItem>
                {CODE_FONT_PRESETS.slice(1).map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FieldSeparator />

          {/* Contrast */}
          <Field>
            <FieldTitle>Contrast</FieldTitle>
            <FieldDescription>
              Shift lightness of background and foreground for more or less contrast.
            </FieldDescription>
            <div className="flex items-center gap-4">
              <Slider
                value={[panel.contrast]}
                onValueChange={([v]) => onContrastChange(v)}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                {panel.contrast}
              </span>
            </div>
          </Field>

          <FieldSeparator />

          {/* Translucent sidebar */}
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={`translucent-sidebar-${mode}`}>
                Translucent sidebar
              </FieldLabel>
              <FieldDescription>
                Add transparency to the sidebar background.
              </FieldDescription>
            </FieldContent>
            <Switch
              id={`translucent-sidebar-${mode}`}
              checked={panel.translucentSidebar}
              onCheckedChange={onTranslucentSidebarChange}
            />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Overrides apply only to {mode} mode.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={!hasOverrides}
        >
          <RotateCcw data-icon="inline-start" />
          Reset {mode}
        </Button>
      </CardFooter>
    </Card>
  )
}

// --- Main page ---

export function AppearanceSettingsPage() {
  const mounted = useMounted()
  const { theme, setTheme } = useTheme()
  const appearance = useAppearanceContext()
  const {
    settings,
    setLightColor,
    setDarkColor,
    setLightFont,
    setDarkFont,
    setLightContrast,
    setDarkContrast,
    setLightTranslucentSidebar,
    setDarkTranslucentSidebar,
    setPointerCursors,
    resetLightToDefaults,
    resetDarkToDefaults,
  } = appearance

  const selectedTheme = normalizeThemeChoice(mounted ? theme : undefined)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/docs/settings/personal"
            className="transition-colors hover:text-foreground"
          >
            Personal settings
          </Link>
          <span>/</span>
          <span className="text-foreground">Appearance</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Customize how Kite looks in this browser — override colors, fonts,
          contrast, and interface behavior for each theme mode independently.
        </p>
      </div>

      {/* Color theme */}
      <Card>
        <CardHeader>
          <CardAction>
            <Badge variant="secondary">This browser</Badge>
          </CardAction>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4" />
            Color theme
          </CardTitle>
          <CardDescription>
            Pick a fixed light or dark theme, or follow the system setting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            variant="outline"
            value={selectedTheme}
            onValueChange={(value) => {
              if (value) setTheme(normalizeThemeChoice(value))
            }}
            className="flex w-full flex-wrap"
          >
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  disabled={!mounted}
                  className="flex-1"
                >
                  <Icon />
                  {option.label}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </CardContent>
      </Card>

      {/* Theme preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Side-by-side view of your current light and dark theme configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePreview light={settings.light} dark={settings.dark} />
        </CardContent>
      </Card>

      {/* Light theme */}
      <ThemePanelCard
        mode="light"
        panel={settings.light}
        defaults={LIGHT_DEFAULTS}
        onColorChange={setLightColor}
        onFontChange={setLightFont}
        onContrastChange={setLightContrast}
        onTranslucentSidebarChange={setLightTranslucentSidebar}
        onReset={resetLightToDefaults}
      />

      {/* Dark theme */}
      <ThemePanelCard
        mode="dark"
        panel={settings.dark}
        defaults={DARK_DEFAULTS}
        onColorChange={setDarkColor}
        onFontChange={setDarkFont}
        onContrastChange={setDarkContrast}
        onTranslucentSidebarChange={setDarkTranslucentSidebar}
        onReset={resetDarkToDefaults}
      />

      {/* Pointer cursors */}
      <Card>
        <CardHeader>
          <CardAction>
            <Badge variant="secondary">This browser</Badge>
          </CardAction>
          <CardTitle>Pointer cursors</CardTitle>
          <CardDescription>
            Use a pointer cursor on interactive elements like buttons, switches,
            and selects instead of the default arrow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="pointer-cursors">
                Enable pointer cursors
              </FieldLabel>
              <FieldDescription>
                Some designers prefer the default arrow; others find the pointer
                more intuitive. This is purely cosmetic.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="pointer-cursors"
              checked={settings.pointerCursors}
              onCheckedChange={setPointerCursors}
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  )
}

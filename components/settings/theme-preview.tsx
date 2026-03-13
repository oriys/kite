'use client'

import { oklchToHex } from '@/lib/color-utils'
import {
  DARK_DEFAULTS,
  LIGHT_DEFAULTS,
  type ThemeDefaults,
  type ThemePanelSettings,
} from '@/lib/appearance'

interface ThemePreviewProps {
  light: ThemePanelSettings
  dark: ThemePanelSettings
}

function PreviewPanel({
  label,
  panel,
  defaults,
}: {
  label: string
  panel: ThemePanelSettings
  defaults: ThemeDefaults
}) {
  const bg = oklchToHex(panel.colors.background ?? defaults.background)
  const fg = oklchToHex(panel.colors.foreground ?? defaults.foreground)
  const accent = oklchToHex(panel.colors.accent ?? defaults.accent)

  return (
    <div
      className="flex-1 overflow-hidden rounded-md border border-border/70"
      style={{ backgroundColor: bg, color: fg }}
    >
      <div className="border-b px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] opacity-60">
        {label}
      </div>
      <pre className="px-3 py-3 font-mono text-[11px] leading-5">
        <span className="opacity-50">{'const '}</span>
        <span>theme</span>
        <span className="opacity-50">{' = {\n'}</span>
        <span className="opacity-50">{'  background: '}</span>
        <span>&quot;{bg}&quot;</span>
        <span className="opacity-50">{',\n'}</span>
        <span className="opacity-50">{'  foreground: '}</span>
        <span>&quot;{fg}&quot;</span>
        <span className="opacity-50">{',\n'}</span>
        <span className="opacity-50">{'  accent: '}</span>
        <span style={{ color: accent }}>&quot;{accent}&quot;</span>
        <span className="opacity-50">{',\n'}</span>
        <span className="opacity-50">{'  contrast: '}</span>
        <span>{panel.contrast}</span>
        <span className="opacity-50">{',\n};\n'}</span>
      </pre>
    </div>
  )
}

export function ThemePreview({ light, dark }: ThemePreviewProps) {
  return (
    <div className="flex gap-3">
      <PreviewPanel label="Light" panel={light} defaults={LIGHT_DEFAULTS} />
      <PreviewPanel label="Dark" panel={dark} defaults={DARK_DEFAULTS} />
    </div>
  )
}

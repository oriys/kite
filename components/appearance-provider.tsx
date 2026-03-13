'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'

import { useAppearance, type UseAppearanceReturn } from '@/hooks/use-appearance'
import { parseOklch } from '@/lib/color-utils'
import {
  DARK_DEFAULTS,
  LIGHT_DEFAULTS,
  type ThemeDefaults,
  type ThemePanelSettings,
} from '@/lib/appearance'

const AppearanceContext = React.createContext<UseAppearanceReturn | null>(null)

export function useAppearanceContext() {
  const ctx = React.useContext(AppearanceContext)
  if (!ctx) {
    throw new Error('useAppearanceContext must be used within AppearanceProvider')
  }
  return ctx
}

/**
 * Shift lightness of an OKLCH string by a delta.
 * Positive delta = lighter, negative delta = darker.
 */
function shiftLightness(oklch: string, delta: number): string {
  const parsed = parseOklch(oklch)
  if (!parsed) return oklch
  const [L, C, H] = parsed
  const newL = Math.min(1, Math.max(0, L + delta))
  return `oklch(${newL.toFixed(3)} ${C} ${H})`
}

function applyPanelOverrides(
  panel: ThemePanelSettings,
  defaults: ThemeDefaults,
  defaultContrast: number,
) {
  const style = document.documentElement.style

  // --- Colors ---
  const accent = panel.colors.accent
  if (accent) {
    style.setProperty('--accent', accent)
  } else {
    style.removeProperty('--accent')
  }

  // Background/foreground with contrast shift
  const contrastDelta = (panel.contrast - defaultContrast) / 500
  const bg = panel.colors.background ?? defaults.background
  const fg = panel.colors.foreground ?? defaults.foreground

  if (panel.colors.background || contrastDelta !== 0) {
    style.setProperty('--background', shiftLightness(bg, contrastDelta))
  } else {
    style.removeProperty('--background')
  }

  if (panel.colors.foreground || contrastDelta !== 0) {
    style.setProperty('--foreground', shiftLightness(fg, -contrastDelta))
  } else {
    style.removeProperty('--foreground')
  }

  // --- Fonts ---
  if (panel.fonts.uiFont) {
    style.setProperty('--font-sans', panel.fonts.uiFont)
  } else {
    style.removeProperty('--font-sans')
  }

  if (panel.fonts.codeFont) {
    style.setProperty('--font-mono', panel.fonts.codeFont)
  } else {
    style.removeProperty('--font-mono')
  }

  // --- Translucent sidebar ---
  if (panel.translucentSidebar) {
    const sidebarBase = defaults.sidebar
    const parsed = parseOklch(sidebarBase)
    if (parsed) {
      const [L, C, H] = parsed
      style.setProperty('--sidebar', `oklch(${L} ${C} ${H} / 0.85)`)
    }
  } else {
    style.removeProperty('--sidebar')
  }
}

function clearOverrides() {
  const style = document.documentElement.style
  const props = [
    '--accent', '--background', '--foreground',
    '--font-sans', '--font-mono', '--sidebar',
  ]
  for (const prop of props) {
    style.removeProperty(prop)
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const appearance = useAppearance()
  const { resolvedTheme } = useTheme()
  const { settings } = appearance

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    // Clear all overrides first so we start clean
    clearOverrides()

    const isDark = resolvedTheme === 'dark'
    const panel = isDark ? settings.dark : settings.light
    const defaults = isDark ? DARK_DEFAULTS : LIGHT_DEFAULTS
    const defaultContrast = isDark ? 60 : 45

    applyPanelOverrides(panel, defaults, defaultContrast)

    // --- Pointer cursors ---
    if (settings.pointerCursors) {
      document.documentElement.classList.add('use-pointer-cursors')
    } else {
      document.documentElement.classList.remove('use-pointer-cursors')
    }
  }, [settings, resolvedTheme])

  return (
    <AppearanceContext.Provider value={appearance}>
      {children}
    </AppearanceContext.Provider>
  )
}

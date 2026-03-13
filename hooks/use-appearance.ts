'use client'

import * as React from 'react'

import {
  APPEARANCE_STORAGE_KEY,
  DARK_CONTRAST_DEFAULT,
  DEFAULT_APPEARANCE_SETTINGS,
  LIGHT_CONTRAST_DEFAULT,
  mergeAppearanceSettings,
  type AppearanceSettings,
  type ThemeColorOverrides,
  type ThemeFontOverrides,
} from '@/lib/appearance'

function readStored(): AppearanceSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE_SETTINGS }

  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_APPEARANCE_SETTINGS }
    return mergeAppearanceSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_APPEARANCE_SETTINGS }
  }
}

function persist(settings: AppearanceSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings))
}

export function useAppearance() {
  const [settings, setSettingsState] = React.useState<AppearanceSettings>(
    () => DEFAULT_APPEARANCE_SETTINGS,
  )

  React.useEffect(() => {
    setSettingsState(readStored())
  }, [])

  const update = React.useCallback(
    (fn: (prev: AppearanceSettings) => AppearanceSettings) => {
      setSettingsState((prev) => {
        const next = fn(prev)
        persist(next)
        return next
      })
    },
    [],
  )

  // --- Light color setters ---
  const setLightColor = React.useCallback(
    (key: keyof ThemeColorOverrides, value: string | null) => {
      update((s) => ({
        ...s,
        light: { ...s.light, colors: { ...s.light.colors, [key]: value } },
      }))
    },
    [update],
  )

  // --- Dark color setters ---
  const setDarkColor = React.useCallback(
    (key: keyof ThemeColorOverrides, value: string | null) => {
      update((s) => ({
        ...s,
        dark: { ...s.dark, colors: { ...s.dark.colors, [key]: value } },
      }))
    },
    [update],
  )

  // --- Light font setters ---
  const setLightFont = React.useCallback(
    (key: keyof ThemeFontOverrides, value: string | null) => {
      update((s) => ({
        ...s,
        light: { ...s.light, fonts: { ...s.light.fonts, [key]: value } },
      }))
    },
    [update],
  )

  // --- Dark font setters ---
  const setDarkFont = React.useCallback(
    (key: keyof ThemeFontOverrides, value: string | null) => {
      update((s) => ({
        ...s,
        dark: { ...s.dark, fonts: { ...s.dark.fonts, [key]: value } },
      }))
    },
    [update],
  )

  // --- Contrast ---
  const setLightContrast = React.useCallback(
    (value: number) => {
      update((s) => ({ ...s, light: { ...s.light, contrast: value } }))
    },
    [update],
  )

  const setDarkContrast = React.useCallback(
    (value: number) => {
      update((s) => ({ ...s, dark: { ...s.dark, contrast: value } }))
    },
    [update],
  )

  // --- Translucent sidebar ---
  const setLightTranslucentSidebar = React.useCallback(
    (value: boolean) => {
      update((s) => ({ ...s, light: { ...s.light, translucentSidebar: value } }))
    },
    [update],
  )

  const setDarkTranslucentSidebar = React.useCallback(
    (value: boolean) => {
      update((s) => ({ ...s, dark: { ...s.dark, translucentSidebar: value } }))
    },
    [update],
  )

  // --- Pointer cursors ---
  const setPointerCursors = React.useCallback(
    (value: boolean) => {
      update((s) => ({ ...s, pointerCursors: value }))
    },
    [update],
  )

  // --- Resets ---
  const resetToDefaults = React.useCallback(() => {
    const next = { ...DEFAULT_APPEARANCE_SETTINGS }
    persist(next)
    setSettingsState(next)
  }, [])

  const resetLightToDefaults = React.useCallback(() => {
    update((s) => ({
      ...s,
      light: {
        colors: { accent: null, background: null, foreground: null },
        fonts: { uiFont: null, codeFont: null },
        translucentSidebar: false,
        contrast: LIGHT_CONTRAST_DEFAULT,
      },
    }))
  }, [update])

  const resetDarkToDefaults = React.useCallback(() => {
    update((s) => ({
      ...s,
      dark: {
        colors: { accent: null, background: null, foreground: null },
        fonts: { uiFont: null, codeFont: null },
        translucentSidebar: false,
        contrast: DARK_CONTRAST_DEFAULT,
      },
    }))
  }, [update])

  return {
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
    resetToDefaults,
    resetLightToDefaults,
    resetDarkToDefaults,
  }
}

export type UseAppearanceReturn = ReturnType<typeof useAppearance>

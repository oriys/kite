// Appearance settings types, defaults, and constants

export interface ThemeColorOverrides {
  accent: string | null       // OKLCH string
  background: string | null
  foreground: string | null
}

export interface ThemeFontOverrides {
  uiFont: string | null       // font-family string
  codeFont: string | null
}

export interface ThemePanelSettings {
  colors: ThemeColorOverrides
  fonts: ThemeFontOverrides
  translucentSidebar: boolean
  contrast: number            // 0–100
}

export interface AppearanceSettings {
  light: ThemePanelSettings
  dark: ThemePanelSettings
  pointerCursors: boolean
}

// --- Storage key ---

export const APPEARANCE_STORAGE_KEY = 'kite-appearance'

// --- Default OKLCH values extracted from globals.css ---

export interface ThemeDefaults {
  accent: string
  background: string
  foreground: string
  sidebar: string
}

export const LIGHT_DEFAULTS: ThemeDefaults = {
  accent: 'oklch(0.946 0.015 244)',
  background: 'oklch(0.984 0.003 95)',
  foreground: 'oklch(0.276 0.007 85)',
  sidebar: 'oklch(0.979 0.003 95)',
}

export const DARK_DEFAULTS: ThemeDefaults = {
  accent: 'oklch(0.348 0.026 244)',
  background: 'oklch(0.218 0.006 85)',
  foreground: 'oklch(0.958 0.004 95)',
  sidebar: 'oklch(0.205 0.006 85)',
}

// --- Font presets ---

export interface FontPreset {
  label: string
  value: string  // font-family string
}

export const UI_FONT_PRESETS: FontPreset[] = [
  { label: 'Geist (default)', value: "'Geist', 'Geist Fallback'" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'IBM Plex Sans', value: "'IBM Plex Sans', sans-serif" },
  { label: 'Source Sans 3', value: "'Source Sans 3', sans-serif" },
  { label: 'System UI', value: 'system-ui, sans-serif' },
]

export const CODE_FONT_PRESETS: FontPreset[] = [
  { label: 'Geist Mono (default)', value: "'Geist Mono', 'Geist Mono Fallback'" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { label: 'Fira Code', value: "'Fira Code', monospace" },
  { label: 'IBM Plex Mono', value: "'IBM Plex Mono', monospace" },
  { label: 'Source Code Pro', value: "'Source Code Pro', monospace" },
]

// --- Default contrast values ---

export const LIGHT_CONTRAST_DEFAULT = 45
export const DARK_CONTRAST_DEFAULT = 60

// --- Defaults ---

function defaultPanelSettings(contrast: number): ThemePanelSettings {
  return {
    colors: { accent: null, background: null, foreground: null },
    fonts: { uiFont: null, codeFont: null },
    translucentSidebar: false,
    contrast,
  }
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  light: defaultPanelSettings(LIGHT_CONTRAST_DEFAULT),
  dark: defaultPanelSettings(DARK_CONTRAST_DEFAULT),
  pointerCursors: false,
}

// --- Safe hydration from localStorage ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeColors(raw: unknown): ThemeColorOverrides {
  const defaults: ThemeColorOverrides = { accent: null, background: null, foreground: null }
  if (!isRecord(raw)) return defaults
  return {
    accent: typeof raw.accent === 'string' ? raw.accent : null,
    background: typeof raw.background === 'string' ? raw.background : null,
    foreground: typeof raw.foreground === 'string' ? raw.foreground : null,
  }
}

function mergeFonts(raw: unknown): ThemeFontOverrides {
  const defaults: ThemeFontOverrides = { uiFont: null, codeFont: null }
  if (!isRecord(raw)) return defaults
  return {
    uiFont: typeof raw.uiFont === 'string' ? raw.uiFont : null,
    codeFont: typeof raw.codeFont === 'string' ? raw.codeFont : null,
  }
}

function mergePanel(raw: unknown, defaultContrast: number): ThemePanelSettings {
  if (!isRecord(raw)) return defaultPanelSettings(defaultContrast)
  return {
    colors: mergeColors(raw.colors),
    fonts: mergeFonts(raw.fonts),
    translucentSidebar: typeof raw.translucentSidebar === 'boolean' ? raw.translucentSidebar : false,
    contrast:
      typeof raw.contrast === 'number' && raw.contrast >= 0 && raw.contrast <= 100
        ? raw.contrast
        : defaultContrast,
  }
}

export function mergeAppearanceSettings(raw: unknown): AppearanceSettings {
  if (!isRecord(raw)) return { ...DEFAULT_APPEARANCE_SETTINGS }
  return {
    light: mergePanel(raw.light, LIGHT_CONTRAST_DEFAULT),
    dark: mergePanel(raw.dark, DARK_CONTRAST_DEFAULT),
    pointerCursors: typeof raw.pointerCursors === 'boolean' ? raw.pointerCursors : false,
  }
}

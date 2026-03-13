// Pure-math OKLCH ↔ sRGB ↔ hex conversion (no DOM dependency)
// Reference: https://bottosson.github.io/posts/oklab/

// --- Linear sRGB ↔ sRGB transfer ---

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

// --- OKLab ↔ Linear sRGB ---

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
}

function linearSrgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ]
}

// --- OKLCH ↔ OKLab ---

function oklchToOklab(L: number, C: number, H: number): [number, number, number] {
  const hRad = (H * Math.PI) / 180
  return [L, C * Math.cos(hRad), C * Math.sin(hRad)]
}

function oklabToOklch(L: number, a: number, b: number): [number, number, number] {
  const C = Math.sqrt(a * a + b * b)
  let H = (Math.atan2(b, a) * 180) / Math.PI
  if (H < 0) H += 360
  return [L, C, H]
}

// --- Clamp to 0–255 ---

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function toHexByte(v: number): string {
  return Math.round(clamp01(v) * 255)
    .toString(16)
    .padStart(2, '0')
}

// --- Public API ---

const OKLCH_RE = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/

/**
 * Parse an OKLCH string like "oklch(0.984 0.003 95)" into [L, C, H].
 * Returns null if the string doesn't match.
 */
export function parseOklch(oklch: string): [number, number, number] | null {
  const m = OKLCH_RE.exec(oklch.trim())
  if (!m) return null
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]
}

/**
 * Convert an OKLCH string to a hex color (#RRGGBB).
 * Returns "#000000" if the input is invalid.
 */
export function oklchToHex(oklch: string): string {
  const parsed = parseOklch(oklch)
  if (!parsed) return '#000000'

  const [L, C, H] = parsed
  const [labL, labA, labB] = oklchToOklab(L, C, H)
  const [lr, lg, lb] = oklabToLinearSrgb(labL, labA, labB)

  return `#${toHexByte(linearToSrgb(lr))}${toHexByte(linearToSrgb(lg))}${toHexByte(linearToSrgb(lb))}`
}

/**
 * Convert a hex color (#RGB, #RRGGBB) to an OKLCH string.
 * Returns "oklch(0 0 0)" if the input is invalid.
 */
export function hexToOklch(hex: string): string {
  const normalized = normalizeHex(hex)
  if (!normalized) return 'oklch(0 0 0)'

  const r = parseInt(normalized.slice(1, 3), 16) / 255
  const g = parseInt(normalized.slice(3, 5), 16) / 255
  const b = parseInt(normalized.slice(5, 7), 16) / 255

  const [labL, labA, labB] = linearSrgbToOklab(
    srgbToLinear(r),
    srgbToLinear(g),
    srgbToLinear(b),
  )
  const [L, C, H] = oklabToOklch(labL, labA, labB)

  const fL = round(L, 3)
  const fC = round(C, 3)
  const fH = round(H, 0)

  return `oklch(${fL} ${fC} ${fH})`
}

/**
 * Validate and normalize a hex string to #RRGGBB format.
 * Returns null if invalid.
 */
function normalizeHex(hex: string): string | null {
  const trimmed = hex.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return null
}

/**
 * Check if a string is a valid hex color (#RGB or #RRGGBB).
 */
export function isValidHex(value: string): boolean {
  return normalizeHex(value) !== null
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

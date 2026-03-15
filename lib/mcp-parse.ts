/**
 * Shared parsing utilities for MCP server API routes.
 */

export function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseJsonStringArray(value: unknown): string[] | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        return parsed
      }
    } catch {
      return trimmed
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    }
  }
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return value
  }
  return null
}

export function parseJsonRecord(
  value: unknown,
): Record<string, string> | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return {}
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>
      }
    } catch {
      const result: Record<string, string> = {}
      for (const line of trimmed.split('\n')) {
        const eqIdx = line.indexOf('=')
        if (eqIdx > 0) {
          result[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim()
        }
      }
      return Object.keys(result).length > 0 ? result : null
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>
  }
  return null
}

interface EndpointChange {
  path: string
  method: string
  summary?: string
  changes?: { field: string; from: unknown; to: unknown }[]
}

interface ChangelogInput {
  version: string
  previousVersion?: string
  added: EndpointChange[]
  removed: EndpointChange[]
  changed: EndpointChange[]
  generatedAt: Date
}

function formatMethod(method: string): string {
  return `**${method.toUpperCase()}**`
}

function formatEndpoint(ep: EndpointChange): string {
  const summary = ep.summary ? ` — ${ep.summary}` : ''
  return `- ${formatMethod(ep.method)} \`${ep.path}\`${summary}`
}

function formatChangedEndpoint(ep: EndpointChange): string {
  const lines = [formatEndpoint(ep)]

  if (ep.changes && ep.changes.length > 0) {
    for (const change of ep.changes) {
      const from =
        change.from === undefined ? '_none_' : `\`${JSON.stringify(change.from)}\``
      const to =
        change.to === undefined ? '_none_' : `\`${JSON.stringify(change.to)}\``
      lines.push(`  - \`${change.field}\`: ${from} → ${to}`)
    }
  }

  return lines.join('\n')
}

function isBreaking(ep: EndpointChange): boolean {
  if (!ep.changes) return false
  return ep.changes.some(
    (c) =>
      c.field.includes('required') ||
      c.field.includes('type') ||
      c.field.includes('removed'),
  )
}

export function generateChangelog(input: ChangelogInput): string {
  const lines: string[] = []
  const dateStr = input.generatedAt.toISOString().split('T')[0]
  const prev = input.previousVersion
    ? ` (compared to ${input.previousVersion})`
    : ''

  lines.push(`# Changelog — ${input.version}`)
  lines.push('')
  lines.push(`_Generated on ${dateStr}${prev}_`)
  lines.push('')

  // Breaking changes: removed endpoints + changed endpoints with breaking fields
  const breakingRemoved = input.removed
  const breakingChanged = input.changed.filter(isBreaking)

  if (breakingRemoved.length > 0 || breakingChanged.length > 0) {
    lines.push('## ⚠️ Breaking Changes')
    lines.push('')
    for (const ep of breakingRemoved) {
      lines.push(`- ${formatMethod(ep.method)} \`${ep.path}\` — **Removed**${ep.summary ? ` (${ep.summary})` : ''}`)
    }
    for (const ep of breakingChanged) {
      lines.push(formatChangedEndpoint(ep))
    }
    lines.push('')
  }

  // New endpoints
  if (input.added.length > 0) {
    lines.push('## ✨ New Endpoints')
    lines.push('')
    for (const ep of input.added) {
      lines.push(formatEndpoint(ep))
    }
    lines.push('')
  }

  // Changed endpoints (non-breaking)
  const nonBreakingChanged = input.changed.filter((ep) => !isBreaking(ep))
  if (nonBreakingChanged.length > 0) {
    lines.push('## 🔄 Changed')
    lines.push('')
    for (const ep of nonBreakingChanged) {
      lines.push(formatChangedEndpoint(ep))
    }
    lines.push('')
  }

  // Removed (if any were not already shown as breaking)
  // All removed are breaking, so nothing extra here

  if (
    input.added.length === 0 &&
    input.removed.length === 0 &&
    input.changed.length === 0
  ) {
    lines.push('_No changes detected._')
    lines.push('')
  }

  lines.push('---')
  lines.push(
    `_Total: ${input.added.length} added, ${input.changed.length} changed, ${input.removed.length} removed_`,
  )

  return lines.join('\n')
}

export type { ChangelogInput, EndpointChange }

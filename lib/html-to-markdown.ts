import TurndownService from 'turndown'
import {
  normalizeCodeLanguage,
} from '@/lib/code-highlighting'
import {
  createDefaultHeatmapDocument,
  decodeHeatmapSource,
  HEATMAP_FENCE_LANGUAGE,
  serializeHeatmapDocument,
} from '@/lib/heatmap'

// ── Table helpers ──────────────────────────────────────────────────────────

function parsePixelSize(value: string | null | undefined) {
  if (!value) return null
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/)
  return match ? Number(match[1]) : null
}

function getTableColGroup(table: HTMLTableElement) {
  return (
    Array.from(table.children).find(
      (child): child is HTMLTableColElement => child.tagName === 'COLGROUP',
    ) ?? null
  )
}

function hasCustomColumnSizing(table: HTMLTableElement) {
  if (parsePixelSize(table.style.width)) return true
  if (getTableColGroup(table)?.querySelector('col[style*="width"]')) return true
  return Array.from(table.rows).some((row) =>
    Array.from(row.cells).some((cell) => Boolean(parsePixelSize(cell.style.width))),
  )
}

function hasCustomTableSizing(table: HTMLTableElement) {
  if (hasCustomColumnSizing(table)) return true
  return Array.from(table.rows).some(
    (row) =>
      Boolean(parsePixelSize(row.style.height)) ||
      Array.from(row.cells).some((cell) => Boolean(parsePixelSize(cell.style.height))),
  )
}

function serializeTableHtml(table: HTMLTableElement) {
  const clone = table.cloneNode(true) as HTMLTableElement
  clone.querySelectorAll('colgroup, col, tr, th, td').forEach((element) => {
    if (!(element instanceof HTMLElement)) return
    if (!element.getAttribute('style')?.trim()) element.removeAttribute('style')
  })
  if (!clone.getAttribute('style')?.trim()) clone.removeAttribute('style')
  return clone.outerHTML
}

// ── Turndown configuration ────────────────────────────────────────────────

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
})

turndown.addRule('jsonViewer', {
  filter: (node) =>
    node instanceof HTMLElement &&
    node.classList.contains('doc-json-viewer') &&
    Boolean(node.dataset.docJson),
  replacement: (_content, node) => {
    const encoded = (node as HTMLElement).dataset.docJson ?? ''
    try {
      const json = decodeURIComponent(encoded)
      return `\n\`\`\`json\n${json}\n\`\`\`\n`
    } catch {
      return '\n```json\n{}\n```\n'
    }
  },
})

turndown.addRule('schemaTree', {
  filter: (node) =>
    node instanceof HTMLElement &&
    node.classList.contains('doc-schema-viewer') &&
    Boolean(node.dataset.docSchema),
  replacement: (_content, node) => {
    const encoded = (node as HTMLElement).dataset.docSchema ?? ''
    try {
      return `\n${decodeURIComponent(encoded)}\n`
    } catch {
      return ''
    }
  },
})

turndown.addRule('heatmap', {
  filter: (node) =>
    node instanceof HTMLElement &&
    node.classList.contains('doc-heatmap') &&
    Boolean(node.dataset.docHeatmap),
  replacement: (_content, node) => {
    const encodedSource = (node as HTMLElement).dataset.docHeatmap ?? ''
    const source = decodeHeatmapSource(encodedSource)
    if (!source) {
      return `\n\`\`\`${HEATMAP_FENCE_LANGUAGE}\n${serializeHeatmapDocument(createDefaultHeatmapDocument())}\n\`\`\`\n`
    }
    return `\n\`\`\`${HEATMAP_FENCE_LANGUAGE}\n${source}\n\`\`\`\n`
  },
})

turndown.addRule('codeBlock', {
  filter: (node) =>
    node instanceof HTMLPreElement &&
    !node.closest('.doc-json-viewer') &&
    node.querySelector('code') !== null,
  replacement: (_content, node) => {
    const pre = node as HTMLPreElement
    const code = pre.querySelector('code')
    const className = code?.className ?? ''
    const classMatch = className.match(/language-([A-Za-z0-9+#._-]+)/)
    const language = normalizeCodeLanguage(
      pre.dataset.codeLanguage ?? classMatch?.[1] ?? '',
    )
    const value =
      code?.textContent?.replace(/\u00a0/g, ' ').replace(/\n$/, '') ?? ''
    const info = language !== 'text' ? language : ''
    return `\n\`\`\`${info}\n${value}\n\`\`\`\n`
  },
})

turndown.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (content) => `~~${content}~~`,
})

turndown.addRule('table', {
  filter: 'table',
  replacement: (_content, node) => {
    const table = node as HTMLTableElement
    if (hasCustomTableSizing(table)) {
      return `\n${serializeTableHtml(table)}\n`
    }
    const rows: string[][] = []
    table.querySelectorAll('tr').forEach((tr) => {
      const cells: string[] = []
      tr.querySelectorAll('th, td').forEach((cell) => {
        cells.push(cell.textContent?.trim() ?? '')
      })
      rows.push(cells)
    })
    if (rows.length === 0) return ''
    const colCount = Math.max(...rows.map((r) => r.length))
    const header = rows[0]
    const divider = Array.from({ length: colCount }, () => '---')
    const body = rows.slice(1)
    const fmt = (r: string[]) => `| ${r.join(' | ')} |`
    return `\n${fmt(header)}\n${fmt(divider)}\n${body.map(fmt).join('\n')}\n`
  },
})

export function htmlToMd(html: string): string {
  return turndown.turndown(html)
}

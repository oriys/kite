import { escapeHtml } from '@/lib/utils'

export const HEATMAP_FENCE_LANGUAGE = 'heatmap'

export interface HeatmapRow {
  label: string
  values: number[]
}

export interface HeatmapDocument {
  title: string
  description: string
  columns: string[]
  rows: HeatmapRow[]
  minLabel: string
  maxLabel: string
}

const DEFAULT_COLUMNS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DEFAULT_ROWS: HeatmapRow[] = [
  { label: 'API Platform', values: [28, 46, 54, 72, 61] },
  { label: 'Growth', values: [14, 32, 37, 58, 44] },
  { label: 'Payments', values: [22, 41, 49, 67, 53] },
  { label: 'Support Ops', values: [9, 18, 26, 34, 29] },
]

export const DEFAULT_HEATMAP_DOCUMENT: HeatmapDocument = {
  title: 'Docs review load',
  description: 'Track which teams and weekdays produce the heaviest review queue.',
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_ROWS,
  minLabel: 'Quiet',
  maxLabel: 'Hot',
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function clampHeatmapValue(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)))
}

function normalizeColumns(value: unknown) {
  if (!Array.isArray(value)) {
    return [...DEFAULT_HEATMAP_DOCUMENT.columns]
  }

  const columns = value
    .map((label, index) => normalizeText(label, `Column ${index + 1}`))
    .slice(0, 12)

  return columns.length > 0 ? columns : [...DEFAULT_HEATMAP_DOCUMENT.columns]
}

function normalizeRows(value: unknown, columnCount: number) {
  if (!Array.isArray(value)) {
    return DEFAULT_HEATMAP_DOCUMENT.rows.map((row) => ({
      label: row.label,
      values: row.values.slice(0, columnCount),
    }))
  }

  const rows = value
    .map((row, index) => {
      const rawRow = row as Partial<HeatmapRow> | null
      const values = Array.isArray(rawRow?.values)
        ? rawRow.values.slice(0, columnCount).map(clampHeatmapValue)
        : []

      while (values.length < columnCount) {
        values.push(0)
      }

      return {
        label: normalizeText(rawRow?.label, `Row ${index + 1}`),
        values,
      }
    })
    .slice(0, 12)

  return rows.length > 0
    ? rows
    : DEFAULT_HEATMAP_DOCUMENT.rows.map((row) => ({
        label: row.label,
        values: row.values.slice(0, columnCount),
      }))
}

export function normalizeHeatmapDocument(input: unknown): HeatmapDocument {
  const raw = (input ?? {}) as Partial<HeatmapDocument>
  const columns = normalizeColumns(raw.columns)
  const rows = normalizeRows(raw.rows, columns.length)

  return {
    title: normalizeText(raw.title, DEFAULT_HEATMAP_DOCUMENT.title),
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    columns,
    rows,
    minLabel: normalizeText(raw.minLabel, DEFAULT_HEATMAP_DOCUMENT.minLabel),
    maxLabel: normalizeText(raw.maxLabel, DEFAULT_HEATMAP_DOCUMENT.maxLabel),
  }
}

export function createDefaultHeatmapDocument() {
  return normalizeHeatmapDocument(DEFAULT_HEATMAP_DOCUMENT)
}

export function serializeHeatmapDocument(data: HeatmapDocument) {
  return JSON.stringify(normalizeHeatmapDocument(data), null, 2)
}

export function parseHeatmapDocument(source: string) {
  try {
    return normalizeHeatmapDocument(JSON.parse(source))
  } catch {
    return null
  }
}

export function encodeHeatmapSource(source: string) {
  return encodeURIComponent(source)
}

export function decodeHeatmapSource(encodedSource: string) {
  try {
    return decodeURIComponent(encodedSource)
  } catch {
    return null
  }
}

export function decodeHeatmapDocument(encodedSource: string) {
  const source = decodeHeatmapSource(encodedSource)

  if (!source) {
    return null
  }

  return parseHeatmapDocument(source)
}

export function createHeatmapSnippetTemplate() {
  return `## Heatmap

\`\`\`${HEATMAP_FENCE_LANGUAGE}
${serializeHeatmapDocument(createDefaultHeatmapDocument())}
\`\`\``
}

function getHeatmapCellBackground(value: number) {
  const strength = Math.max(0.14, value / 100)
  const accentMix = Math.round(16 + strength * 56)
  return `color-mix(in oklab, var(--accent) ${accentMix}%, var(--card))`
}

function getHeatmapCellTextClass(value: number) {
  return value >= 64 ? ' doc-heatmap-cell-strong' : ''
}

export function renderHeatmapBlockFromData(data: HeatmapDocument) {
  const normalized = normalizeHeatmapDocument(data)
  const encodedSource = escapeHtml(encodeHeatmapSource(serializeHeatmapDocument(normalized)))
  const columnTemplate = `minmax(9rem, auto) repeat(${normalized.columns.length}, minmax(3.75rem, 1fr))`
  const ariaLabel = escapeHtml(`${normalized.title} heatmap`)

  const legendCells = [12, 36, 62, 88]
    .map(
      (value) =>
        `<span class="doc-heatmap-legend-chip" aria-hidden="true" style="background:${getHeatmapCellBackground(value)}"></span>`,
    )
    .join('')

  const columnHeaders = normalized.columns
    .map(
      (column) =>
        `<div class="doc-heatmap-axis doc-heatmap-axis-x">${escapeHtml(column)}</div>`,
    )
    .join('')

  const rows = normalized.rows
    .map((row) => {
      const cells = row.values
        .map((value, columnIndex) => {
          const label = escapeHtml(
            `${row.label} / ${normalized.columns[columnIndex] ?? `Column ${columnIndex + 1}`}: ${value}`,
          )

          return `<div class="doc-heatmap-cell${getHeatmapCellTextClass(value)}" role="img" aria-label="${label}" style="background:${getHeatmapCellBackground(value)}"><span>${value}</span></div>`
        })
        .join('')

      return `<div class="doc-heatmap-axis doc-heatmap-axis-y">${escapeHtml(row.label)}</div>${cells}`
    })
    .join('')

  return [
    `<div class="doc-heatmap" data-doc-heatmap="${encodedSource}" contenteditable="false" aria-label="${ariaLabel}">`,
    '<div class="doc-heatmap-header">',
    '<div class="doc-heatmap-copy">',
    '<p class="doc-heatmap-kicker">Heatmap</p>',
    `<h3 class="doc-heatmap-title">${escapeHtml(normalized.title)}</h3>`,
    normalized.description
      ? `<p class="doc-heatmap-description">${escapeHtml(normalized.description)}</p>`
      : '',
    '</div>',
    '<div class="doc-heatmap-legend">',
    `<span>${escapeHtml(normalized.minLabel)}</span>`,
    `<span class="doc-heatmap-legend-scale" aria-hidden="true">${legendCells}</span>`,
    `<span>${escapeHtml(normalized.maxLabel)}</span>`,
    '</div>',
    '</div>',
    `<div class="doc-heatmap-grid" style="grid-template-columns:${columnTemplate}">`,
    '<div class="doc-heatmap-corner" aria-hidden="true"></div>',
    columnHeaders,
    rows,
    '</div>',
    '</div>',
  ].join('')
}

function renderInvalidHeatmapBlock(source: string) {
  return [
    '<div class="doc-heatmap doc-heatmap-invalid" contenteditable="false">',
    '<div class="doc-heatmap-header">',
    '<div class="doc-heatmap-copy">',
    '<p class="doc-heatmap-kicker">Heatmap</p>',
    '<h3 class="doc-heatmap-title">Invalid heatmap data</h3>',
    '<p class="doc-heatmap-description">The source block must contain valid JSON.</p>',
    '</div>',
    '</div>',
    `<pre><code class="language-json">${escapeHtml(source)}</code></pre>`,
    '</div>',
  ].join('')
}

export function renderHeatmapBlock(source: string) {
  const parsed = parseHeatmapDocument(source)
  return parsed ? renderHeatmapBlockFromData(parsed) : renderInvalidHeatmapBlock(source)
}

import { marked, type Tokens } from 'marked'
import {
  getCodeLanguageLabel,
  normalizeCodeLanguage,
  renderHighlightedCodeHtml,
} from '@/lib/code-highlighting'
import { escapeHtml } from '@/lib/utils'

function renderPrimitive(value: unknown): string {
  if (typeof value === 'string') {
    return `<span class="doc-json-string">${escapeHtml(JSON.stringify(value))}</span>`
  }

  if (typeof value === 'number') {
    return `<span class="doc-json-number">${String(value)}</span>`
  }

  if (typeof value === 'boolean') {
    return `<span class="doc-json-boolean">${String(value)}</span>`
  }

  if (value === null) {
    return '<span class="doc-json-null">null</span>'
  }

  return `<span class="doc-json-unknown">${escapeHtml(String(value))}</span>`
}

function renderKey(key: string | null): string {
  if (key === null) return ''
  return `<span class="doc-json-key">${escapeHtml(JSON.stringify(key))}</span><span class="doc-json-punctuation">: </span>`
}

function renderLine(content: string, level: number, extraClass = ''): string {
  const className = ['doc-json-line', extraClass].filter(Boolean).join(' ')
  return `<div class="${className}" style="--json-level:${level}">${content}</div>`
}

function renderJsonNode(
  value: unknown,
  key: string | null,
  isLast: boolean,
  level: number,
): string {
  const comma = isLast ? '' : '<span class="doc-json-punctuation">,</span>'

  if (value === null || typeof value !== 'object') {
    return renderLine(`${renderKey(key)}${renderPrimitive(value)}${comma}`, level)
  }

  const isArray = Array.isArray(value)
  const entries = isArray ? (value as unknown[]).map((item, index) => [String(index), item] as const) : Object.entries(value)
  const openBrace = isArray ? '[' : '{'
  const closeBrace = isArray ? ']' : '}'

  if (entries.length === 0) {
    return renderLine(
      `${renderKey(key)}<span class="doc-json-brace">${openBrace}${closeBrace}</span>${comma}`,
      level,
    )
  }

  const itemLabel = entries.length === 1 ? (isArray ? 'item' : 'key') : isArray ? 'items' : 'keys'
  const children = entries
    .map(([childKey, childValue], index) =>
      renderJsonNode(childValue, isArray ? null : childKey, index === entries.length - 1, level + 1),
    )
    .join('')

  return [
    `<details class="doc-json-node" ${level === 0 ? 'open' : ''}>`,
    `<summary class="doc-json-summary" style="--json-level:${level}">`,
    '<span class="doc-json-toggle" aria-hidden="true"></span>',
    renderKey(key),
    `<span class="doc-json-brace">${openBrace}</span>`,
    '<span class="doc-json-inline-ellipsis">…</span>',
    `<span class="doc-json-meta">${entries.length} ${itemLabel}</span>`,
    `<span class="doc-json-inline-close">${closeBrace}</span>`,
    comma,
    '</summary>',
    `<div class="doc-json-children">${children}</div>`,
    renderLine(`<span class="doc-json-brace">${closeBrace}</span>${comma}`, level, 'doc-json-closing'),
    '</details>',
  ].join('')
}

function renderJsonCodeBlock(source: string): string {
  const normalized = source.replace(/\r\n/g, '\n').replace(/\n$/, '')
  const encodedSource = encodeURIComponent(normalized)

  try {
    const parsed = JSON.parse(normalized)

    return [
      `<div class="doc-json-viewer" data-doc-json="${escapeHtml(encodedSource)}" contenteditable="false">`,
      '<div class="doc-json-toolbar">',
      '<span class="doc-json-label">JSON</span>',
      '<span class="doc-json-hint">click a node to fold</span>',
      '</div>',
      '<div class="doc-json-tree">',
      renderJsonNode(parsed, null, true, 0),
      '</div>',
      '</div>',
    ].join('')
  } catch {
    return [
      `<div class="doc-json-viewer" data-doc-json="${escapeHtml(encodedSource)}" contenteditable="false">`,
      '<div class="doc-json-toolbar">',
      '<span class="doc-json-label">JSON</span>',
      '<span class="doc-json-hint">invalid payload</span>',
      '</div>',
      `<pre><code class="language-json">${escapeHtml(normalized)}</code></pre>`,
      '</div>',
    ].join('')
  }
}

function renderCodeBlock(token: Tokens.Code): string {
  const normalized = normalizeCodeLanguage(token.lang)
  const code = token.text.replace(/\n$/, '')

  if (normalized === 'json') {
    return renderJsonCodeBlock(token.text)
  }

  const label = getCodeLanguageLabel(normalized)
  const languageAttr = normalized !== 'text' ? ` class="language-${escapeHtml(normalized)}"` : ''

  return `<pre data-code-language="${escapeHtml(normalized)}" data-code-label="${escapeHtml(label)}"><code${languageAttr}>${renderHighlightedCodeHtml(code, normalized)}</code></pre>`
}

const renderer = new marked.Renderer()

renderer.code = (token) => renderCodeBlock(token)

marked.setOptions({
  gfm: true,
  breaks: true,
  renderer,
})

export function renderMarkdown(content: string): string {
  if (!content.trim()) return ''
  return marked.parse(content, { async: false }) as string
}

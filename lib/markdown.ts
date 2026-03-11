import { marked, type Tokens } from 'marked'
import {
  getCodeLanguageLabel,
  normalizeCodeLanguage,
  renderHighlightedCodeHtml,
} from '@/lib/code-highlighting'
import { renderHeatmapBlock } from '@/lib/heatmap'
import { escapeHtml } from '@/lib/utils'

type MarkdownToken = Tokens.Generic
type SchemaHeader = {
  name: string
  type?: string
  metaHtml?: string
}

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

function normalizeSchemaSource(source: string) {
  return source.replace(/\r\n/g, '\n').trimEnd()
}

function renderInlineTokens(tokens: Tokens.Generic[] | undefined) {
  if (!tokens?.length) {
    return ''
  }

  return marked.Parser.parseInline(tokens)
}

function renderBlockTokens(tokens: MarkdownToken[]) {
  if (!tokens.length) {
    return ''
  }

  return marked.Parser.parse(tokens)
}

function isMeaningfulInlineToken(token: Tokens.Generic) {
  return token.type !== 'text' || Boolean(token.text.trim())
}

function extractSchemaTokenText(token: Tokens.Generic) {
  if (token.type === 'strong' || token.type === 'codespan') {
    return token.text.trim()
  }

  return null
}

function extractSchemaHeader(tokens: Tokens.Generic[] | undefined): SchemaHeader | null {
  if (!tokens?.length) {
    return null
  }

  const meaningfulTokens = tokens.filter(isMeaningfulInlineToken)
  const [nameToken, typeToken, ...metaTokens] = meaningfulTokens

  if (!nameToken) {
    return null
  }

  const name = extractSchemaTokenText(nameToken)

  if (!name) {
    return null
  }

  const type = typeToken ? extractSchemaTokenText(typeToken) ?? undefined : undefined

  return {
    name,
    type,
    metaHtml: metaTokens.length ? renderInlineTokens(metaTokens) : undefined,
  }
}

function isSchemaParagraph(token: MarkdownToken): token is Tokens.Paragraph {
  return token.type === 'paragraph' && extractSchemaHeader(token.tokens) !== null
}

function isSchemaList(token: MarkdownToken): token is Tokens.List {
  return (
    token.type === 'list' &&
    !token.ordered &&
    token.items.length > 0 &&
    token.items.every((item: Tokens.ListItem) =>
      item.tokens.some(
        (childToken: MarkdownToken) =>
          childToken.type === 'paragraph' && extractSchemaHeader(childToken.tokens) !== null,
      ),
    )
  )
}

function splitSchemaItem(item: Tokens.ListItem) {
  const firstContentToken = item.tokens.find((token) => token.type !== 'space')

  if (!firstContentToken || firstContentToken.type !== 'paragraph') {
    return null
  }

  const header = extractSchemaHeader(firstContentToken.tokens)

  if (!header) {
    return null
  }

  const bodyTokens: MarkdownToken[] = []
  const childLists: Tokens.List[] = []
  let headerConsumed = false

  for (const token of item.tokens) {
    if (!headerConsumed) {
      if (token === firstContentToken) {
        headerConsumed = true
      }
      continue
    }

    if (isSchemaList(token)) {
      childLists.push(token)
      continue
    }

    bodyTokens.push(token)
  }

  return { header, bodyTokens, childLists }
}

function renderSchemaNode(item: Tokens.ListItem, depth: number): string {
  const split = splitSchemaItem(item)

  if (!split) {
    return renderBlockTokens([item])
  }

  const bodyHtml = renderBlockTokens(split.bodyTokens).trim()
  const childrenHtml: string = split.childLists
    .map((list) => renderSchemaBranch(list, depth + 1))
    .join('')

  return [
    `<details class="doc-schema-node" data-schema-depth="${depth}" open>`,
    '<summary class="doc-schema-summary">',
    '<span class="doc-schema-toggle" aria-hidden="true"></span>',
    '<span class="doc-schema-summary-copy">',
    `<span class="doc-schema-name">${escapeHtml(split.header.name)}</span>`,
    split.header.type
      ? `<span class="doc-schema-type">${escapeHtml(split.header.type)}</span>`
      : '',
    split.header.metaHtml
      ? `<span class="doc-schema-meta-inline">${split.header.metaHtml}</span>`
      : '',
    '</span>',
    '</summary>',
    bodyHtml || childrenHtml ? '<div class="doc-schema-panel">' : '',
    bodyHtml ? `<div class="doc-schema-copy">${bodyHtml}</div>` : '',
    childrenHtml,
    bodyHtml || childrenHtml ? '</div>' : '',
    '</details>',
  ].join('')
}

function renderSchemaBranch(list: Tokens.List, depth: number): string {
  return [
    `<div class="doc-schema-branch" data-schema-depth="${depth}">`,
    ...list.items.map((item: Tokens.ListItem) => renderSchemaNode(item, depth)),
    '</div>',
  ].join('')
}

function renderSchemaBlock(
  header: SchemaHeader | null,
  bodyTokens: MarkdownToken[],
  childList: Tokens.List | null,
  rawSource: string,
): string {
  const encodedSource = escapeHtml(encodeURIComponent(normalizeSchemaSource(rawSource)))
  const bodyHtml = renderBlockTokens(bodyTokens).trim()
  const childrenHtml = childList ? renderSchemaBranch(childList, 1) : ''

  return [
    `<div class="doc-schema-viewer" data-doc-schema="${encodedSource}" contenteditable="false">`,
    '<div class="doc-schema-toolbar">',
    '<span class="doc-schema-label">Schema</span>',
    '<span class="doc-schema-hint">click a field to fold</span>',
    '</div>',
    '<div class="doc-schema-tree">',
    header
      ? [
          '<details class="doc-schema-node doc-schema-root" data-schema-depth="0" open>',
          '<summary class="doc-schema-summary">',
          '<span class="doc-schema-toggle" aria-hidden="true"></span>',
          '<span class="doc-schema-summary-copy">',
          `<span class="doc-schema-name">${escapeHtml(header.name)}</span>`,
          header.type ? `<span class="doc-schema-type">${escapeHtml(header.type)}</span>` : '',
          header.metaHtml ? `<span class="doc-schema-meta-inline">${header.metaHtml}</span>` : '',
          '</span>',
          '</summary>',
          bodyHtml || childrenHtml ? '<div class="doc-schema-panel">' : '',
          bodyHtml ? `<div class="doc-schema-copy">${bodyHtml}</div>` : '',
          childrenHtml,
          bodyHtml || childrenHtml ? '</div>' : '',
          '</details>',
        ].join('')
      : childrenHtml,
    '</div>',
    '</div>',
  ].join('')
}

function tryRenderSchemaSection(
  tokens: MarkdownToken[],
  startIndex: number,
): { html: string; nextIndex: number } | null {
  const firstToken = tokens[startIndex]

  if (!isSchemaParagraph(firstToken)) {
    return null
  }

  const header = extractSchemaHeader(firstToken.tokens)

  if (!header) {
    return null
  }

  const bodyTokens: MarkdownToken[] = []
  let cursor = startIndex + 1

  while (cursor < tokens.length) {
    const token = tokens[cursor]

    if (token.type === 'space' || token.type === 'paragraph') {
      bodyTokens.push(token)
      cursor += 1
      continue
    }

    break
  }

  const childList = cursor < tokens.length && isSchemaList(tokens[cursor])
    ? (tokens[cursor] as Tokens.List)
    : null

  if (!childList) {
    return null
  }

  const rawSource = tokens
    .slice(startIndex, cursor + 1)
    .map((token) => token.raw ?? '')
    .join('')

  return {
    html: renderSchemaBlock(header, bodyTokens, childList, rawSource),
    nextIndex: cursor,
  }
}

function renderCodeBlock(token: Tokens.Code): string {
  const normalized = normalizeCodeLanguage(token.lang)
  const code = token.text.replace(/\n$/, '')

  if (normalized === 'json') {
    return renderJsonCodeBlock(token.text)
  }

  if (normalized === 'heatmap') {
    return renderHeatmapBlock(token.text)
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

  const tokens = marked.lexer(content)
  const html: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]

    const schemaSection = tryRenderSchemaSection(tokens, index)

    if (schemaSection) {
      html.push(schemaSection.html)
      index = schemaSection.nextIndex
      continue
    }

    if (isSchemaList(token)) {
      html.push(renderSchemaBlock(null, [], token, token.raw ?? ''))
      continue
    }

    html.push(marked.Parser.parse([token]))
  }

  return html.join('')
}

'use client'

import * as React from 'react'
import TurndownService from 'turndown'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  GripHorizontal,
  GripVertical,
  Trash2,
} from 'lucide-react'
import {
  CODE_LANGUAGE_OPTIONS,
  getCodeLanguageLabel,
  getCodeLanguageOption,
  getCodeLanguageSample,
  normalizeCodeLanguage,
  renderHighlightedCodeHtml,
} from '@/lib/code-highlighting'
import {
  AI_ACTION_LABELS,
  MAX_AI_TRANSFORM_TEXT_LENGTH,
  type AiTransformAction,
} from '@/lib/ai'
import { type DocSnippet } from '@/lib/doc-snippets'
import { cn } from '@/lib/utils'
import { renderMarkdown } from '@/lib/markdown'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { DocToolbar, type EditorViewMode, type ToolbarMode } from '@/components/docs/doc-toolbar'
import { DocBubbleMenu } from '@/components/docs/doc-bubble-menu'
import { DocSlashMenu } from '@/components/docs/doc-slash-menu'
import { wordCount } from '@/lib/documents'

type EditorMode = EditorViewMode
type BlockShortcut =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { kind: 'unordered-list' }
  | { kind: 'ordered-list' }
  | { kind: 'blockquote' }
  | { kind: 'divider' }
type ActiveTableMenu = 'row' | 'column' | null
type ActiveTableResizeAxis = 'column' | 'row' | null
const COMPONENT_BLOCK_SELECTOR = '.doc-json-viewer, pre, table, img, hr'

interface ActiveTableResizeState {
  axis: Exclude<ActiveTableResizeAxis, null>
  table: HTMLTableElement
  row: HTMLTableRowElement
  columnIndex: number
  startClientX: number
  startClientY: number
  startSize: number
}

interface TableControlsState {
  rowTop: number
  rowLeft: number
  columnTop: number
  columnLeft: number
  widthHandleTop: number
  widthHandleLeft: number
  heightHandleTop: number
  heightHandleLeft: number
}

interface CodeBlockControlsState {
  top: number
  left: number
  language: string
  label: string
  hint: string
}

function hasRichEditor(mode: EditorMode) {
  return mode === 'wysiwyg' || mode === 'split'
}

function hasSourceEditor(mode: EditorMode) {
  return mode === 'source' || mode === 'split'
}

const MIN_TABLE_COLUMN_WIDTH = 88
const MIN_TABLE_ROW_HEIGHT = 36

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
    node instanceof HTMLElement && node.classList.contains('doc-json-viewer') && Boolean(node.dataset.docJson),
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
    const language = normalizeCodeLanguage(pre.dataset.codeLanguage ?? classMatch?.[1] ?? '')
    const value = code?.textContent?.replace(/\u00a0/g, ' ').replace(/\n$/, '') ?? ''
    const info = language !== 'text' ? language : ''

    return `\n\`\`\`${info}\n${value}\n\`\`\`\n`
  },
})

// Preserve strikethrough
turndown.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (content) => `~~${content}~~`,
})

// Preserve tables
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

function mdToHtml(md: string): string {
  return renderMarkdown(md)
}

function htmlToMd(html: string): string {
  return turndown.turndown(html)
}

function parsePixelSize(value: string | null | undefined) {
  if (!value) return null

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/)
  return match ? Number(match[1]) : null
}

function serializeTableHtml(table: HTMLTableElement) {
  const clone = table.cloneNode(true) as HTMLTableElement

  clone.querySelectorAll('colgroup, col, tr, th, td').forEach((element) => {
    if (!(element instanceof HTMLElement)) return

    if (!element.getAttribute('style')?.trim()) {
      element.removeAttribute('style')
    }
  })

  if (!clone.getAttribute('style')?.trim()) {
    clone.removeAttribute('style')
  }

  return clone.outerHTML
}

function getTableColGroup(table: HTMLTableElement) {
  return Array.from(table.children).find(
    (child): child is HTMLTableColElement => child.tagName === 'COLGROUP',
  ) ?? null
}

function getTableColumnCount(table: HTMLTableElement) {
  return Math.max(0, ...Array.from(table.rows).map((row) => row.cells.length))
}

function hasCustomTableSizing(table: HTMLTableElement) {
  if (hasCustomColumnSizing(table)) {
    return true
  }

  return Array.from(table.rows).some((row) =>
    Boolean(parsePixelSize(row.style.height)) ||
    Array.from(row.cells).some((cell) => Boolean(parsePixelSize(cell.style.height))),
  )
}

function hasCustomColumnSizing(table: HTMLTableElement) {
  if (parsePixelSize(table.style.width)) {
    return true
  }

  if (getTableColGroup(table)?.querySelector('col[style*="width"]')) {
    return true
  }

  return Array.from(table.rows).some((row) =>
    Array.from(row.cells).some((cell) => Boolean(parsePixelSize(cell.style.width))),
  )
}

function ensureTableColGroup(table: HTMLTableElement) {
  let colGroup = getTableColGroup(table)
  if (!colGroup) {
    colGroup = document.createElement('colgroup')
    table.insertBefore(colGroup, table.firstChild)
  }

  const columnCount = getTableColumnCount(table)
  while (colGroup.children.length < columnCount) {
    colGroup.append(document.createElement('col'))
  }
  while (colGroup.children.length > columnCount) {
    colGroup.lastElementChild?.remove()
  }

  return Array.from(colGroup.children).filter(
    (child): child is HTMLTableColElement => child.tagName === 'COL',
  )
}

function getTableColumnWidths(table: HTMLTableElement) {
  const rows = Array.from(table.rows)
  const cols = ensureTableColGroup(table)

  return cols.map((col, index) => {
    const explicitWidth = parsePixelSize(col.style.width)
    if (explicitWidth) {
      return explicitWidth
    }

    const sampleCell = rows.find((row) => row.cells[index])?.cells[index]
    return sampleCell?.getBoundingClientRect().width ?? 160
  })
}

function applyTableColumnWidths(table: HTMLTableElement, widths: number[]) {
  const cols = ensureTableColGroup(table)
  const nextWidths = widths.map((width) => Math.max(MIN_TABLE_COLUMN_WIDTH, Math.round(width)))

  cols.forEach((col, index) => {
    const width = nextWidths[index] ?? nextWidths[nextWidths.length - 1] ?? 160
    col.style.width = `${width}px`
  })

  table.style.width = `${nextWidths.reduce((sum, width) => sum + width, 0)}px`
  table.style.tableLayout = 'fixed'
}

function getExplicitRowHeight(row: HTMLTableRowElement) {
  return (
    parsePixelSize(row.style.height) ??
    Array.from(row.cells)
      .map((cell) => parsePixelSize(cell.style.height))
      .find((value): value is number => value !== null) ??
    null
  )
}

function getTableRowHeight(row: HTMLTableRowElement) {
  return (
    getExplicitRowHeight(row) ??
    Math.max(
      MIN_TABLE_ROW_HEIGHT,
      ...Array.from(row.cells).map((cell) => cell.getBoundingClientRect().height),
    )
  )
}

function applyTableRowHeight(row: HTMLTableRowElement, height: number) {
  const nextHeight = Math.max(MIN_TABLE_ROW_HEIGHT, Math.round(height))

  row.style.height = `${nextHeight}px`
  Array.from(row.cells).forEach((cell) => {
    cell.style.height = `${nextHeight}px`
  })
}

function getSelectionElement(): Element | null {
  const selection = window.getSelection()
  const anchorNode = selection?.anchorNode

  if (!anchorNode) return null

  return anchorNode.nodeType === Node.ELEMENT_NODE
    ? (anchorNode as Element)
    : anchorNode.parentElement
}

function getCurrentBlockElement(editor: HTMLDivElement): HTMLElement {
  const element = getSelectionElement()

  if (!element) return editor

  const block = element.closest('p,div,h1,h2,h3,h4,h5,h6,blockquote,li')

  if (block && editor.contains(block)) {
    return block as HTMLElement
  }

  return editor
}

function detectMarkdownShortcut(editor: HTMLDivElement): BlockShortcut | null {
  const selection = window.getSelection()

  if (!selection || !selection.rangeCount || !selection.isCollapsed) {
    return null
  }

  const block = getCurrentBlockElement(editor)
  const anchorNode = selection.anchorNode

  if (!anchorNode) return null

  let textBeforeCaret = ''

  if (block === editor && anchorNode.nodeType === Node.TEXT_NODE) {
    textBeforeCaret = (anchorNode.textContent ?? '').slice(0, selection.anchorOffset)
  } else {
    const range = selection.getRangeAt(0).cloneRange()
    range.setStart(block, 0)
    range.setEnd(anchorNode, selection.anchorOffset)
    textBeforeCaret = range.toString()
  }

  const headingMatch = textBeforeCaret.match(/^(#{1,6})$/)
  if (headingMatch) {
    return {
      kind: 'heading',
      level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
    }
  }

  if (/^[-*]$/.test(textBeforeCaret)) {
    return { kind: 'unordered-list' }
  }

  if (/^\d+\.$/.test(textBeforeCaret)) {
    return { kind: 'ordered-list' }
  }

  if (textBeforeCaret === '>') {
    return { kind: 'blockquote' }
  }

  if (/^---$/.test(textBeforeCaret)) {
    return { kind: 'divider' }
  }

  return null
}

function placeCaretAtStart(element: HTMLElement) {
  const selection = window.getSelection()
  const range = document.createRange()

  if (!element.firstChild) {
    element.append(document.createElement('br'))
  }

  range.selectNodeContents(element)
  range.collapse(true)

  selection?.removeAllRanges()
  selection?.addRange(range)
}

function getSelectedTableCell(editor: HTMLDivElement): HTMLTableCellElement | null {
  const element = getSelectionElement()
  if (!element) return null

  const cell = element.closest('td, th')

  if (cell && editor.contains(cell)) {
    return cell as HTMLTableCellElement
  }

  return null
}

function getCurrentComponentElement(editor: HTMLDivElement): HTMLElement | null {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return null

  const directElement = getSelectionElement()
  const directJsonViewer = directElement?.closest('.doc-json-viewer')
  if (directJsonViewer && editor.contains(directJsonViewer)) {
    return directJsonViewer as HTMLElement
  }

  const directMatch = directElement?.closest(COMPONENT_BLOCK_SELECTOR)
  if (directMatch && editor.contains(directMatch)) {
    return directMatch as HTMLElement
  }

  const range = selection.getRangeAt(0)
  const candidates: Node[] = []
  const startContainer = range.startContainer

  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const container = startContainer as Element
    const currentNode = container.childNodes[range.startOffset] ?? null
    const previousNode =
      range.startOffset > 0 ? container.childNodes[range.startOffset - 1] ?? null : null

    if (currentNode) candidates.push(currentNode)
    if (previousNode) candidates.push(previousNode)
  } else {
    candidates.push(startContainer)
  }

  for (const candidate of candidates) {
    const element =
      candidate.nodeType === Node.ELEMENT_NODE
        ? (candidate as Element)
        : candidate.parentElement

    const jsonViewer = element?.closest('.doc-json-viewer')
    if (jsonViewer && editor.contains(jsonViewer)) {
      return jsonViewer as HTMLElement
    }

    const match = element?.closest(COMPONENT_BLOCK_SELECTOR)
    if (match && editor.contains(match)) {
      return match as HTMLElement
    }
  }

  return null
}

function createTableCell(tagName: 'th' | 'td', text = '') {
  const cell = document.createElement(tagName)

  if (text) {
    cell.textContent = text
  } else {
    cell.append(document.createElement('br'))
  }

  return cell
}

function createEmptyParagraph() {
  const paragraph = document.createElement('p')
  paragraph.append(document.createElement('br'))
  return paragraph
}

function insertParagraphAfterTable(table: HTMLTableElement) {
  const paragraph = createEmptyParagraph()
  table.replaceWith(paragraph)
  placeCaretAtStart(paragraph)
}

function getOrCreateParagraphAfter(element: Element) {
  const nextElement = element.nextElementSibling

  if (
    nextElement instanceof HTMLParagraphElement &&
    !(nextElement.textContent ?? '').trim()
  ) {
    if (!nextElement.firstChild) {
      nextElement.append(document.createElement('br'))
    }

    return {
      created: false,
      paragraph: nextElement,
    }
  }

  const paragraph = createEmptyParagraph()
  element.insertAdjacentElement('afterend', paragraph)

  return {
    created: true,
    paragraph,
  }
}

function moveBlock(editor: HTMLDivElement, direction: 'up' | 'down') {
  const block = getCurrentComponentElement(editor) ?? getCurrentBlockElement(editor)

  if (!block || block === editor) {
    return
  }

  const sibling = direction === 'up' ? block.previousElementSibling : block.nextElementSibling
  if (!sibling || !editor.contains(sibling)) {
    return
  }

  if (direction === 'up') {
    sibling.before(block)
  } else {
    sibling.after(block)
  }

  const selection = window.getSelection()
  const range = document.createRange()

  if (block instanceof HTMLImageElement || block instanceof HTMLHRElement) {
    range.selectNode(block)
  } else {
    range.selectNodeContents(block)
    range.collapse(true)
  }

  selection?.removeAllRanges()
  selection?.addRange(range)
}

function addTableRow(cell: HTMLTableCellElement, position: 'before' | 'after' = 'after') {
  const row = cell.parentElement
  const table = cell.closest('table')

  if (!(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement)) {
    return null
  }

  const isHeaderRow = row.parentElement?.tagName === 'THEAD'
  const referenceTags = Array.from(row.cells).map((tableCell) =>
    tableCell.tagName === 'TH' ? 'th' : 'td',
  )
  const nextIndex = Math.min(cell.cellIndex, Math.max(referenceTags.length - 1, 0))
  const inheritedHeight = getExplicitRowHeight(row)

  let newRow: HTMLTableRowElement

  if (isHeaderRow) {
    const tbody = table.tBodies[0] ?? table.createTBody()
    newRow = tbody.insertRow(position === 'before' ? 0 : tbody.rows.length)
    referenceTags.forEach(() => {
      newRow.append(createTableCell('td'))
    })
  } else {
    newRow = document.createElement('tr')
    referenceTags.forEach((tagName) => {
      newRow.append(createTableCell(tagName))
    })
    row.insertAdjacentElement(position === 'before' ? 'beforebegin' : 'afterend', newRow)
  }

  if (inheritedHeight) {
    applyTableRowHeight(newRow, inheritedHeight)
  }

  return newRow.cells[nextIndex] as HTMLTableCellElement | null
}

function addTableColumn(cell: HTMLTableCellElement, position: 'before' | 'after' = 'after') {
  const row = cell.parentElement
  const table = cell.closest('table')

  if (!(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement)) {
    return null
  }

  const insertIndex = position === 'before' ? cell.cellIndex : cell.cellIndex + 1
  const columnWidths = hasCustomColumnSizing(table) ? getTableColumnWidths(table) : null
  let targetCell: HTMLTableCellElement | null = null

  Array.from(table.rows).forEach((tableRow) => {
    const tagName = tableRow.parentElement?.tagName === 'THEAD' ? 'th' : 'td'
    const newCell = createTableCell(tagName)
    const rowHeight = getExplicitRowHeight(tableRow)
    const beforeCell = tableRow.cells[insertIndex] ?? null

    if (rowHeight) {
      newCell.style.height = `${rowHeight}px`
    }

    tableRow.insertBefore(newCell, beforeCell)

    if (tableRow === row) {
      targetCell = newCell
    }
  })

  if (columnWidths) {
    const referenceWidth =
      columnWidths[Math.min(Math.max(insertIndex - 1, 0), Math.max(columnWidths.length - 1, 0))] ??
      columnWidths[columnWidths.length - 1] ??
      160

    columnWidths.splice(insertIndex, 0, referenceWidth)
    applyTableColumnWidths(table, columnWidths)
  }

  return targetCell
}

function deleteTableRow(cell: HTMLTableCellElement) {
  const row = cell.parentElement
  const table = cell.closest('table')

  if (!(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement)) {
    return
  }

  const rows = Array.from(table.rows)
  if (rows.length <= 1) {
    insertParagraphAfterTable(table)
    return
  }

  const rowIndex = rows.indexOf(row)
  const fallbackRow = rows[rowIndex + 1] ?? rows[rowIndex - 1] ?? null
  const nextCellIndex = Math.max(0, Math.min(cell.cellIndex, (fallbackRow?.cells.length ?? 1) - 1))

  row.remove()

  if (table.tHead && table.tHead.rows.length === 0) {
    table.tHead.remove()
  }
  Array.from(table.tBodies).forEach((body) => {
    if (body.rows.length === 0) {
      body.remove()
    }
  })

  const remainingRows = Array.from(table.rows)
  const targetRow =
    remainingRows[rowIndex] ?? remainingRows[rowIndex - 1] ?? null

  if (targetRow?.cells.length) {
    placeCaretAtStart(targetRow.cells[Math.min(nextCellIndex, targetRow.cells.length - 1)] as HTMLTableCellElement)
    return
  }

  insertParagraphAfterTable(table)
}

function deleteTableColumn(cell: HTMLTableCellElement) {
  const row = cell.parentElement
  const table = cell.closest('table')

  if (!(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement)) {
    return
  }

  const columnIndex = cell.cellIndex
  const columnWidths = hasCustomColumnSizing(table) ? getTableColumnWidths(table) : null
  const rows = Array.from(table.rows)
  const remainingCells = Math.max((rows[0]?.cells.length ?? 1) - 1, 0)

  if (remainingCells === 0) {
    insertParagraphAfterTable(table)
    return
  }

  rows.forEach((tableRow) => {
    tableRow.cells[columnIndex]?.remove()
  })

  if (columnWidths) {
    columnWidths.splice(columnIndex, 1)
    if (columnWidths.length > 0) {
      applyTableColumnWidths(table, columnWidths)
    }
  }

  const nextCellIndex = Math.min(columnIndex, remainingCells - 1)
  const currentRowIndex = Math.max(rows.indexOf(row), 0)
  const updatedRows = Array.from(table.rows)
  const targetRow =
    updatedRows[currentRowIndex] ?? updatedRows[currentRowIndex - 1] ?? null

  if (targetRow?.cells.length) {
    placeCaretAtStart(targetRow.cells[nextCellIndex] as HTMLTableCellElement)
    return
  }

  insertParagraphAfterTable(table)
}

function getAdjacentTableCell(cell: HTMLTableCellElement, direction: 'next' | 'previous') {
  const row = cell.parentElement
  const table = cell.closest('table')

  if (!(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement)) {
    return null
  }

  const rows = Array.from(table.rows)
  const rowIndex = rows.indexOf(row)
  const cellIndex = cell.cellIndex

  if (direction === 'next') {
    const sameRowNext = row.cells[cellIndex + 1]
    if (sameRowNext) return sameRowNext as HTMLTableCellElement

    const nextRow = rows[rowIndex + 1]
    if (nextRow?.cells.length) return nextRow.cells[0] as HTMLTableCellElement
    return null
  }

  const sameRowPrevious = row.cells[cellIndex - 1]
  if (sameRowPrevious) return sameRowPrevious as HTMLTableCellElement

  const previousRow = rows[rowIndex - 1]
  if (previousRow?.cells.length) {
    return previousRow.cells[previousRow.cells.length - 1] as HTMLTableCellElement
  }

  return null
}

function getTableControlsState(
  container: HTMLElement,
  cell: HTMLTableCellElement,
): TableControlsState | null {
  const row = cell.parentElement
  const table = cell.closest('table')

  if (!(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement)) {
    return null
  }

  const containerRect = container.getBoundingClientRect()
  const rowRect = row.getBoundingClientRect()
  const cellRect = cell.getBoundingClientRect()
  const tableRect = table.getBoundingClientRect()

  return {
    rowTop: rowRect.top - containerRect.top + rowRect.height / 2,
    rowLeft: tableRect.left - containerRect.left,
    columnTop: tableRect.top - containerRect.top,
    columnLeft: cellRect.left - containerRect.left + cellRect.width / 2,
    widthHandleTop: cellRect.top - containerRect.top + cellRect.height / 2,
    widthHandleLeft: cellRect.right - containerRect.left,
    heightHandleTop: rowRect.bottom - containerRect.top,
    heightHandleLeft: cellRect.left - containerRect.left + cellRect.width / 2,
  }
}

function getCodeBlockControlsState(
  container: HTMLElement,
  codeBlock: HTMLPreElement,
): CodeBlockControlsState {
  const containerRect = container.getBoundingClientRect()
  const blockRect = codeBlock.getBoundingClientRect()
  const language = normalizeCodeLanguage(codeBlock.dataset.codeLanguage ?? '')
  const option = getCodeLanguageOption(language)

  return {
    top: blockRect.top - containerRect.top,
    left: blockRect.right - containerRect.left - 12,
    language,
    label: getCodeLanguageLabel(language),
    hint: (option?.hint ?? language ?? 'txt').toUpperCase(),
  }
}

function isInCodeBlockHeaderZone(codeBlock: HTMLPreElement, clientX: number, clientY: number) {
  const rect = codeBlock.getBoundingClientRect()

  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top - 2 &&
    clientY <= rect.top + 14
  )
}

function getBlockContentAfterCaret(block: HTMLElement) {
  const selection = window.getSelection()

  if (!selection || !selection.rangeCount) {
    return document.createDocumentFragment()
  }

  const range = selection.getRangeAt(0).cloneRange()
  range.setEnd(block, block.childNodes.length)
  return range.cloneContents()
}

function setEditableElementContent(element: HTMLElement, fragment: DocumentFragment) {
  element.replaceChildren()

  if (fragment.childNodes.length > 0) {
    element.append(fragment)
    return
  }

  element.append(document.createElement('br'))
}

function createShortcutNodes(shortcut: BlockShortcut) {
  if (shortcut.kind === 'heading') {
    const heading = document.createElement(`h${shortcut.level}`)
    return { nodes: [heading], caretTarget: heading }
  }

  if (shortcut.kind === 'unordered-list' || shortcut.kind === 'ordered-list') {
    const list = document.createElement(shortcut.kind === 'unordered-list' ? 'ul' : 'ol')
    const item = document.createElement('li')
    list.append(item)
    return { nodes: [list], caretTarget: item }
  }

  if (shortcut.kind === 'blockquote') {
    const blockquote = document.createElement('blockquote')
    const paragraph = document.createElement('p')
    blockquote.append(paragraph)
    return { nodes: [blockquote], caretTarget: paragraph }
  }

  const rule = document.createElement('hr')
  const paragraph = document.createElement('p')
  return { nodes: [rule, paragraph], caretTarget: paragraph }
}

function applyMarkdownShortcut(editor: HTMLDivElement, shortcut: BlockShortcut) {
  const block = getCurrentBlockElement(editor)
  const trailingContent = getBlockContentAfterCaret(block)
  const { nodes, caretTarget } = createShortcutNodes(shortcut)

  setEditableElementContent(caretTarget, trailingContent)

  if (block === editor) {
    editor.innerHTML = ''
    editor.append(...nodes)
  } else {
    block.replaceWith(...nodes)
  }

  placeCaretAtStart(caretTarget)
}

interface SourceSelectionRange {
  start: number
  end: number
}

function getBlockPadding(before: string, after: string) {
  const prefix =
    before.length === 0 ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const suffix =
    after.length === 0 ? '\n' : after.startsWith('\n\n') ? '\n' : after.startsWith('\n') ? '\n' : '\n\n'
  return { prefix, suffix }
}

function insertSnippetIntoTextarea(
  textarea: HTMLTextAreaElement,
  snippet: DocSnippet,
  selection?: SourceSelectionRange | null,
) {
  const range = selection ?? {
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
  }
  const before = textarea.value.slice(0, range.start)
  const after = textarea.value.slice(range.end)
  const body = snippet.template.trim()
  const { prefix, suffix } = getBlockPadding(before, after)
  const insertion = `${prefix}${body}${suffix}`
  const nextValue = `${before}${insertion}${after}`
  const caret = before.length + prefix.length + body.length

  textarea.value = nextValue
  textarea.focus()
  textarea.setSelectionRange(caret, caret)

  return {
    caret,
    value: nextValue,
  }
}

function placeCaretAtEnd(element: HTMLElement) {
  const selection = window.getSelection()
  const range = document.createRange()

  range.selectNodeContents(element)
  range.collapse(false)

  selection?.removeAllRanges()
  selection?.addRange(range)
}

function restoreRichSelection(editor: HTMLDivElement, range: Range | null) {
  const selection = window.getSelection()

  editor.focus()

  if (!range || !selection) {
    placeCaretAtEnd(editor)
    return
  }

  selection.removeAllRanges()
  selection.addRange(range.cloneRange())
}

function insertSnippetIntoRichEditor(
  editor: HTMLDivElement,
  snippet: DocSnippet,
  selectionRange: Range | null,
) {
  restoreRichSelection(editor, selectionRange)
  document.execCommand('insertHTML', false, `${mdToHtml(snippet.template)}<p><br></p>`)
}

function replaceSelectionInRichEditor(
  editor: HTMLDivElement,
  selectionRange: Range | null,
  nextText: string,
) {
  restoreRichSelection(editor, selectionRange)
  document.execCommand('insertText', false, nextText)
}

function insertExplanationIntoRichEditor(
  editor: HTMLDivElement,
  selectionRange: Range | null,
  explanation: string,
) {
  restoreRichSelection(editor, selectionRange)

  const anchor = getCurrentComponentElement(editor) ?? getCurrentBlockElement(editor)
  const quote = document.createElement('blockquote')
  const sections = explanation
    .trim()
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

  for (const section of sections.length > 0 ? sections : [explanation.trim()]) {
    const paragraph = document.createElement('p')
    const lines = section.split('\n')

    lines.forEach((line, index) => {
      if (index > 0) {
        paragraph.append(document.createElement('br'))
      }
      paragraph.append(document.createTextNode(line))
    })

    quote.append(paragraph)
  }

  const paragraph = createEmptyParagraph()

  if (anchor === editor) {
    editor.append(quote, paragraph)
  } else {
    anchor.after(quote, paragraph)
  }

  placeCaretAtStart(paragraph)
}

function buildCodeBlockMarkdown(language: string) {
  const normalized = normalizeCodeLanguage(language)
  const sample = getCodeLanguageSample(normalized)
  const info = normalized !== 'text' ? normalized : ''
  const markdown = `\`\`\`${info}\n${sample}\n\`\`\``
  const contentOffset = markdown.indexOf('\n') + 1

  return {
    markdown,
    normalized,
    sample,
    selectionStart: contentOffset,
    selectionEnd: contentOffset + sample.length,
  }
}

function insertCodeBlockIntoTextarea(
  textarea: HTMLTextAreaElement,
  language: string,
  selection?: SourceSelectionRange | null,
) {
  const template = buildCodeBlockMarkdown(language)
  const range = selection ?? {
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
  }
  const before = textarea.value.slice(0, range.start)
  const after = textarea.value.slice(range.end)
  const { prefix, suffix } = getBlockPadding(before, after)
  const insertion = `${prefix}${template.markdown}${suffix}`
  const nextValue = `${before}${insertion}${after}`
  const selectionStart = before.length + prefix.length + template.selectionStart
  const selectionEnd = before.length + prefix.length + template.selectionEnd

  textarea.value = nextValue
  textarea.focus()
  textarea.setSelectionRange(selectionStart, selectionEnd)

  return {
    value: nextValue,
    selection: {
      start: selectionStart,
      end: selectionEnd,
    },
  }
}

function insertCodeBlockIntoRichEditor(
  editor: HTMLDivElement,
  language: string,
  selectionRange: Range | null,
) {
  restoreRichSelection(editor, selectionRange)

  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return null

  const range = selection.getRangeAt(0)
  const normalized = normalizeCodeLanguage(language)
  const codeText = getCodeLanguageSample(normalized)
  const pre = document.createElement('pre')
  pre.dataset.codeLanguage = normalized
  pre.dataset.codeLabel = getCodeLanguageLabel(normalized)

  const code = document.createElement('code')
  if (normalized !== 'text') {
    code.className = `language-${normalized}`
  }
  if (normalized === 'text') {
    code.textContent = codeText
  } else {
    code.innerHTML = renderHighlightedCodeHtml(codeText, normalized)
  }
  pre.append(code)

  const paragraph = createEmptyParagraph()

  range.deleteContents()

  const fragment = document.createDocumentFragment()
  fragment.append(pre, paragraph)
  range.insertNode(fragment)

  const nextRange = document.createRange()
  nextRange.selectNodeContents(code)
  selection.removeAllRanges()
  selection.addRange(nextRange)

  return nextRange.cloneRange()
}

function updateCodeBlockLanguage(codeBlock: HTMLPreElement, language: string) {
  const code = codeBlock.querySelector('code')
  if (!(code instanceof HTMLElement)) {
    return null
  }

  const normalized = normalizeCodeLanguage(language)
  const content = code.textContent?.replace(/\u00a0/g, ' ') ?? ''

  codeBlock.dataset.codeLanguage = normalized
  codeBlock.dataset.codeLabel = getCodeLanguageLabel(normalized)

  if (normalized === 'text') {
    code.removeAttribute('class')
    code.textContent = content
    return code
  }

  code.className = `language-${normalized}`
  code.innerHTML = renderHighlightedCodeHtml(content, normalized)

  return code
}

interface DocEditorProps {
  content: string
  onChange: (content: string) => void
  readOnly?: boolean
  className?: string
  onModeChange?: (mode: EditorViewMode) => void
  editorFocusRef?: React.MutableRefObject<{ focus: () => void } | null>
}

export function DocEditor({ content, onChange, readOnly, className, onModeChange, editorFocusRef }: DocEditorProps) {
  const [mode, setMode] = React.useState<EditorMode>('wysiwyg')
  const [activePane, setActivePane] = React.useState<ToolbarMode>('wysiwyg')
  const [aiPendingAction, setAiPendingAction] = React.useState<AiTransformAction | null>(null)
  const [activeTableResizeAxis, setActiveTableResizeAxis] = React.useState<ActiveTableResizeAxis>(null)
  const [selectionInfo, setSelectionInfo] = React.useState<{ words: number; chars: number } | null>(null)
  const [tableControls, setTableControls] = React.useState<TableControlsState | null>(null)
  const [openTableMenu, setOpenTableMenu] = React.useState<ActiveTableMenu>(null)
  const [codeBlockControls, setCodeBlockControls] = React.useState<CodeBlockControlsState | null>(null)
  const [openCodeBlockMenu, setOpenCodeBlockMenu] = React.useState(false)
  const [insertPickerOpen, setInsertPickerOpen] = React.useState(false)
  const [showShortcuts, setShowShortcuts] = React.useState(false)
  const editorRef = React.useRef<HTMLDivElement>(null)
  const editorCanvasRef = React.useRef<HTMLDivElement>(null)
  const editorViewportRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  // Track whether we are switching modes so we don't fight with onChange
  const switchingRef = React.useRef(false)
  // Track the latest markdown so we can detect external changes
  const latestMdRef = React.useRef(content)
  const activeTableCellRef = React.useRef<HTMLTableCellElement | null>(null)
  const activeTableResizeRef = React.useRef<ActiveTableResizeState | null>(null)
  const activeCodeBlockRef = React.useRef<HTMLPreElement | null>(null)
  const richSelectionRef = React.useRef<Range | null>(null)
  const sourceSelectionRef = React.useRef<SourceSelectionRange | null>(null)
  const slashMenuRef = React.useRef<{ show: () => void; hide: () => void }>(null)
  const editingMode: ToolbarMode = mode === 'split' ? activePane : mode

  const syncRichEditorToMarkdown = React.useCallback(() => {
    if (!editorRef.current) return
    const md = htmlToMd(editorRef.current.innerHTML)
    latestMdRef.current = md
    onChange(md)
  }, [onChange])

  // ── Mode switching ───────────────────────────────────────────────────────
  const handleModeChange = React.useCallback(
    (m: EditorMode) => {
      switchingRef.current = true
      setInsertPickerOpen(false)
      setOpenTableMenu(null)
      setOpenCodeBlockMenu(false)
      setActiveTableResizeAxis(null)
      setTableControls(null)
      setCodeBlockControls(null)
      activeTableCellRef.current = null
      activeTableResizeRef.current = null
      activeCodeBlockRef.current = null

      if (hasRichEditor(mode) && !hasRichEditor(m)) {
        syncRichEditorToMarkdown()
      } else if (!hasRichEditor(mode) && hasRichEditor(m)) {
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.innerHTML = mdToHtml(content)
            latestMdRef.current = content
          }
        })
      }

      const nextActivePane: ToolbarMode =
        m === 'split'
          ? mode === 'split'
            ? activePane
            : mode === 'source'
              ? 'source'
              : 'wysiwyg'
          : m

      setActivePane(nextActivePane)
      setMode(m)
      requestAnimationFrame(() => {
        if (hasRichEditor(m) && !hasRichEditor(mode)) {
          editorViewportRef.current?.scrollTo({ top: 0 })
        }

        if (hasSourceEditor(m) && !hasSourceEditor(mode) && textareaRef.current) {
          textareaRef.current.scrollTop = 0
        }

        if (nextActivePane === 'source') {
          textareaRef.current?.focus()
        } else {
          editorRef.current?.focus()
        }

        switchingRef.current = false
      })
    },
    [activePane, content, mode, syncRichEditorToMarkdown],
  )

  // ── Global shortcuts ─────────────────────────────────────────────────────
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        if (e.key === '1') {
          e.preventDefault()
          handleModeChange('wysiwyg')
        } else if (e.key === '2') {
          e.preventDefault()
          handleModeChange('source')
        } else if (e.key === '3') {
          e.preventDefault()
          handleModeChange('split')
        }
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleModeChange])

  const getActiveTableCell = React.useCallback(() => {
    if (!editorRef.current) return null

    const selectedCell = getSelectedTableCell(editorRef.current)
    if (selectedCell && document.contains(selectedCell)) {
      activeTableCellRef.current = selectedCell
      return selectedCell
    }

    if (
      (openTableMenu || activeTableResizeRef.current) &&
      activeTableCellRef.current &&
      document.contains(activeTableCellRef.current)
    ) {
      return activeTableCellRef.current
    }

    activeTableCellRef.current = null
    return null
  }, [openTableMenu])

  const handleTableResizeStart = React.useCallback(
    (axis: Exclude<ActiveTableResizeAxis, null>, event: React.MouseEvent<HTMLButtonElement>) => {
      const cell = getActiveTableCell()
      const row = cell?.parentElement
      const table = cell?.closest('table')

      if (
        !cell ||
        !(row instanceof HTMLTableRowElement) ||
        !(table instanceof HTMLTableElement)
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      activeTableCellRef.current = cell
      activeTableResizeRef.current = {
        axis,
        table,
        row,
        columnIndex: cell.cellIndex,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startSize:
          axis === 'column'
            ? getTableColumnWidths(table)[cell.cellIndex] ?? cell.getBoundingClientRect().width
            : getTableRowHeight(row),
      }

      setOpenTableMenu(null)
      setActiveTableResizeAxis(axis)
      document.body.style.cursor = axis === 'column' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    },
    [getActiveTableCell],
  )

  const updateTableControls = React.useCallback(() => {
    if (!editorRef.current || !editorCanvasRef.current || !hasRichEditor(mode)) {
      setTableControls(null)
      return
    }

    const cell = getActiveTableCell()
    if (!cell) {
      setTableControls(null)
      return
    }

    setTableControls(getTableControlsState(editorCanvasRef.current, cell))
  }, [getActiveTableCell, mode])

  const updateCodeBlockControls = React.useCallback(
    (codeBlock?: HTMLPreElement | null) => {
      if (
        !editorRef.current ||
        !editorCanvasRef.current ||
        !hasRichEditor(mode) ||
        readOnly
      ) {
        activeCodeBlockRef.current = null
        setCodeBlockControls(null)
        return
      }

      const nextCodeBlock = codeBlock ?? activeCodeBlockRef.current
      if (!nextCodeBlock || !document.contains(nextCodeBlock)) {
        activeCodeBlockRef.current = null
        setCodeBlockControls(null)
        return
      }

      activeCodeBlockRef.current = nextCodeBlock
      setCodeBlockControls(getCodeBlockControlsState(editorCanvasRef.current, nextCodeBlock))
    },
    [mode, readOnly],
  )

  const handleBubbleAction = React.useCallback((action: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()

    switch (action) {
      case 'bold':
        document.execCommand('bold', false)
        break
      case 'italic':
        document.execCommand('italic', false)
        break
      case 'strikethrough':
        document.execCommand('strikeThrough', false)
        break
      case 'code':
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          const code = document.createElement('code')
          try {
            range.surroundContents(code)
          } catch {
            // If selection crosses block boundaries, surroundContents might fail
            document.execCommand('insertHTML', false, `<code>${sel.toString()}</code>`)
          }
        }
        break
    }
    syncRichEditorToMarkdown()
  }, [syncRichEditorToMarkdown])

  const captureSourceSelection = React.useCallback(() => {
    if (!textareaRef.current) return

    sourceSelectionRef.current = {
      start: textareaRef.current.selectionStart,
      end: textareaRef.current.selectionEnd,
    }
  }, [])

  const captureRichSelection = React.useCallback(() => {
    if (!editorRef.current) return

    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return

    const text = selection.toString()
    if (text && !selection.isCollapsed) {
      setSelectionInfo({
        words: wordCount(text),
        chars: text.length,
      })
    } else {
      setSelectionInfo(null)
    }

    const range = selection.getRangeAt(0)
    if (
      editorRef.current.contains(range.startContainer) &&
      editorRef.current.contains(range.endContainer)
    ) {
      richSelectionRef.current = range.cloneRange()
    }
  }, [])

  const captureCurrentSelection = React.useCallback(() => {
    if (editingMode === 'source') {
      captureSourceSelection()
      return
    }

    captureRichSelection()
  }, [captureRichSelection, captureSourceSelection, editingMode])

  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = activeTableResizeRef.current

      if (!resizeState) return

      if (resizeState.axis === 'column') {
        const widths = getTableColumnWidths(resizeState.table)
        widths[resizeState.columnIndex] = Math.max(
          MIN_TABLE_COLUMN_WIDTH,
          resizeState.startSize + (event.clientX - resizeState.startClientX),
        )
        applyTableColumnWidths(resizeState.table, widths)
      } else {
        applyTableRowHeight(
          resizeState.row,
          resizeState.startSize + (event.clientY - resizeState.startClientY),
        )
      }

      requestAnimationFrame(updateTableControls)
    }

    const handleMouseUp = () => {
      if (!activeTableResizeRef.current) return

      activeTableResizeRef.current = null
      setActiveTableResizeAxis(null)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')

      requestAnimationFrame(() => {
        updateTableControls()
        syncRichEditorToMarkdown()
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
  }, [syncRichEditorToMarkdown, updateTableControls])

  React.useEffect(() => {
    const handleSelectionChange = () => {
      if (!editorRef.current || !hasRichEditor(mode)) {
        setTableControls(null)
        setCodeBlockControls(null)
        richSelectionRef.current = null
        activeTableCellRef.current = null
        activeTableResizeRef.current = null
        activeCodeBlockRef.current = null
        return
      }

      captureRichSelection()
      updateTableControls()
      updateCodeBlockControls()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    window.addEventListener('resize', handleSelectionChange)

    const viewport = editorViewportRef.current
    viewport?.addEventListener('scroll', handleSelectionChange, { passive: true })

    handleSelectionChange()

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      window.removeEventListener('resize', handleSelectionChange)
      viewport?.removeEventListener('scroll', handleSelectionChange)
    }
  }, [captureRichSelection, mode, updateCodeBlockControls, updateTableControls])

  const handleTableAddRow = React.useCallback((position: 'before' | 'after') => {
    const cell = getActiveTableCell()
    if (!cell) return

    const nextCell = addTableRow(cell, position)
    if (nextCell) {
      activeTableCellRef.current = nextCell
      placeCaretAtStart(nextCell)
    }
    requestAnimationFrame(() => {
      updateTableControls()
      syncRichEditorToMarkdown()
    })
  }, [getActiveTableCell, syncRichEditorToMarkdown, updateTableControls])

  const handleTableAddColumn = React.useCallback((position: 'before' | 'after') => {
    const cell = getActiveTableCell()
    if (!cell) return

    const nextCell = addTableColumn(cell, position)
    if (nextCell) {
      activeTableCellRef.current = nextCell
      placeCaretAtStart(nextCell)
    }
    requestAnimationFrame(() => {
      updateTableControls()
      syncRichEditorToMarkdown()
    })
  }, [getActiveTableCell, syncRichEditorToMarkdown, updateTableControls])

  const handleTableDeleteRow = React.useCallback(() => {
    const cell = getActiveTableCell()
    if (!cell) return

    deleteTableRow(cell)
    requestAnimationFrame(() => {
      updateTableControls()
      syncRichEditorToMarkdown()
    })
  }, [getActiveTableCell, syncRichEditorToMarkdown, updateTableControls])

  const handleTableDeleteColumn = React.useCallback(() => {
    const cell = getActiveTableCell()
    if (!cell) return

    deleteTableColumn(cell)
    requestAnimationFrame(() => {
      updateTableControls()
      syncRichEditorToMarkdown()
    })
  }, [getActiveTableCell, syncRichEditorToMarkdown, updateTableControls])

  const handleCodeBlockLanguageChange = React.useCallback(
    (language: string) => {
      const codeBlock = activeCodeBlockRef.current

      if (!codeBlock) return

      const code = updateCodeBlockLanguage(codeBlock, language)
      updateCodeBlockControls(codeBlock)

      if (code) {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(code)
        selection?.removeAllRanges()
        selection?.addRange(range)
        richSelectionRef.current = range.cloneRange()
      }

      requestAnimationFrame(() => {
        syncRichEditorToMarkdown()
      })
    },
    [syncRichEditorToMarkdown, updateCodeBlockControls],
  )

  const handleInsertSnippet = React.useCallback(
    (snippet: DocSnippet) => {
      if (readOnly) return

      if (editingMode === 'source') {
        if (!textareaRef.current) return

        const result = insertSnippetIntoTextarea(
          textareaRef.current,
          snippet,
          sourceSelectionRef.current,
        )

        sourceSelectionRef.current = {
          start: result.caret,
          end: result.caret,
        }
        onChange(result.value)
        return
      }

      if (!editorRef.current) return

      insertSnippetIntoRichEditor(editorRef.current, snippet, richSelectionRef.current)
      requestAnimationFrame(() => {
        captureRichSelection()
        syncRichEditorToMarkdown()
      })
    },
    [captureRichSelection, editingMode, onChange, readOnly, syncRichEditorToMarkdown],
  )

  const handleInsertCodeBlock = React.useCallback(
    (language: string) => {
      if (readOnly) return

      if (editingMode === 'source') {
        if (!textareaRef.current) return

        const result = insertCodeBlockIntoTextarea(
          textareaRef.current,
          language,
          sourceSelectionRef.current,
        )

        sourceSelectionRef.current = result.selection
        onChange(result.value)
        return
      }

      if (!editorRef.current) return

      const nextRange = insertCodeBlockIntoRichEditor(
        editorRef.current,
        language,
        richSelectionRef.current,
      )

      if (nextRange) {
        richSelectionRef.current = nextRange
      }

      requestAnimationFrame(() => {
        syncRichEditorToMarkdown()
      })
    },
    [editingMode, onChange, readOnly, syncRichEditorToMarkdown],
  )

  const handleAiAction = React.useCallback(
    async (action: AiTransformAction, options?: { targetLanguage?: string }) => {
      if (readOnly || !editorRef.current) return

      const selectionRange = richSelectionRef.current?.cloneRange() ?? null
      const selectedText = selectionRange?.toString().trim() ?? ''

      if (!selectionRange || !selectedText) {
        toast.error('Select text first', {
          description: 'Highlight the text you want the AI action to use.',
        })
        return
      }

      if (selectedText.length > MAX_AI_TRANSFORM_TEXT_LENGTH) {
        toast.error('Selection is too long', {
          description: `Choose up to ${MAX_AI_TRANSFORM_TEXT_LENGTH} characters at a time.`,
        })
        return
      }

      setAiPendingAction(action)

      try {
        const response = await fetch('/api/ai/transform', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            text: selectedText,
            targetLanguage: options?.targetLanguage,
          }),
        })

        const payload = (await response.json().catch(() => null)) as
          | { error?: string; result?: string }
          | null

        if (!response.ok || !payload?.result) {
          throw new Error(payload?.error ?? 'The AI action did not return usable text.')
        }

        if (action === 'explain') {
          insertExplanationIntoRichEditor(editorRef.current, selectionRange, payload.result)
        } else {
          replaceSelectionInRichEditor(editorRef.current, selectionRange, payload.result)
        }

        richSelectionRef.current = null
        setSelectionInfo(null)

        requestAnimationFrame(() => {
          captureRichSelection()
          syncRichEditorToMarkdown()
        })
      } catch (error) {
        toast.error(`${AI_ACTION_LABELS[action]} failed`, {
          description:
            error instanceof Error ? error.message : 'Please try again in a moment.',
        })
      } finally {
        setAiPendingAction(null)
      }
    },
    [captureRichSelection, readOnly, syncRichEditorToMarkdown],
  )

  const handleSlashSelect = React.useCallback((action: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()

    // Remove the "/" that was typed
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      // Check if previous char is indeed "/"
      const node = range.startContainer
      if (node.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
        const text = node.textContent ?? ''
        if (text[range.startOffset - 1] === '/') {
          range.setStart(node, range.startOffset - 1)
          range.deleteContents()
        }
      }
    }

    switch (action) {
      case 'h1': applyMarkdownShortcut(editorRef.current, { kind: 'heading', level: 1 }); break
      case 'h2': applyMarkdownShortcut(editorRef.current, { kind: 'heading', level: 2 }); break
      case 'h3': applyMarkdownShortcut(editorRef.current, { kind: 'heading', level: 3 }); break
      case 'ul': applyMarkdownShortcut(editorRef.current, { kind: 'unordered-list' }); break
      case 'ol': applyMarkdownShortcut(editorRef.current, { kind: 'ordered-list' }); break
      case 'blockquote': applyMarkdownShortcut(editorRef.current, { kind: 'blockquote' }); break
      case 'divider': applyMarkdownShortcut(editorRef.current, { kind: 'divider' }); break
      case 'table':
        const tableHtml = '<table><thead><tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr></thead><tbody><tr><td>Cell</td><td>Cell</td><td>Cell</td></tr></tbody></table><p><br></p>'
        document.execCommand('insertHTML', false, tableHtml)
        break
      case 'code':
        handleInsertCodeBlock('typescript')
        break
    }
    syncRichEditorToMarkdown()
  }, [handleInsertCodeBlock, syncRichEditorToMarkdown])

  // ── Sync initial content into WYSIWYG ────────────────────────────────────
  React.useEffect(() => {
    if (hasRichEditor(mode) && editorRef.current && !switchingRef.current) {
      const html = mdToHtml(content)
      const needsInitialHydration = editorRef.current.innerHTML.length === 0 && html.length > 0
      // Only update DOM if content actually diverged (avoids clobbering cursor)
      if (content !== latestMdRef.current || needsInitialHydration) {
        editorRef.current.innerHTML = html
        latestMdRef.current = content
      }
    }
  }, [content, mode])

  React.useEffect(() => {
    onModeChange?.(mode)
  }, [mode, onModeChange])

  // ── Expose focus method to parent ──────────────────────────────────────
  React.useEffect(() => {
    if (!editorFocusRef) return
    editorFocusRef.current = {
      focus: () => {
        if (editingMode === 'source') {
          textareaRef.current?.focus()
        } else {
          editorRef.current?.focus()
        }
      },
    }
    return () => {
      editorFocusRef.current = null
    }
  }, [editorFocusRef, editingMode])

  // ── WYSIWYG input handler ────────────────────────────────────────────────
  const handleEditorInput = React.useCallback(() => {
    if (switchingRef.current) return
    syncRichEditorToMarkdown()
  }, [syncRichEditorToMarkdown])

  // ── WYSIWYG keyboard shortcuts ──────────────────────────────────────────
  const handleEditorKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const meta = e.metaKey || e.ctrlKey
      
      // Table: Cmd+Enter (Add row below), Cmd+Shift+Enter (Add row above)
      if (meta && e.key === 'Enter') {
        const cell = getActiveTableCell()
        if (cell) {
          e.preventDefault()
          handleTableAddRow(e.shiftKey ? 'before' : 'after')
          return
        }
      }

      // Table: Cmd+Backspace (Delete row)
      if (meta && e.key === 'Backspace') {
        const cell = getActiveTableCell()
        if (cell) {
          e.preventDefault()
          handleTableDeleteRow()
          return
        }
      }

      // Structural: Alt+Up/Down (Move block)
      if (e.altKey && !meta && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        if (editorRef.current) {
          moveBlock(editorRef.current, e.key === 'ArrowUp' ? 'up' : 'down')
          requestAnimationFrame(syncRichEditorToMarkdown)
        }
        return
      }

      if (e.shiftKey && e.key === 'Enter' && editorRef.current) {
        const component = getCurrentComponentElement(editorRef.current)


        if (component) {
          e.preventDefault()

          const { paragraph } = getOrCreateParagraphAfter(component)
          activeTableCellRef.current = null
          setOpenTableMenu(null)
          setTableControls(null)
          placeCaretAtStart(paragraph)

          requestAnimationFrame(syncRichEditorToMarkdown)
          return
        }
      }

      if (meta && e.key === '/') {
        e.preventDefault()
        captureRichSelection()
        setInsertPickerOpen(true)
        return
      }

      if (e.key === '/' && !meta && editorRef.current) {
        // Detect if we are at the start of a line/block
        const block = getCurrentBlockElement(editorRef.current)
        const selection = window.getSelection()
        if (selection && selection.isCollapsed && selection.anchorNode) {
          const range = selection.getRangeAt(0).cloneRange()
          range.setStart(block, 0)
          const textBefore = range.toString()

          // If we are at the very beginning of a block
          if (textBefore.trim() === '') {
            // Wait for "/" to be typed, then show menu
            setTimeout(() => slashMenuRef.current?.show(), 50)
          }
        }
      }
      if (meta && e.key === 'e') {
        e.preventDefault()
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          const code = document.createElement('code')
          range.surroundContents(code)
          requestAnimationFrame(syncRichEditorToMarkdown)
        }
      }
      if (e.key === 'Tab') {
        if (editorRef.current) {
          const tableCell = getSelectedTableCell(editorRef.current)
          if (tableCell) {
            e.preventDefault()
            const targetCell = getAdjacentTableCell(
              tableCell,
              e.shiftKey ? 'previous' : 'next',
            )

            if (targetCell) {
              placeCaretAtStart(targetCell)
              return
            }

            if (!e.shiftKey) {
              const table = tableCell.closest('table')

              if (table instanceof HTMLTableElement) {
                const { created, paragraph } = getOrCreateParagraphAfter(table)

                activeTableCellRef.current = null
                setOpenTableMenu(null)
                setTableControls(null)
                placeCaretAtStart(paragraph)

                if (created) {
                  requestAnimationFrame(syncRichEditorToMarkdown)
                }
              }

              return
            }
          }
        }

        e.preventDefault()
        document.execCommand('insertHTML', false, '&nbsp;&nbsp;')
        requestAnimationFrame(syncRichEditorToMarkdown)
      }
      if (!meta && e.key === ' ' && editorRef.current) {
        const shortcut = detectMarkdownShortcut(editorRef.current)
        if (shortcut) {
          e.preventDefault()
          applyMarkdownShortcut(editorRef.current, shortcut)
          requestAnimationFrame(syncRichEditorToMarkdown)
        }
      }
    },
    [captureRichSelection, syncRichEditorToMarkdown, updateTableControls],
  )

  // ── Source keyboard shortcuts ────────────────────────────────────────────
  const handleSourceKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key === '/') {
        e.preventDefault()
        captureSourceSelection()
        setInsertPickerOpen(true)
      } else if (meta && e.key === 'b') {
        e.preventDefault()
        sourceWrap(ta, '**', '**')
        onChange(ta.value)
      } else if (meta && e.key === 'i') {
        e.preventDefault()
        sourceWrap(ta, '_', '_')
        onChange(ta.value)
      } else if (meta && e.key === 'e') {
        e.preventDefault()
        sourceWrap(ta, '`', '`')
        onChange(ta.value)
      } else if (meta && e.key === 'k') {
        e.preventDefault()
        sourceWrap(ta, '[', '](url)')
        onChange(ta.value)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        document.execCommand('insertText', false, '  ')
        onChange(ta.value)
      }
    },
    [captureSourceSelection, onChange],
  )  // ── Handle paste in WYSIWYG (clean up) ──────────────────────────────────
  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const html = e.clipboardData.getData('text/html')
      const plain = e.clipboardData.getData('text/plain')
      e.preventDefault()
      if (html) {
        // Convert pasted HTML to markdown, then back to clean HTML
        const md = htmlToMd(html)
        const cleanHtml = mdToHtml(md)
        document.execCommand('insertHTML', false, cleanHtml)
      } else {
        document.execCommand('insertText', false, plain)
      }
      requestAnimationFrame(syncRichEditorToMarkdown)
    },
    [syncRichEditorToMarkdown],
  )

  const handleEditorMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editorRef.current || !hasRichEditor(mode) || readOnly) {
        return
      }

      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('[data-table-resize-handle="true"]')) {
        updateTableControls()
        return
      }

      if (target?.closest('[data-code-block-control="true"]')) {
        updateCodeBlockControls()
        return
      }

      const codeBlock = target?.closest('pre[data-code-language]')
      if (
        codeBlock instanceof HTMLPreElement &&
        editorRef.current.contains(codeBlock) &&
        isInCodeBlockHeaderZone(codeBlock, e.clientX, e.clientY)
      ) {
        updateCodeBlockControls(codeBlock)
        return
      }

      if (!openCodeBlockMenu) {
        activeCodeBlockRef.current = null
        setCodeBlockControls(null)
      }
    },
    [mode, openCodeBlockMenu, readOnly, updateCodeBlockControls],
  )

  const handleEditorMouseLeave = React.useCallback(() => {
    if (openCodeBlockMenu) return

    activeCodeBlockRef.current = null
    setCodeBlockControls(null)
  }, [openCodeBlockMenu])

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-md border border-border/75 bg-card/95', className)}>
      {/* Toolbar */}
      <DocToolbar
        mode={editingMode}
        editorMode={mode}
        textareaRef={textareaRef}
        editorRef={editorRef}
        disabled={readOnly}
        onEditorModeChange={handleModeChange}
        onSourceChange={onChange}
        onRichChange={syncRichEditorToMarkdown}
        insertPickerOpen={insertPickerOpen}
        onInsertPickerOpenChange={setInsertPickerOpen}
        onBeforeOpenInsertPicker={captureCurrentSelection}
        onInsertSnippet={handleInsertSnippet}
        onBeforeOpenCodeMenu={captureCurrentSelection}
        onInsertCodeBlock={handleInsertCodeBlock}
      />

      {/* Editor area */}
      <div
        className={cn(
          'flex-1 min-h-0',
          mode === 'split'
            ? 'grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]'
            : 'flex flex-col',
        )}
      >
        {hasRichEditor(mode) && (
          <div
            ref={editorViewportRef}
            className={cn(
              'min-h-0 overflow-auto transition-[box-shadow] duration-200',
              mode !== 'split' && 'flex-1',
              mode === 'split' && 'border-b border-border/60 md:border-b-0 md:border-r',
              mode === 'split' && activePane === 'wysiwyg' && 'shadow-[inset_0_-2px_0_0_var(--accent)] md:shadow-[inset_-2px_0_0_0_var(--accent)]',
            )}
          >
            <div
              ref={editorCanvasRef}
              className="relative min-h-full"
              onMouseMove={handleEditorMouseMove}
              onMouseLeave={handleEditorMouseLeave}
            >
              {tableControls && !readOnly && (
                <>
                  <DropdownMenu
                    open={openTableMenu === 'row'}
                    onOpenChange={(open) => setOpenTableMenu(open ? 'row' : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onMouseDown={(e) => e.preventDefault()}
                        className="absolute h-9 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-border/45 bg-background/96 px-0 text-muted-foreground shadow-none hover:border-border/70 hover:bg-muted/35 hover:text-foreground data-[state=open]:border-border/75 data-[state=open]:bg-background active:translate-y-0"
                        style={{
                          top: `${tableControls.rowTop}px`,
                          left: `${tableControls.rowLeft}px`,
                        }}
                        aria-label="Row actions"
                      >
                        <GripVertical className="size-3 text-muted-foreground/80" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="right" sideOffset={8}>
                      <DropdownMenuItem onSelect={() => handleTableAddRow('before')}>
                        <ArrowUp />
                        Insert row above
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleTableAddRow('after')}>
                        <ArrowDown />
                        Insert row below
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={handleTableDeleteRow}>
                        <Trash2 />
                        Delete row
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu
                    open={openTableMenu === 'column'}
                    onOpenChange={(open) => setOpenTableMenu(open ? 'column' : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onMouseDown={(e) => e.preventDefault()}
                        className="absolute h-4 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-border/45 bg-background/96 px-0 text-muted-foreground shadow-none hover:border-border/70 hover:bg-muted/35 hover:text-foreground data-[state=open]:border-border/75 data-[state=open]:bg-background active:translate-y-0"
                        style={{
                          top: `${tableControls.columnTop}px`,
                          left: `${tableControls.columnLeft}px`,
                        }}
                        aria-label="Column actions"
                      >
                        <GripHorizontal className="size-3 text-muted-foreground/80" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" side="bottom" sideOffset={8}>
                      <DropdownMenuItem onSelect={() => handleTableAddColumn('before')}>
                        <ArrowLeft />
                        Insert column left
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleTableAddColumn('after')}>
                        <ArrowRight />
                        Insert column right
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={handleTableDeleteColumn}>
                        <Trash2 />
                        Delete column
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    type="button"
                    data-table-resize-handle="true"
                    onMouseDown={(event) => handleTableResizeStart('column', event)}
                    className={cn(
                      'absolute z-20 h-12 w-3 -translate-x-1/2 -translate-y-1/2 cursor-col-resize rounded-full border border-border/45 bg-background/96 px-0 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] backdrop-blur-sm transition-colors',
                      activeTableResizeAxis === 'column'
                        ? 'border-accent/80 bg-accent/12'
                        : 'hover:border-border/70 hover:bg-muted/35',
                    )}
                    style={{
                      top: `${tableControls.widthHandleTop}px`,
                      left: `${tableControls.widthHandleLeft}px`,
                    }}
                    aria-label="Resize column width"
                  >
                    <span className="mx-auto block h-6 w-px rounded-full bg-border/80" />
                  </button>

                  <button
                    type="button"
                    data-table-resize-handle="true"
                    onMouseDown={(event) => handleTableResizeStart('row', event)}
                    className={cn(
                      'absolute z-20 h-3 w-12 -translate-x-1/2 -translate-y-1/2 cursor-row-resize rounded-full border border-border/45 bg-background/96 px-0 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] backdrop-blur-sm transition-colors',
                      activeTableResizeAxis === 'row'
                        ? 'border-accent/80 bg-accent/12'
                        : 'hover:border-border/70 hover:bg-muted/35',
                    )}
                    style={{
                      top: `${tableControls.heightHandleTop}px`,
                      left: `${tableControls.heightHandleLeft}px`,
                    }}
                    aria-label="Resize row height"
                  >
                    <span className="mx-auto block h-px w-6 rounded-full bg-border/80" />
                  </button>
                </>
              )}
              {codeBlockControls && !readOnly && (
                <DropdownMenu
                  open={openCodeBlockMenu}
                  onOpenChange={(open) => {
                    setOpenCodeBlockMenu(open)

                    if (!open) {
                      activeCodeBlockRef.current = null
                      setCodeBlockControls(null)
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      data-code-block-control="true"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        captureRichSelection()
                      }}
                      className="absolute z-20 h-6 -translate-x-full -translate-y-1/2 gap-1 rounded-full border-border/55 bg-background/96 px-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground shadow-none backdrop-blur-sm hover:border-border/75 hover:bg-background hover:text-foreground active:translate-y-[-50%] data-[state=open]:border-border/80 data-[state=open]:bg-background data-[state=open]:text-foreground"
                      style={{
                        top: `${codeBlockControls.top}px`,
                        left: `${codeBlockControls.left}px`,
                      }}
                      aria-label={`Code language: ${codeBlockControls.label}`}
                    >
                      <span>{codeBlockControls.hint}</span>
                      <ChevronDown className="size-3 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="bottom"
                    sideOffset={8}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    className="w-44"
                  >
                    <DropdownMenuRadioGroup
                      value={codeBlockControls.language}
                      onValueChange={handleCodeBlockLanguageChange}
                    >
                      {CODE_LANGUAGE_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                          data-code-block-control="true"
                        >
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <div
                ref={editorRef}
                role="textbox"
                aria-label="Rich text editor"
                aria-multiline="true"
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onFocus={() => setActivePane('wysiwyg')}
                onKeyUp={captureRichSelection}
                onMouseUp={captureRichSelection}
                onPaste={handlePaste}
                className={cn(
                  'prose-editorial max-w-none outline-none',
                  mode === 'split' ? 'min-h-full p-6 md:p-7' : 'min-h-[600px] p-6',
                  readOnly && 'cursor-default opacity-70',
                )}
              />

              {!readOnly && hasRichEditor(mode) && (
                <>
                  <DocBubbleMenu
                    editorRef={editorRef}
                    onAction={handleBubbleAction}
                    onLinkAction={() => {
                      // Trigger link popover from toolbar if possible
                      const linkBtn = document.querySelector('[aria-label="Link"]') as HTMLButtonElement
                      if (linkBtn) {
                        linkBtn.focus()
                        linkBtn.click()
                      }
                    }}
                    onAiAction={handleAiAction}
                    aiPendingAction={aiPendingAction}
                  />
                  <DocSlashMenu
                    ref={slashMenuRef}
                    editorRef={editorRef}
                    onSelect={handleSlashSelect}
                    onClose={() => slashMenuRef.current?.hide()}
                  />

                  {selectionInfo && (
                    <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
                      <span>{selectionInfo.words} {selectionInfo.words === 1 ? 'word' : 'words'}</span>
                      <span className="opacity-40">/</span>
                      <span>{selectionInfo.chars} {selectionInfo.chars === 1 ? 'char' : 'chars'}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {hasSourceEditor(mode) && (
          <div className={cn(
            'min-h-0 transition-[box-shadow] duration-200',
            mode !== 'split' && 'flex-1',
            mode === 'split' && 'bg-muted/[0.14]',
            mode === 'split' && activePane === 'source' && 'shadow-[inset_0_-2px_0_0_var(--accent)] md:shadow-[inset_2px_0_0_0_var(--accent)]',
          )}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleSourceKeyDown}
              onFocus={() => setActivePane('source')}
              onSelect={captureSourceSelection}
              onClick={captureSourceSelection}
              onKeyUp={captureSourceSelection}
              readOnly={readOnly}
              spellCheck={false}
              aria-label="Markdown source editor"
              className={cn(
                'block w-full resize-none bg-transparent',
                'font-mono text-[13px] leading-7 text-foreground',
                'placeholder:text-muted-foreground/60',
                'outline-none',
                mode === 'split' ? 'h-full min-h-[600px] p-5 md:p-6' : 'h-full min-h-[600px] p-4',
                readOnly && 'cursor-default opacity-70',
              )}
              placeholder="Start writing in Markdown…"
            />
          </div>
        )}

        <KeyboardShortcutsDialog
          open={showShortcuts}
          onOpenChange={setShowShortcuts}
        />
      </div>
    </div>
  )
}

function sourceWrap(ta: HTMLTextAreaElement, before: string, after: string) {
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = ta.value.substring(start, end)
  const replacement = `${before}${selected || 'text'}${after}`
  ta.focus()
  document.execCommand('insertText', false, replacement)
  const newStart = start + before.length
  const newEnd = newStart + (selected.length || 4)
  ta.setSelectionRange(newStart, newEnd)
}

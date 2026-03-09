'use client'

import * as React from 'react'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { FileCode, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DocToolbar } from '@/components/docs/doc-toolbar'

type EditorMode = 'wysiwyg' | 'source'

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
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
  if (!md.trim()) return ''
  return marked.parse(md, { async: false }) as string
}

function htmlToMd(html: string): string {
  return turndown.turndown(html)
}

interface DocEditorProps {
  content: string
  onChange: (content: string) => void
  readOnly?: boolean
  className?: string
}

export function DocEditor({ content, onChange, readOnly, className }: DocEditorProps) {
  const [mode, setMode] = React.useState<EditorMode>('wysiwyg')
  const editorRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  // Track whether we are switching modes so we don't fight with onChange
  const switchingRef = React.useRef(false)
  // Track the latest markdown so we can detect external changes
  const latestMdRef = React.useRef(content)

  // ── Sync initial content into WYSIWYG ────────────────────────────────────
  React.useEffect(() => {
    if (mode === 'wysiwyg' && editorRef.current && !switchingRef.current) {
      const html = mdToHtml(content)
      // Only update DOM if content actually diverged (avoids clobbering cursor)
      if (content !== latestMdRef.current) {
        editorRef.current.innerHTML = html
        latestMdRef.current = content
      }
    }
  }, [content, mode])

  // ── Mode switching ───────────────────────────────────────────────────────
  const handleModeChange = React.useCallback(
    (newMode: string) => {
      const m = newMode as EditorMode
      switchingRef.current = true

      if (mode === 'wysiwyg' && m === 'source') {
        // Flush WYSIWYG → markdown
        if (editorRef.current) {
          const md = htmlToMd(editorRef.current.innerHTML)
          latestMdRef.current = md
          onChange(md)
        }
      } else if (mode === 'source' && m === 'wysiwyg') {
        // Render markdown → HTML into editor
        requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.innerHTML = mdToHtml(content)
            latestMdRef.current = content
          }
        })
      }

      setMode(m)
      requestAnimationFrame(() => {
        switchingRef.current = false
      })
    },
    [mode, content, onChange],
  )

  // ── WYSIWYG input handler ────────────────────────────────────────────────
  const handleEditorInput = React.useCallback(() => {
    if (switchingRef.current) return
    if (!editorRef.current) return
    const md = htmlToMd(editorRef.current.innerHTML)
    latestMdRef.current = md
    onChange(md)
  }, [onChange])

  // ── WYSIWYG keyboard shortcuts ──────────────────────────────────────────
  const handleEditorKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'e') {
        e.preventDefault()
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          const code = document.createElement('code')
          range.surroundContents(code)
        }
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        document.execCommand('insertHTML', false, '&nbsp;&nbsp;')
      }
    },
    [],
  )

  // ── Source keyboard shortcuts ────────────────────────────────────────────
  const handleSourceKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key === 'b') {
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
    [onChange],
  )

  // ── Handle paste in WYSIWYG (clean up) ──────────────────────────────────
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
    },
    [],
  )

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-md border border-border/75 bg-card/95', className)}>
      {/* Header: mode switcher */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-3 py-1.5">
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList className="h-8 bg-transparent border-0 p-0 gap-1">
            <TabsTrigger
              value="wysiwyg"
              className="h-7 px-2.5 text-xs data-[state=active]:bg-background/80"
            >
              <PenLine className="mr-1.5 size-3.5" />
              Edit
            </TabsTrigger>
            <TabsTrigger
              value="source"
              className="h-7 px-2.5 text-xs data-[state=active]:bg-background/80"
            >
              <FileCode className="mr-1.5 size-3.5" />
              Markdown
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Toolbar */}
      <DocToolbar
        mode={mode}
        textareaRef={textareaRef}
        editorRef={editorRef}
        disabled={readOnly}
      />

      {/* Editor area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* WYSIWYG */}
        <div
          ref={editorRef}
          role="textbox"
          aria-label="Rich text editor"
          aria-multiline="true"
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={handleEditorInput}
          onKeyDown={handleEditorKeyDown}
          onPaste={handlePaste}
          className={cn(
            'prose-editorial min-h-[600px] p-6 max-w-none outline-none',
            mode !== 'wysiwyg' && 'hidden',
            readOnly && 'cursor-default opacity-70',
          )}
        />

        {/* Source */}
        {mode === 'source' && (
          <ScrollArea className="flex-1">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleSourceKeyDown}
              readOnly={readOnly}
              spellCheck={false}
              aria-label="Markdown source editor"
              className={cn(
                'size-full min-h-[600px] resize-none bg-transparent p-4',
                'font-mono text-[13px] leading-7 text-foreground',
                'placeholder:text-muted-foreground/60',
                'outline-none',
                readOnly && 'cursor-default opacity-70',
              )}
              placeholder="Start writing in Markdown…"
            />
          </ScrollArea>
        )}
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

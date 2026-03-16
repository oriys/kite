'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'
import { Maximize2, Minimize2, Redo2, Undo2, List } from 'lucide-react'
import { type AiActionOptions, type AiTransformAction } from '@/lib/ai'
import { type DocSnippet } from '@/lib/doc-snippets'
import { cn } from '@/lib/utils'
import {
  type ToolbarAction,
  actions,
} from '@/components/docs/doc-toolbar-helpers'
import { LinkPopover } from '@/components/docs/doc-toolbar-popovers'
import { ImagePopover } from '@/components/docs/doc-toolbar-popovers'
import {
  EditorModeMenu,
  CodeBlockMenu,
  DocumentAiMenu,
} from '@/components/docs/doc-toolbar-menus'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { DocSnippetPicker } from '@/components/docs/doc-snippet-picker'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type { ToolbarMode, EditorViewMode } from '@/components/docs/doc-toolbar-helpers'
import type { ToolbarMode, EditorViewMode } from '@/components/docs/doc-toolbar-helpers'

// ── Toolbar component ──────────────────────────────────────────────────────

interface DocToolbarProps {
  mode: ToolbarMode
  editorMode: EditorViewMode
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  editorRef?: React.RefObject<HTMLDivElement | null>
  tiptapEditor?: Editor | null
  disabled?: boolean
  onEditorModeChange: (mode: EditorViewMode) => void
  onSourceChange?: (content: string) => void
  onRichChange?: () => void
  insertPickerOpen: boolean
  onInsertPickerOpenChange: (open: boolean) => void
  onBeforeOpenInsertPicker?: () => void
  onInsertSnippet?: (snippet: DocSnippet) => void
  onBeforeOpenCodeMenu?: () => void
  onInsertCodeBlock?: (language: string) => void
  activeAiLabel?: string | null
  aiDisabled?: boolean
  fullscreen?: boolean
  onFullscreenChange?: (fullscreen: boolean) => void
  availableDocumentAiActions?: readonly AiTransformAction[]
  aiDocumentPendingAction?: AiTransformAction | null
  onAiDocumentAction?: (
    action: AiTransformAction,
    options?: AiActionOptions,
  ) => void
  outlineOpen?: boolean
  onOutlineOpenChange?: (open: boolean) => void
}

export function DocToolbar({
  mode,
  editorMode,
  textareaRef,
  editorRef,
  tiptapEditor,
  disabled,
  onEditorModeChange,
  onSourceChange,
  onRichChange,
  insertPickerOpen,
  onInsertPickerOpenChange,
  onBeforeOpenInsertPicker,
  onInsertSnippet,
  onBeforeOpenCodeMenu,
  onInsertCodeBlock,
  activeAiLabel,
  aiDisabled,
  fullscreen = false,
  onFullscreenChange,
  availableDocumentAiActions,
  aiDocumentPendingAction,
  onAiDocumentAction,
  outlineOpen = false,
  onOutlineOpenChange,
}: DocToolbarProps) {
  const handleClick = (item: ToolbarAction) => {
    if (mode === 'source') {
      if (textareaRef?.current) {
        item.sourceAction(textareaRef.current)
        onSourceChange?.(textareaRef.current.value)
      }
    } else if (tiptapEditor) {
      const chain = tiptapEditor.chain().focus()
      switch (item.label) {
        case 'Bold': chain.toggleBold().run(); break
        case 'Italic': chain.toggleItalic().run(); break
        case 'Strikethrough': chain.toggleStrike().run(); break
        case 'Inline Code': chain.toggleCode().run(); break
        case 'Heading 1': chain.toggleHeading({ level: 1 }).run(); break
        case 'Heading 2': chain.toggleHeading({ level: 2 }).run(); break
        case 'Heading 3': chain.toggleHeading({ level: 3 }).run(); break
        case 'Bullet List': chain.toggleBulletList().run(); break
        case 'Numbered List': chain.toggleOrderedList().run(); break
        case 'Blockquote': chain.toggleBlockquote().run(); break
        case 'Table': chain.insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run(); break
        case 'Horizontal Rule': chain.setHorizontalRule().run(); break
        default: item.richAction(); break
      }
      requestAnimationFrame(() => { onRichChange?.() })
    } else {
      editorRef?.current?.focus()
      item.richAction()
      requestAnimationFrame(() => {
        onRichChange?.()
      })
    }
  }

  const canToggleFullscreen = Boolean(onFullscreenChange)

  return (
    <TooltipProvider delayDuration={400}>
      <div
        role="toolbar"
        aria-label="Editor formatting toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-2 py-1.5"
      >
        <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-0.5 pr-1">
            <EditorModeMenu value={editorMode} onChange={onEditorModeChange} />
            <Separator orientation="vertical" className="mx-1 h-5" />
            {/* Undo / Redo */}
            {mode === 'wysiwyg' && tiptapEditor && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled || !tiptapEditor.can().undo()}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        tiptapEditor.chain().focus().undo().run()
                      }}
                      aria-label="Undo"
                    >
                      <Undo2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Undo <span className="ml-2 text-muted-foreground">⌘Z</span>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled || !tiptapEditor.can().redo()}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        tiptapEditor.chain().focus().redo().run()
                      }}
                      aria-label="Redo"
                    >
                      <Redo2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Redo <span className="ml-2 text-muted-foreground">⌘⇧Z</span>
                  </TooltipContent>
                </Tooltip>
                <Separator orientation="vertical" className="mx-1 h-5" />
              </>
            )}
            <DocSnippetPicker
              open={insertPickerOpen}
              disabled={disabled || !onInsertSnippet}
              onBeforeOpen={onBeforeOpenInsertPicker}
              onOpenChange={onInsertPickerOpenChange}
              onSelect={(snippet) => onInsertSnippet?.(snippet)}
            />
            <Separator orientation="vertical" className="mx-1 h-5" />
            {actions.map((item, i) => {
              if (item === 'separator') {
                if (i === 4 && onInsertCodeBlock) {
                  return (
                    <React.Fragment key={`sep-${i}`}>
                      <CodeBlockMenu
                        disabled={disabled}
                        onBeforeOpen={onBeforeOpenCodeMenu}
                        onSelect={(language) => onInsertCodeBlock(language.value)}
                      />
                      <Separator orientation="vertical" className="mx-1 h-5" />
                    </React.Fragment>
                  )
                }
                return <Separator key={i} orientation="vertical" className="mx-1 h-5" />
              }
              if (item.id === 'link') {
                return (
                  <LinkPopover
                    key={item.label}
                    disabled={disabled}
                    mode={mode}
                    textareaRef={textareaRef}
                    editorRef={editorRef}
                    tiptapEditor={tiptapEditor}
                    onSourceChange={onSourceChange}
                    onRichChange={onRichChange}
                  />
                )
              }
              if (item.id === 'image') {
                return (
                  <ImagePopover
                    key={item.label}
                    disabled={disabled}
                    mode={mode}
                    textareaRef={textareaRef}
                    editorRef={editorRef}
                    tiptapEditor={tiptapEditor}
                    onSourceChange={onSourceChange}
                    onRichChange={onRichChange}
                  />
                )
              }
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled}
                      onMouseDown={(e) => {
                        // Prevent focus steal from editor
                        e.preventDefault()
                        handleClick(item)
                      }}
                      aria-label={item.label}
                    >
                      <item.icon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {item.label}
                    {item.shortcut && (
                      <span className="ml-2 text-muted-foreground">{item.shortcut}</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 border-l border-border/50 pl-2">
          {onOutlineOpenChange ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={outlineOpen ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  aria-label={outlineOpen ? 'Hide document outline' : 'Show document outline'}
                  aria-pressed={outlineOpen}
                  className={cn(outlineOpen && 'text-foreground')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onOutlineOpenChange(!outlineOpen)}
                >
                  <List className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {outlineOpen ? 'Hide outline' : 'Document outline'}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {canToggleFullscreen ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={fullscreen ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  aria-label={fullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
                  aria-pressed={fullscreen}
                  className={cn(fullscreen && 'text-foreground')}
                  onMouseDown={(e) => {
                    e.preventDefault()
                  }}
                  onClick={() => onFullscreenChange?.(!fullscreen)}
                >
                  {fullscreen ? (
                    <Minimize2 className="size-3.5" />
                  ) : (
                    <Maximize2 className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {fullscreen ? 'Exit full screen' : 'Enter full screen'}
                <span className="ml-2 text-muted-foreground">Esc</span>
              </TooltipContent>
            </Tooltip>
          ) : null}
          <DocumentAiMenu
            activeAiLabel={activeAiLabel}
            aiDisabled={aiDisabled}
            availableDocumentAiActions={availableDocumentAiActions}
            aiDocumentPendingAction={aiDocumentPendingAction}
            onAiDocumentAction={onAiDocumentAction}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}

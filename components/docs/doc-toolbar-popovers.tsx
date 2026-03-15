'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'
import { Link2, Image as ImageIcon } from 'lucide-react'
import {
  wrapSelection,
  insertBlock,
  richExec,
  richInsertBlock,
  type ToolbarMode,
} from '@/components/docs/doc-toolbar-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ── Link popover ────────────────────────────────────────────────────────────

export interface LinkPopoverProps {
  disabled?: boolean
  mode: ToolbarMode
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  editorRef?: React.RefObject<HTMLDivElement | null>
  tiptapEditor?: Editor | null
  onSourceChange?: (content: string) => void
  onRichChange?: () => void
}

export function LinkPopover({ disabled, mode, textareaRef, editorRef, tiptapEditor, onSourceChange, onRichChange }: LinkPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = url.trim()
    if (!trimmed) return

    if (mode === 'source' && textareaRef?.current) {
      wrapSelection(textareaRef.current, '[', `](${trimmed})`)
      onSourceChange?.(textareaRef.current.value)
    } else if (tiptapEditor) {
      tiptapEditor.chain().focus().setLink({ href: trimmed }).run()
      requestAnimationFrame(() => onRichChange?.())
    } else {
      editorRef?.current?.focus()
      richExec('createLink', trimmed)
      requestAnimationFrame(() => onRichChange?.())
    }
    setUrl('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next)
      if (!next) setUrl('')
    }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Link"
            >
              <Link2 className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Link
          <span className="ml-2 text-muted-foreground">⌘K</span>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-72 p-3" onOpenAutoFocus={(e) => {
        e.preventDefault()
        inputRef.current?.focus()
      }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="flex flex-col gap-2">
          <label className="text-xs font-medium text-foreground">URL</label>
          <Input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="h-8 text-sm"
          />
          <Button type="submit" size="sm" className="h-7 self-end text-xs" disabled={!url.trim()}>
            Insert Link
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

// ── Image popover ───────────────────────────────────────────────────────────

export interface ImagePopoverProps {
  disabled?: boolean
  mode: ToolbarMode
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  editorRef?: React.RefObject<HTMLDivElement | null>
  tiptapEditor?: Editor | null
  onSourceChange?: (content: string) => void
  onRichChange?: () => void
}

export function ImagePopover({ disabled, mode, textareaRef, editorRef, tiptapEditor, onSourceChange, onRichChange }: ImagePopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState('')
  const [alt, setAlt] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    const altText = alt.trim() || 'image'

    if (mode === 'source' && textareaRef?.current) {
      insertBlock(textareaRef.current, `![${altText}](${trimmed})\n`)
      onSourceChange?.(textareaRef.current.value)
    } else if (tiptapEditor) {
      tiptapEditor.chain().focus().setImage({ src: trimmed, alt: altText }).run()
      requestAnimationFrame(() => onRichChange?.())
    } else {
      editorRef?.current?.focus()
      richInsertBlock(`<img src="${trimmed}" alt="${altText}" />`)
      requestAnimationFrame(() => onRichChange?.())
    }
    setUrl('')
    setAlt('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next)
      if (!next) { setUrl(''); setAlt('') }
    }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Image"
            >
              <ImageIcon aria-hidden="true" className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Image
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-72 p-3" onOpenAutoFocus={(e) => {
        e.preventDefault()
        inputRef.current?.focus()
      }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="flex flex-col gap-2">
          <label className="text-xs font-medium text-foreground">Image URL</label>
          <Input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="h-8 text-sm"
          />
          <label className="text-xs font-medium text-foreground">Alt text</label>
          <Input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Describe the image…"
            className="h-8 text-sm"
          />
          <Button type="submit" size="sm" className="h-7 self-end text-xs" disabled={!url.trim()}>
            Insert Image
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

'use client'

import * as React from 'react'
import { Bold, Italic, Link2, Code, Strikethrough } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface BubbleMenuProps {
  editorRef: React.RefObject<HTMLDivElement | null>
  onAction: (action: string) => void
  onLinkAction: () => void
}

export function DocBubbleMenu({ editorRef, onAction, onLinkAction }: BubbleMenuProps) {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null)
  const [isVisible, setIsVisible] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const updatePosition = React.useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !editorRef.current || !selection.rangeCount) {
      setIsVisible(false)
      return
    }

    const range = selection.getRangeAt(0)
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      setIsVisible(false)
      return
    }

    const rect = range.getBoundingClientRect()

    // Calculate position relative to editor container or viewport
    // For simplicity, we'll use fixed positioning if needed, or absolute if the parent is relative.
    // The DocEditor has a relative canvas.
    const parent = editorRef.current.parentElement
    if (!parent) return

    const parentRect = parent.getBoundingClientRect()

    setPosition({
      top: rect.top - parentRect.top - 48, // 48px above the selection
      left: rect.left - parentRect.left + rect.width / 2,
    })
    setIsVisible(true)
  }, [editorRef])

  React.useEffect(() => {
    const handleSelectionChange = () => {
      // Small delay to let the selection settle
      requestAnimationFrame(updatePosition)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    window.addEventListener('resize', updatePosition)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      window.removeEventListener('resize', updatePosition)
    }
  }, [updatePosition])

  if (!isVisible || !position) return null

  return (
    <div
      ref={menuRef}
      className="absolute z-50 flex items-center gap-0.5 rounded-lg border border-border/80 bg-background/95 p-1 shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in zoom-in-95"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
    >
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => onAction('bold')}
            >
              <Bold className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Bold</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => onAction('italic')}
            >
              <Italic className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Italic</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => onAction('strikethrough')}
            >
              <Strikethrough className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Strikethrough</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => onAction('code')}
            >
              <Code className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Inline Code</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={onLinkAction}
            >
              <Link2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Link</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

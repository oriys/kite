'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Bold,
  Check,
  ChevronRight,
  Code,
  Italic,
  Languages,
  Link2,
  Loader2,
  PencilLine,
  Sparkles,
  Strikethrough,
} from 'lucide-react'
import {
  AI_ACTION_LABELS,
  formatAiContextWindow,
  type AiCatalogModel,
  type AiTransformAction,
} from '@/lib/ai'
import { cn } from '@/lib/utils'
import { DocAiPromptInlineManager } from '@/components/docs/doc-ai-prompt-inline-manager'
import { DocAiGlyph } from '@/components/docs/doc-ai-glyph'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  onAiAction: (action: AiTransformAction, options?: { targetLanguage?: string }) => void
  onOpenAiCustomPrompt: () => void
  aiPendingAction?: AiTransformAction | null
  enabledModels: AiCatalogModel[]
  activeModelId: string | null
  onActiveModelChange: (modelId: string) => void
  aiModelsLoading?: boolean
}

interface BubbleMenuPosition {
  top: number
  left: number
}

type AiFlyoutPanel = 'models' | 'languages' | 'prompts' | null

const MENU_VIEWPORT_PADDING = 8
const MENU_SELECTION_GAP = 12
const MENU_FALLBACK_HEIGHT = 44
const MENU_FALLBACK_WIDTH = 220
const MENU_HORIZONTAL_PADDING = 24
const AI_MENU_FLYOUT_GAP = 8
const AI_MENU_MODELS_WIDTH = 288
const AI_MENU_LANGUAGES_WIDTH = 224
const AI_MENU_PROMPTS_WIDTH = 416
const AI_MENU_OPEN_DELAY = 140
const AI_MENU_CLOSE_DELAY = 110

type AiFlyoutDirection = 'right' | 'left' | 'bottom'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isRectVisibleInViewport(rect: DOMRect, viewportRect: DOMRect) {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= viewportRect.top &&
    rect.top <= viewportRect.bottom &&
    rect.right >= viewportRect.left &&
    rect.left <= viewportRect.right
  )
}

function getSelectionAnchorRect(range: Range, viewportRect: DOMRect) {
  const clientRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  )

  if (clientRects.length === 0) {
    return range.getBoundingClientRect()
  }

  const visibleRects = clientRects.filter((rect) =>
    isRectVisibleInViewport(rect, viewportRect),
  )
  const candidateRects = visibleRects.length > 0 ? visibleRects : clientRects

  return candidateRects.reduce((bestRect, rect) => {
    if (rect.top < bestRect.top - 1) return rect
    if (Math.abs(rect.top - bestRect.top) <= 1 && rect.left < bestRect.left) return rect
    return bestRect
  })
}

function ShortenActionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M2.5 5h3m8 0H10.5M6 3.5 4.5 5 6 6.5M10 9.5 11.5 11 10 12.5M2.5 11h3m8 0H10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ExpandActionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 3.5 3.5 5 5 6.5M11 9.5 12.5 11 11 12.5M2.5 5h3m8 0H10.5M2.5 11h3m8 0H10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ExplainActionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4.5 4.25h7a1.75 1.75 0 0 1 1.75 1.75v4a1.75 1.75 0 0 1-1.75 1.75H8l-2.75 2v-2H4.5A1.75 1.75 0 0 1 2.75 10V6A1.75 1.75 0 0 1 4.5 4.25Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 6.75h3M6.5 9.25h2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ManageActionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3 4.25h6M10.5 4.25h2.5M3 8h2.5M7 8h6M3 11.75h6M10.5 11.75H13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="9.5" cy="4.25" r="1.25" fill="currentColor" />
      <circle cx="5.5" cy="8" r="1.25" fill="currentColor" />
      <circle cx="9.5" cy="11.75" r="1.25" fill="currentColor" />
    </svg>
  )
}

function AiMenuCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={style}
      className={cn(
        'rounded-xl border border-border/80 bg-background/96 p-1 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.32)] backdrop-blur-md',
        className,
      )}
    >
      {children}
    </div>
  )
}

function AiMenuItemContent({
  icon,
  title,
  description,
  trailing,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  trailing?: React.ReactNode
}) {
  return (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/25 text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">{title}</div>
        {description ? (
          <div className="truncate text-[10px] leading-4 text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {trailing}
    </>
  )
}

function getAiFlyoutWidth(panel: Exclude<AiFlyoutPanel, null>) {
  switch (panel) {
    case 'models':
      return AI_MENU_MODELS_WIDTH
    case 'languages':
      return AI_MENU_LANGUAGES_WIDTH
    case 'prompts':
      return AI_MENU_PROMPTS_WIDTH
  }
}

export function DocBubbleMenu({
  editorRef,
  onAction,
  onLinkAction,
  onAiAction,
  onOpenAiCustomPrompt,
  aiPendingAction,
  enabledModels,
  activeModelId,
  onActiveModelChange,
  aiModelsLoading,
}: BubbleMenuProps) {
  const router = useRouter()
  const [position, setPosition] = React.useState<BubbleMenuPosition | null>(null)
  const [isVisible, setIsVisible] = React.useState(false)
  const [aiOpen, setAiOpen] = React.useState(false)
  const [aiFlyoutPanel, setAiFlyoutPanel] = React.useState<AiFlyoutPanel>(null)
  const [aiFlyoutDirection, setAiFlyoutDirection] = React.useState<AiFlyoutDirection>('right')
  const [aiFlyoutOffsetTop, setAiFlyoutOffsetTop] = React.useState(0)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const aiMenuRootRef = React.useRef<HTMLDivElement>(null)
  const aiFlyoutAnchorRef = React.useRef<HTMLElement | null>(null)
  const aiFlyoutOpenTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiFlyoutCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeModel =
    enabledModels.find((model) => model.id === activeModelId) ?? enabledModels[0] ?? null
  const aiActionsDisabled =
    Boolean(aiPendingAction) || aiModelsLoading || enabledModels.length === 0 || !activeModel
  const translateLanguages = React.useMemo(
    () => [
      { label: 'Chinese', value: 'Simplified Chinese' },
      { label: 'English', value: 'English' },
    ],
    [],
  )

  const closeAiMenu = React.useCallback(() => {
    setAiOpen(false)
    setAiFlyoutPanel(null)
    setAiFlyoutOffsetTop(0)
    aiFlyoutAnchorRef.current = null
  }, [])

  const clearAiFlyoutTimers = React.useCallback(() => {
    if (aiFlyoutOpenTimerRef.current) {
      clearTimeout(aiFlyoutOpenTimerRef.current)
      aiFlyoutOpenTimerRef.current = null
    }

    if (aiFlyoutCloseTimerRef.current) {
      clearTimeout(aiFlyoutCloseTimerRef.current)
      aiFlyoutCloseTimerRef.current = null
    }
  }, [])

  const openAiFlyoutImmediate = React.useCallback(
    (panel: AiFlyoutPanel, anchorElement?: HTMLElement | null) => {
      clearAiFlyoutTimers()

      aiFlyoutAnchorRef.current = panel ? anchorElement ?? null : null

      if (panel && aiMenuRootRef.current && anchorElement) {
        const rootRect = aiMenuRootRef.current.getBoundingClientRect()
        const anchorRect = anchorElement.getBoundingClientRect()
        setAiFlyoutOffsetTop(Math.max(0, anchorRect.top - rootRect.top))
      } else {
        setAiFlyoutOffsetTop(0)
      }

      setAiFlyoutPanel(panel)
    },
    [clearAiFlyoutTimers],
  )

  const openAiFlyoutDelayed = React.useCallback(
    (panel: Exclude<AiFlyoutPanel, null>, anchorElement?: HTMLElement | null) => {
      clearAiFlyoutTimers()
      aiFlyoutOpenTimerRef.current = setTimeout(() => {
        aiFlyoutAnchorRef.current = anchorElement ?? null

        if (aiMenuRootRef.current && anchorElement) {
          const rootRect = aiMenuRootRef.current.getBoundingClientRect()
          const anchorRect = anchorElement.getBoundingClientRect()
          setAiFlyoutOffsetTop(Math.max(0, anchorRect.top - rootRect.top))
        } else {
          setAiFlyoutOffsetTop(0)
        }

        setAiFlyoutPanel(panel)
        aiFlyoutOpenTimerRef.current = null
      }, AI_MENU_OPEN_DELAY)
    },
    [clearAiFlyoutTimers],
  )

  const closeAiFlyoutDelayed = React.useCallback(() => {
    clearAiFlyoutTimers()
    aiFlyoutCloseTimerRef.current = setTimeout(() => {
      setAiFlyoutPanel(null)
      aiFlyoutAnchorRef.current = null
      setAiFlyoutOffsetTop(0)
      aiFlyoutCloseTimerRef.current = null
    }, AI_MENU_CLOSE_DELAY)
  }, [clearAiFlyoutTimers])

  const updatePosition = React.useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !editorRef.current || !selection.rangeCount) {
      if (!aiOpen) {
        setIsVisible(false)
      }
      return
    }

    const range = selection.getRangeAt(0)
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      if (!aiOpen) {
        setIsVisible(false)
      }
      return
    }

    const canvas = editorRef.current
    const viewport = editorRef.current.parentElement
    if (!canvas || !viewport) return

    const canvasRect = canvas.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()
    const anchorRect = getSelectionAnchorRect(range, viewportRect)
    const menuHeight = menuRef.current?.offsetHeight ?? MENU_FALLBACK_HEIGHT
    const menuWidth = menuRef.current?.offsetWidth ?? MENU_FALLBACK_WIDTH
    const menuHalfWidth = menuWidth / 2
    const toolbarLeft = clamp(
      anchorRect.left - canvasRect.left + anchorRect.width / 2,
      viewport.scrollLeft + MENU_HORIZONTAL_PADDING + menuHalfWidth,
      Math.max(
        viewport.scrollLeft + MENU_HORIZONTAL_PADDING + menuHalfWidth,
        viewport.scrollLeft + viewport.clientWidth - MENU_HORIZONTAL_PADDING - menuHalfWidth,
      ),
    )
    const selectionTop = anchorRect.top - canvasRect.top
    const selectionBottom = anchorRect.bottom - canvasRect.top
    const minTop = viewport.scrollTop + MENU_VIEWPORT_PADDING
    const maxTop = Math.max(
      minTop,
      viewport.scrollTop + viewport.clientHeight - menuHeight - MENU_VIEWPORT_PADDING,
    )
    const aboveTop = selectionTop - menuHeight - MENU_SELECTION_GAP
    const belowTop = selectionBottom + MENU_SELECTION_GAP

    const top =
      aboveTop >= minTop
        ? aboveTop
        : belowTop <= maxTop
          ? belowTop
          : clamp(aboveTop, minTop, maxTop)

    setPosition({
      top,
      left: toolbarLeft,
    })
    setIsVisible(true)
  }, [aiOpen, editorRef])

  React.useEffect(() => {
    const handleSelectionChange = () => {
      requestAnimationFrame(updatePosition)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    window.addEventListener('resize', updatePosition)
    document.addEventListener('scroll', handleSelectionChange, true)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', handleSelectionChange, true)
    }
  }, [updatePosition])

  React.useEffect(() => {
    if (!isVisible && !aiOpen) return

    const frame = requestAnimationFrame(updatePosition)
    return () => cancelAnimationFrame(frame)
  }, [aiOpen, isVisible, updatePosition])

  React.useEffect(() => {
    if (!aiOpen || !aiFlyoutPanel || !aiMenuRootRef.current) {
      return
    }

    const panelWidth = getAiFlyoutWidth(aiFlyoutPanel)

    const updateFlyoutDirection = () => {
      const rect = aiMenuRootRef.current?.getBoundingClientRect()

      if (!rect) {
        return
      }

      if (aiFlyoutAnchorRef.current) {
        const anchorRect = aiFlyoutAnchorRef.current.getBoundingClientRect()
        setAiFlyoutOffsetTop(Math.max(0, anchorRect.top - rect.top))
      }

      const rightSpace = window.innerWidth - rect.right - MENU_VIEWPORT_PADDING
      const leftSpace = rect.left - MENU_VIEWPORT_PADDING

      if (rightSpace >= panelWidth + AI_MENU_FLYOUT_GAP) {
        setAiFlyoutDirection('right')
        return
      }

      if (leftSpace >= panelWidth + AI_MENU_FLYOUT_GAP) {
        setAiFlyoutDirection('left')
        return
      }

      setAiFlyoutDirection('bottom')
    }

    updateFlyoutDirection()
    window.addEventListener('resize', updateFlyoutDirection)

    return () => {
      window.removeEventListener('resize', updateFlyoutDirection)
    }
  }, [aiFlyoutPanel, aiOpen])

  React.useEffect(() => {
    return () => {
      clearAiFlyoutTimers()
    }
  }, [clearAiFlyoutTimers])

  if ((!isVisible && !aiOpen) || !position) return null

  return (
    <>
      <div
        ref={menuRef}
        role="toolbar"
        aria-label="Text formatting"
        aria-orientation="horizontal"
        className="absolute z-50 flex items-center gap-0.5 rounded-lg border border-border/80 bg-background/95 p-1 shadow-lg backdrop-blur-md transition-all duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: 'translateX(-50%)',
        }}
        onMouseDown={(e) => e.preventDefault()}
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

          <Separator orientation="vertical" className="mx-1 h-4" />

          <DropdownMenu
            open={aiOpen}
            onOpenChange={(open) => {
              setAiOpen(open)

              if (!open) {
                setAiFlyoutPanel(null)
              }
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 text-muted-foreground hover:bg-muted/70 hover:text-foreground data-[state=open]:bg-muted/70 data-[state=open]:text-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                    aria-label="AI assist"
                  >
                    {aiPendingAction ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <DocAiGlyph className="size-[1rem]" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">AI assist</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={10}
              className="overflow-visible border-0 bg-transparent p-0 shadow-none"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div
                ref={aiMenuRootRef}
                className="relative"
                onMouseEnter={clearAiFlyoutTimers}
                onMouseLeave={closeAiFlyoutDelayed}
              >
                <AiMenuCard className="w-52">
                  <DropdownMenuLabel className="px-2 pb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    AI assist
                  </DropdownMenuLabel>

                  <DropdownMenuItem
                    className="rounded-lg px-2 py-2"
                    onMouseEnter={(event) =>
                      openAiFlyoutDelayed('models', event.currentTarget as HTMLElement)
                    }
                    onFocus={(event) =>
                      openAiFlyoutImmediate('models', event.currentTarget as HTMLElement)
                    }
                    onSelect={(event) => {
                      event.preventDefault()
                      openAiFlyoutImmediate('models', event.currentTarget as HTMLElement)
                    }}
                  >
                    <AiMenuItemContent
                      icon={<DocAiGlyph className="size-[0.95rem]" />}
                      title={activeModel ? `Use ${activeModel.label}` : 'Choose enabled AI'}
                      description={
                        activeModel?.id ??
                        (aiModelsLoading ? 'Loading enabled AI…' : 'No enabled AI yet')
                      }
                      trailing={<ChevronRight className="size-4 text-muted-foreground" />}
                    />
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="rounded-lg px-2 py-2"
                    disabled={aiActionsDisabled}
                    onMouseEnter={closeAiFlyoutDelayed}
                    onFocus={() => openAiFlyoutImmediate(null)}
                    onSelect={() => {
                      onAiAction('polish')
                      closeAiMenu()
                    }}
                  >
                    <AiMenuItemContent
                      icon={<Sparkles className="size-4" />}
                      title={AI_ACTION_LABELS.polish}
                    />
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="rounded-lg px-2 py-2"
                    disabled={aiActionsDisabled}
                    onMouseEnter={closeAiFlyoutDelayed}
                    onFocus={() => openAiFlyoutImmediate(null)}
                    onSelect={() => {
                      onAiAction('shorten')
                      closeAiMenu()
                    }}
                  >
                    <AiMenuItemContent
                      icon={<ShortenActionIcon className="size-4" />}
                      title={AI_ACTION_LABELS.shorten}
                    />
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="rounded-lg px-2 py-2"
                    disabled={aiActionsDisabled}
                    onMouseEnter={closeAiFlyoutDelayed}
                    onFocus={() => openAiFlyoutImmediate(null)}
                    onSelect={() => {
                      onAiAction('expand')
                      closeAiMenu()
                    }}
                  >
                    <AiMenuItemContent
                      icon={<ExpandActionIcon className="size-4" />}
                      title={AI_ACTION_LABELS.expand}
                    />
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="rounded-lg px-2 py-2"
                    disabled={aiActionsDisabled}
                    onMouseEnter={(event) =>
                      openAiFlyoutDelayed('languages', event.currentTarget as HTMLElement)
                    }
                    onFocus={(event) =>
                      openAiFlyoutImmediate('languages', event.currentTarget as HTMLElement)
                    }
                    onSelect={(event) => {
                      event.preventDefault()
                      openAiFlyoutImmediate('languages', event.currentTarget as HTMLElement)
                    }}
                  >
                    <AiMenuItemContent
                      icon={<Languages className="size-4" />}
                      title={AI_ACTION_LABELS.translate}
                      trailing={<ChevronRight className="size-4 text-muted-foreground" />}
                    />
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="rounded-lg px-2 py-2"
                    disabled={aiActionsDisabled}
                    onMouseEnter={closeAiFlyoutDelayed}
                    onFocus={() => openAiFlyoutImmediate(null)}
                    onSelect={() => {
                      onAiAction('explain')
                      closeAiMenu()
                    }}
                  >
                    <AiMenuItemContent
                      icon={<ExplainActionIcon className="size-4" />}
                      title={AI_ACTION_LABELS.explain}
                    />
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="rounded-lg px-2 py-2"
                    disabled={aiActionsDisabled}
                    onMouseEnter={closeAiFlyoutDelayed}
                    onFocus={() => openAiFlyoutImmediate(null)}
                    onSelect={() => {
                      closeAiMenu()
                      onOpenAiCustomPrompt()
                    }}
                  >
                    <AiMenuItemContent
                      icon={<PencilLine className="size-4" />}
                      title={`${AI_ACTION_LABELS.custom}...`}
                    />
                  </DropdownMenuItem>
                </AiMenuCard>

                {aiFlyoutPanel === 'models' ? (
                  <AiMenuCard
                    style={
                      aiFlyoutDirection === 'bottom'
                        ? undefined
                        : { top: `${aiFlyoutOffsetTop}px` }
                    }
                    className={cn(
                      'absolute top-0 z-10 w-72 max-w-[calc(100vw-16px)] animate-in fade-in duration-180',
                      aiFlyoutDirection === 'right' &&
                        'left-[calc(100%+8px)] slide-in-from-left-1',
                      aiFlyoutDirection === 'left' &&
                        'right-[calc(100%+8px)] slide-in-from-right-1',
                      aiFlyoutDirection === 'bottom' &&
                        'left-0 top-[calc(100%+8px)] slide-in-from-top-1',
                    )}
                  >
                    <DropdownMenuLabel className="px-2 pb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Enabled AI
                    </DropdownMenuLabel>

                    {enabledModels.length > 0 ? (
                      enabledModels.map((model) => (
                        <DropdownMenuItem
                          key={model.id}
                          className="rounded-lg px-2 py-2"
                          onSelect={() => {
                            onActiveModelChange(model.id)
                            closeAiMenu()
                          }}
                        >
                          <AiMenuItemContent
                            icon={<DocAiGlyph className="size-[0.95rem]" />}
                            title={model.label}
                            description={[
                              model.provider,
                              formatAiContextWindow(model.contextWindow),
                            ]
                              .filter(Boolean)
                              .join(' · ') || model.id}
                            trailing={
                              model.id === activeModel?.id ? (
                                <Check className="size-4 text-foreground" />
                              ) : null
                            }
                          />
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled className="rounded-lg px-2 py-2">
                        <AiMenuItemContent
                          icon={
                            aiModelsLoading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <DocAiGlyph className="size-[0.95rem]" />
                            )
                          }
                          title={aiModelsLoading ? 'Loading enabled AI…' : 'No enabled AI yet'}
                        />
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      className="rounded-lg px-2 py-2"
                      onSelect={() => {
                        closeAiMenu()
                        router.push('/docs/ai')
                      }}
                    >
                      <AiMenuItemContent
                        icon={<ManageActionIcon className="size-4" />}
                        title="Manage enabled AI"
                      />
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      className="rounded-lg px-2 py-2"
                      onMouseEnter={(event) =>
                        openAiFlyoutDelayed('prompts', event.currentTarget as HTMLElement)
                      }
                      onFocus={(event) =>
                        openAiFlyoutImmediate('prompts', event.currentTarget as HTMLElement)
                      }
                      onSelect={(event) => {
                        event.preventDefault()
                        openAiFlyoutImmediate('prompts', event.currentTarget as HTMLElement)
                      }}
                    >
                      <AiMenuItemContent
                        icon={<PencilLine className="size-4" />}
                        title="Manage AI prompts"
                        trailing={<ChevronRight className="size-4 text-muted-foreground" />}
                      />
                    </DropdownMenuItem>
                  </AiMenuCard>
                ) : null}

                {aiFlyoutPanel === 'languages' ? (
                  <AiMenuCard
                    style={
                      aiFlyoutDirection === 'bottom'
                        ? undefined
                        : { top: `${aiFlyoutOffsetTop}px` }
                    }
                    className={cn(
                      'absolute top-0 z-10 w-56 max-w-[calc(100vw-16px)] animate-in fade-in duration-180',
                      aiFlyoutDirection === 'right' &&
                        'left-[calc(100%+8px)] slide-in-from-left-1',
                      aiFlyoutDirection === 'left' &&
                        'right-[calc(100%+8px)] slide-in-from-right-1',
                      aiFlyoutDirection === 'bottom' &&
                        'left-0 top-[calc(100%+8px)] slide-in-from-top-1',
                    )}
                  >
                    <DropdownMenuLabel className="px-2 pb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Translate to
                    </DropdownMenuLabel>

                    {translateLanguages.map((language) => (
                      <DropdownMenuItem
                        key={language.value}
                        className="rounded-lg px-2 py-2"
                        onSelect={() => {
                          onAiAction('translate', { targetLanguage: language.value })
                          closeAiMenu()
                        }}
                      >
                        <AiMenuItemContent
                          icon={<Languages className="size-4" />}
                          title={language.label}
                          description={language.value}
                        />
                      </DropdownMenuItem>
                    ))}
                  </AiMenuCard>
                ) : null}

                {aiFlyoutPanel === 'prompts' ? (
                  <AiMenuCard
                    style={
                      aiFlyoutDirection === 'bottom'
                        ? undefined
                        : { top: `${aiFlyoutOffsetTop}px` }
                    }
                    className={cn(
                      'absolute top-0 z-10 w-[26rem] max-w-[calc(100vw-16px)] animate-in fade-in duration-180',
                      aiFlyoutDirection === 'right' &&
                        'left-[calc(100%+8px)] slide-in-from-left-1',
                      aiFlyoutDirection === 'left' &&
                        'right-[calc(100%+8px)] slide-in-from-right-1',
                      aiFlyoutDirection === 'bottom' &&
                        'left-0 top-[calc(100%+8px)] slide-in-from-top-1',
                    )}
                  >
                    <DocAiPromptInlineManager
                      activeModelId={activeModel?.id ?? activeModelId}
                      enabledModels={enabledModels}
                    />
                  </AiMenuCard>
                ) : null}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    </>
  )
}

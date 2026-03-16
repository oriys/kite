'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Bold,
  Check,
  ChevronRight,
  Code,
  FileText,
  Italic,
  Languages,
  Link2,
  Loader2,
  MessageSquarePlus,
  PencilLine,
  Sparkles,
  Strikethrough,
} from 'lucide-react'
import {
  AI_TONE_OPTIONS,
  AI_ACTION_LABELS,
  type AiActionOptions,
  formatAiContextWindow,
  type AiCatalogModel,
  type AiTransformAction,
} from '@/lib/ai'
import { usePersonalSettings } from '@/components/personal-settings-provider'
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
import {
  AutoFixActionIcon,
  DiagramActionIcon,
  ExplainActionIcon,
  ExpandActionIcon,
  FormatActionIcon,
  ManageActionIcon,
  ShortenActionIcon,
} from '@/components/docs/doc-bubble-menu-icons'
import {
  AI_MENU_CLOSE_DELAY,
  AI_MENU_FLYOUT_GAP,
  AI_MENU_OPEN_DELAY,
  DEFAULT_SELECTION_AI_ACTIONS,
  MENU_FALLBACK_HEIGHT,
  MENU_FALLBACK_WIDTH,
  MENU_HORIZONTAL_PADDING,
  MENU_SELECTION_GAP,
  MENU_VIEWPORT_PADDING,
  clamp,
  getAiFlyoutWidth,
  getSelectionAnchorRect,
  type AiFlyoutDirection,
  type AiFlyoutPanel,
  type BubbleMenuPosition,
} from '@/components/docs/doc-bubble-menu-helpers'
import { AiMenuCard, AiMenuItemContent } from '@/components/docs/doc-bubble-menu-cards'

interface BubbleMenuProps {
  editorRef: React.RefObject<HTMLDivElement | null>
  onAction: (action: string) => void
  onLinkAction: () => void
  formattingEnabled?: boolean
  commentsEnabled?: boolean
  onAiAction: (action: AiTransformAction, options?: AiActionOptions) => void
  onOpenAiCustomPrompt: () => void
  availableAiActions?: readonly AiTransformAction[]
  allowCustomPrompt?: boolean
  aiPendingAction?: AiTransformAction | null
  enabledModels: AiCatalogModel[]
  activeModelId: string | null
  onActiveModelChange: (modelId: string) => void
  aiModelsLoading?: boolean
}

export function DocBubbleMenu({
  editorRef,
  onAction,
  onLinkAction,
  formattingEnabled = true,
  commentsEnabled = true,
  onAiAction,
  onOpenAiCustomPrompt,
  availableAiActions,
  allowCustomPrompt = true,
  aiPendingAction,
  enabledModels,
  activeModelId,
  onActiveModelChange,
  aiModelsLoading,
}: BubbleMenuProps) {
  const { featureVisibility } = usePersonalSettings()
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
  const selectionAiActions = availableAiActions ?? DEFAULT_SELECTION_AI_ACTIONS
  const availableAiActionSet = React.useMemo(
    () => new Set<AiTransformAction>(selectionAiActions),
    [selectionAiActions],
  )
  const showRewriteActions =
    availableAiActionSet.has('polish') ||
    availableAiActionSet.has('tone') ||
    availableAiActionSet.has('autofix') ||
    availableAiActionSet.has('format') ||
    availableAiActionSet.has('shorten') ||
    availableAiActionSet.has('expand') ||
    availableAiActionSet.has('translate')
  const showAnalysisActions =
    availableAiActionSet.has('summarize') ||
    availableAiActionSet.has('explain') ||
    availableAiActionSet.has('diagram') ||
    allowCustomPrompt
  const hasAnyActions = formattingEnabled || commentsEnabled || showRewriteActions || showAnalysisActions
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

  if ((!isVisible && !aiOpen) || !position || !hasAnyActions) return null

  return (
    <>
      <div
        ref={menuRef}
        role="toolbar"
        aria-label="Selected text actions"
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
          {formattingEnabled ? (
            <>
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
            </>
          ) : null}

          {formattingEnabled && commentsEnabled ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={() => onAction('comment')}
                  >
                    <MessageSquarePlus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px]">Comment</TooltipContent>
              </Tooltip>

              {(showRewriteActions || showAnalysisActions) ? (
                <Separator orientation="vertical" className="mx-1 h-4" />
              ) : null}
            </>
          ) : formattingEnabled && (showRewriteActions || showAnalysisActions) ? (
            <Separator orientation="vertical" className="mx-1 h-4" />
          ) : null}

          {showRewriteActions || showAnalysisActions ? (
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

                  {showRewriteActions ? (
                    <>
                      {availableAiActionSet.has('polish') ? (
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
                      ) : null}

                      {availableAiActionSet.has('autofix') ? (
                        <DropdownMenuItem
                          className="rounded-lg px-2 py-2"
                          disabled={aiActionsDisabled}
                          onMouseEnter={closeAiFlyoutDelayed}
                          onFocus={() => openAiFlyoutImmediate(null)}
                          onSelect={() => {
                            onAiAction('autofix')
                            closeAiMenu()
                          }}
                        >
                          <AiMenuItemContent
                            icon={<AutoFixActionIcon className="size-4" />}
                            title={AI_ACTION_LABELS.autofix}
                            description="Correct spelling and formatting only."
                          />
                        </DropdownMenuItem>
                      ) : null}

                      {availableAiActionSet.has('tone') ? (
                        <DropdownMenuItem
                          className="rounded-lg px-2 py-2"
                          disabled={aiActionsDisabled}
                          onMouseEnter={(event) =>
                            openAiFlyoutDelayed('tones', event.currentTarget as HTMLElement)
                          }
                          onFocus={(event) =>
                            openAiFlyoutImmediate('tones', event.currentTarget as HTMLElement)
                          }
                          onSelect={(event) => {
                            event.preventDefault()
                            openAiFlyoutImmediate('tones', event.currentTarget as HTMLElement)
                          }}
                        >
                          <AiMenuItemContent
                            icon={<Sparkles className="size-4" />}
                            title={AI_ACTION_LABELS.tone}
                            trailing={<ChevronRight className="size-4 text-muted-foreground" />}
                          />
                        </DropdownMenuItem>
                      ) : null}

                      {availableAiActionSet.has('format') ? (
                        <DropdownMenuItem
                          className="rounded-lg px-2 py-2"
                          disabled={aiActionsDisabled}
                          onMouseEnter={closeAiFlyoutDelayed}
                          onFocus={() => openAiFlyoutImmediate(null)}
                          onSelect={() => {
                            onAiAction('format')
                            closeAiMenu()
                          }}
                        >
                          <AiMenuItemContent
                            icon={<FormatActionIcon className="size-4" />}
                            title={AI_ACTION_LABELS.format}
                            description="Auto-detect and apply markdown structure."
                          />
                        </DropdownMenuItem>
                      ) : null}

                      {availableAiActionSet.has('shorten') ? (
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
                      ) : null}

                      {availableAiActionSet.has('expand') ? (
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
                      ) : null}

                      {availableAiActionSet.has('translate') ? (
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
                      ) : null}
                    </>
                  ) : null}

                  {showRewriteActions && showAnalysisActions ? <DropdownMenuSeparator /> : null}

                  {availableAiActionSet.has('explain') ? (
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
                  ) : null}

                  {availableAiActionSet.has('summarize') ? (
                    <DropdownMenuItem
                      className="rounded-lg px-2 py-2"
                      disabled={aiActionsDisabled}
                      onMouseEnter={closeAiFlyoutDelayed}
                      onFocus={() => openAiFlyoutImmediate(null)}
                      onSelect={() => {
                        onAiAction('summarize')
                        closeAiMenu()
                      }}
                    >
                      <AiMenuItemContent
                        icon={<FileText className="size-4" />}
                        title={AI_ACTION_LABELS.summarize}
                        description="Capture the key points."
                      />
                    </DropdownMenuItem>
                  ) : null}

                  {availableAiActionSet.has('diagram') ? (
                    <DropdownMenuItem
                      className="rounded-lg px-2 py-2"
                      disabled={aiActionsDisabled}
                      onMouseEnter={closeAiFlyoutDelayed}
                      onFocus={() => openAiFlyoutImmediate(null)}
                      onSelect={() => {
                        onAiAction('diagram')
                        closeAiMenu()
                      }}
                    >
                      <AiMenuItemContent
                        icon={<DiagramActionIcon className="size-4" />}
                        title={AI_ACTION_LABELS.diagram}
                      />
                    </DropdownMenuItem>
                  ) : null}

                  {allowCustomPrompt ? (
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
                  ) : null}
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

                    {featureVisibility.aiWorkspace ? (
                      <>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          className="rounded-lg px-2 py-2"
                          onSelect={() => {
                            closeAiMenu()
                            router.push('/docs/settings/ai')
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
                            openAiFlyoutDelayed(
                              'prompts',
                              event.currentTarget as HTMLElement,
                            )
                          }
                          onFocus={(event) =>
                            openAiFlyoutImmediate(
                              'prompts',
                              event.currentTarget as HTMLElement,
                            )
                          }
                          onSelect={(event) => {
                            event.preventDefault()
                            openAiFlyoutImmediate(
                              'prompts',
                              event.currentTarget as HTMLElement,
                            )
                          }}
                        >
                          <AiMenuItemContent
                            icon={<PencilLine className="size-4" />}
                            title="Manage AI prompts"
                            trailing={
                              <ChevronRight className="size-4 text-muted-foreground" />
                            }
                          />
                        </DropdownMenuItem>
                      </>
                    ) : null}
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

                {aiFlyoutPanel === 'tones' ? (
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
                      Change tone to
                    </DropdownMenuLabel>

                    {AI_TONE_OPTIONS.map((tone) => (
                      <DropdownMenuItem
                        key={tone.value}
                        className="rounded-lg px-2 py-2"
                        onSelect={() => {
                          onAiAction('tone', { targetTone: tone.value })
                          closeAiMenu()
                        }}
                      >
                        <AiMenuItemContent
                          icon={<Sparkles className="size-4" />}
                          title={tone.label}
                          description={tone.value}
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
          ) : null}
        </TooltipProvider>
      </div>
    </>
  )
}

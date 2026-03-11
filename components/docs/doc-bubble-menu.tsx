'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  Code,
  Italic,
  Link2,
  Loader2,
  PencilLine,
  Strikethrough,
} from 'lucide-react'
import {
  AI_ACTION_LABELS,
  type AiCatalogModel,
  type AiTransformAction,
} from '@/lib/ai'
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

type AiMenuView = 'root' | 'models' | 'languages'

const MENU_VIEWPORT_PADDING = 8
const MENU_SELECTION_GAP = 12
const MENU_FALLBACK_HEIGHT = 44
const MENU_HORIZONTAL_PADDING = 24

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function OpenAIBlossomIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="146 227 268 265"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M249.176 323.434V298.276C249.176 296.158 249.971 294.569 251.825 293.509L302.406 264.381C309.29 260.409 317.5 258.555 325.973 258.555C357.75 258.555 377.877 283.185 377.877 309.399C377.877 311.253 377.877 313.371 377.611 315.49L325.178 284.771C322.001 282.919 318.822 282.919 315.645 284.771L249.176 323.434ZM367.283 421.415V361.301C367.283 357.592 365.694 354.945 362.516 353.092L296.048 314.43L317.763 301.982C319.617 300.925 321.206 300.925 323.058 301.982L373.639 331.112C388.205 339.586 398.003 357.592 398.003 375.069C398.003 395.195 386.087 413.733 367.283 421.412V421.415ZM233.553 368.452L211.838 355.742C209.986 354.684 209.19 353.095 209.19 350.975V292.718C209.19 264.383 230.905 242.932 260.301 242.932C271.423 242.932 281.748 246.641 290.49 253.26L238.321 283.449C235.146 285.303 233.555 287.951 233.555 291.659V368.455L233.553 368.452ZM280.292 395.462L249.176 377.985V340.913L280.292 323.436L311.407 340.913V377.985L280.292 395.462ZM300.286 475.968C289.163 475.968 278.837 472.259 270.097 465.64L322.264 435.449C325.441 433.597 327.03 430.949 327.03 427.239V350.445L349.011 363.155C350.865 364.213 351.66 365.802 351.66 367.922V426.179C351.66 454.514 329.679 475.965 300.286 475.965V475.968ZM237.525 416.915L186.944 387.785C172.378 379.31 162.582 361.305 162.582 343.827C162.582 323.436 174.763 305.164 193.563 297.485V357.861C193.563 361.571 195.154 364.217 198.33 366.071L264.535 404.467L242.82 416.915C240.967 417.972 239.377 417.972 237.525 416.915ZM234.614 460.343C204.689 460.343 182.71 437.833 182.71 410.028C182.71 407.91 182.976 405.792 183.238 403.672L235.405 433.863C238.582 435.715 241.763 435.715 244.938 433.863L311.407 395.466V420.622C311.407 422.742 310.612 424.331 308.758 425.389L258.179 454.519C251.293 458.491 243.083 460.343 234.611 460.343H234.614ZM300.286 491.854C332.329 491.854 359.073 469.082 365.167 438.892C394.825 431.211 413.892 403.406 413.892 375.073C413.892 356.535 405.948 338.529 391.648 325.552C392.972 319.991 393.766 314.43 393.766 308.87C393.766 271.003 363.048 242.666 327.562 242.666C320.413 242.666 313.528 243.723 306.644 246.109C294.725 234.457 278.307 227.042 260.301 227.042C228.258 227.042 201.513 249.815 195.42 280.004C165.761 287.685 146.694 315.49 146.694 343.824C146.694 362.362 154.638 380.368 168.938 393.344C167.613 398.906 166.819 404.467 166.819 410.027C166.819 447.894 197.538 476.231 233.024 476.231C240.172 476.231 247.058 475.173 253.943 472.788C265.859 484.441 282.278 491.854 300.286 491.854Z"
        fill="currentColor"
      />
    </svg>
  )
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
  const [aiMenuView, setAiMenuView] = React.useState<AiMenuView>('root')
  const menuRef = React.useRef<HTMLDivElement>(null)
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
    setAiMenuView('root')
  }, [])

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

    const rect = range.getBoundingClientRect()

    const canvas = editorRef.current.parentElement
    const viewport = canvas?.parentElement
    if (!canvas || !viewport) return

    const canvasRect = canvas.getBoundingClientRect()
    const toolbarLeft = clamp(
      rect.left - canvasRect.left + rect.width / 2,
      viewport.scrollLeft + MENU_HORIZONTAL_PADDING,
      Math.max(
        viewport.scrollLeft + MENU_HORIZONTAL_PADDING,
        viewport.scrollLeft + viewport.clientWidth - MENU_HORIZONTAL_PADDING,
      ),
    )
    const menuHeight = menuRef.current?.offsetHeight ?? MENU_FALLBACK_HEIGHT
    const selectionTop = rect.top - canvasRect.top
    const selectionBottom = rect.bottom - canvasRect.top
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

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      window.removeEventListener('resize', updatePosition)
    }
  }, [updatePosition])

  React.useEffect(() => {
    if (!isVisible && !aiOpen) return

    const frame = requestAnimationFrame(updatePosition)
    return () => cancelAnimationFrame(frame)
  }, [aiOpen, isVisible, updatePosition])

  if ((!isVisible && !aiOpen) || !position) return null

  return (
    <>
      <div
        ref={menuRef}
        className="absolute z-50 flex items-center gap-0.5 rounded-lg border border-border/80 bg-background/95 p-1 shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in zoom-in-95"
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
                setAiMenuView('root')
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
                      <OpenAIBlossomIcon className="size-[1rem]" />
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
              className="rounded-xl border-border/80 bg-background/96 p-1.5 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.38)] backdrop-blur-md"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {aiMenuView === 'root' ? (
                <div className="w-52">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    AI assist
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      setAiMenuView('models')
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">
                        {activeModel ? `Use ${activeModel.label}` : 'Choose enabled AI'}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {activeModel?.id ??
                          (aiModelsLoading ? 'Loading enabled AI…' : 'No enabled AI yet')}
                      </span>
                    </div>
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={aiActionsDisabled}
                    onSelect={() => onAiAction('polish')}
                  >
                    {AI_ACTION_LABELS.polish}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={aiActionsDisabled}
                    onSelect={() => onAiAction('shorten')}
                  >
                    {AI_ACTION_LABELS.shorten}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={aiActionsDisabled}
                    onSelect={() => onAiAction('expand')}
                  >
                    {AI_ACTION_LABELS.expand}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={aiActionsDisabled}
                    onSelect={(event) => {
                      event.preventDefault()
                      setAiMenuView('languages')
                    }}
                  >
                    <span>{AI_ACTION_LABELS.translate}</span>
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={aiActionsDisabled}
                    onSelect={() => onAiAction('explain')}
                  >
                    {AI_ACTION_LABELS.explain}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={aiActionsDisabled}
                    onSelect={() => {
                      closeAiMenu()
                      onOpenAiCustomPrompt()
                    }}
                  >
                    <PencilLine className="size-4 text-muted-foreground" />
                    {AI_ACTION_LABELS.custom}...
                  </DropdownMenuItem>
                </div>
              ) : null}

              {aiMenuView === 'models' ? (
                <div className="w-72">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Enabled AI
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      setAiMenuView('root')
                    }}
                  >
                    <ChevronLeft className="size-4 text-muted-foreground" />
                    Back
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {enabledModels.length > 0 ? (
                    enabledModels.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onSelect={() => {
                          onActiveModelChange(model.id)
                          closeAiMenu()
                        }}
                      >
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{model.label}</span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {model.id}
                          </span>
                        </div>
                        {model.id === activeModel?.id ? (
                          <Check className="ml-auto size-4 text-foreground" />
                        ) : null}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      {aiModelsLoading ? 'Loading enabled AI…' : 'No enabled AI yet'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      closeAiMenu()
                      router.push('/docs/ai')
                    }}
                  >
                    Manage enabled AI
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      closeAiMenu()
                      router.push('/docs/ai/prompts')
                    }}
                  >
                    Manage AI prompts
                  </DropdownMenuItem>
                </div>
              ) : null}

              {aiMenuView === 'languages' ? (
                <div className="w-56">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Translate to
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      setAiMenuView('root')
                    }}
                  >
                    <ChevronLeft className="size-4 text-muted-foreground" />
                    Back
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {translateLanguages.map((language) => (
                    <DropdownMenuItem
                      key={language.value}
                      onSelect={() => {
                        onAiAction('translate', { targetLanguage: language.value })
                        closeAiMenu()
                      }}
                    >
                      {language.label}
                    </DropdownMenuItem>
                  ))}
                </div>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    </>
  )
}

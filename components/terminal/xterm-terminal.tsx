'use client'

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type CSSProperties,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

const MAX_OUTPUT_CHARS = 200_000
const ESTIMATED_CHAR_WIDTH = 8
const ESTIMATED_CHAR_HEIGHT = 18
const ANSI_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g
const OSC_PATTERN = /\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g

const TERM_THEME = {
  background: '#1c1b1a',
  foreground: '#e5e3df',
  cursor: '#6b8aeb',
}

interface XtermTerminalProps {
  className?: string
  style?: CSSProperties
}

type TerminalConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

type TerminalSessionStatus =
  | 'bootstrapping'
  | 'ready'
  | 'error'
  | 'closed'
  | null

function estimateTerminalSize(element: HTMLElement) {
  return {
    cols: Math.max(40, Math.floor(element.clientWidth / ESTIMATED_CHAR_WIDTH)),
    rows: Math.max(12, Math.floor(element.clientHeight / ESTIMATED_CHAR_HEIGHT)),
  }
}

function normalizeTerminalOutput(value: string) {
  return value
    .replace(OSC_PATTERN, '')
    .replace(ANSI_PATTERN, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
}

function trimTerminalOutput(value: string) {
  return value.length > MAX_OUTPUT_CHARS
    ? value.slice(value.length - MAX_OUTPUT_CHARS)
    : value
}

function getInputForKey(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (event.metaKey) {
    return null
  }

  const key = event.key
  if (event.ctrlKey) {
    if (key === 'c' || key === 'C') return '\x03'
    if (key === 'd' || key === 'D') return '\x04'
    if (key === 'l' || key === 'L') return '\x0c'
  }

  if (!event.ctrlKey && !event.altKey && key.length === 1) {
    return key
  }

  switch (key) {
    case 'Enter':
      return '\r'
    case 'Backspace':
      return '\x7f'
    case 'Tab':
      return '\t'
    case 'Escape':
      return '\x1b'
    case 'ArrowUp':
      return '\x1b[A'
    case 'ArrowDown':
      return '\x1b[B'
    case 'ArrowRight':
      return '\x1b[C'
    case 'ArrowLeft':
      return '\x1b[D'
    case 'Delete':
      return '\x1b[3~'
    case 'Home':
      return '\x1b[H'
    case 'End':
      return '\x1b[F'
    default:
      return null
  }
}

export function XtermTerminal({ className, style }: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const initedRef = useRef(false)
  const outputRef = useRef('')
  const frameRef = useRef<number | null>(null)

  const [status, setStatus] = useState<TerminalConnectionStatus>('connecting')
  const [sessionStatus, setSessionStatus] =
    useState<TerminalSessionStatus>(null)
  const [tmpDir, setTmpDir] = useState<string | null>(null)
  const [renderedOutput, setRenderedOutput] = useState('')

  const flushOutput = useCallback(() => {
    if (frameRef.current !== null) return

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      setRenderedOutput(outputRef.current)
    })
  }, [])

  const appendOutput = useCallback((chunk: string) => {
    outputRef.current = trimTerminalOutput(
      `${outputRef.current}${normalizeTerminalOutput(chunk)}`,
    )
    flushOutput()
  }, [flushOutput])

  const closeSession = useCallback((sessionId: string, preferBeacon = false) => {
    sessionIdRef.current = null
    eventSourceRef.current?.close()
    eventSourceRef.current = null

    if (preferBeacon && typeof navigator.sendBeacon === 'function') {
      try {
        const payload = new Blob([], { type: 'application/json' })
        if (navigator.sendBeacon(`/api/terminal/${sessionId}`, payload)) {
          return
        }
      } catch {
        /* fall through to fetch */
      }
    }

    fetch(`/api/terminal/${sessionId}`, {
      method: 'DELETE',
      keepalive: true,
    }).catch(() => {})
  }, [])

  const sendInput = useCallback(async (data: string) => {
    const sid = sessionIdRef.current
    if (!sid) return

    fetch(`/api/terminal/${sid}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    }).catch(() => {})
  }, [])

  const sendResize = useCallback(async (cols: number, rows: number) => {
    const sid = sessionIdRef.current
    if (!sid) return

    fetch(`/api/terminal/${sid}/resize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cols, rows }),
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true

    const container = containerRef.current
    if (!container) {
      initedRef.current = false
      return
    }
    const terminalContainer = container
    let disposed = false

    let resizeTimer: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const nextSize = estimateTerminalSize(terminalContainer)
        sendResize(nextSize.cols, nextSize.rows)
      }, 80)
    })
    observer.observe(terminalContainer)

    const abortCtrl = new AbortController()

    async function initSession() {
      try {
        const initialSize = estimateTerminalSize(terminalContainer)
        const res = await fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(initialSize),
          signal: abortCtrl.signal,
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = (await res.json()) as {
          id: string
          tmpDir: string
          status?: TerminalSessionStatus
        }

        if (disposed || abortCtrl.signal.aborted) {
          closeSession(data.id)
          return
        }

        sessionIdRef.current = data.id
        setTmpDir(data.tmpDir)
        setSessionStatus(data.status ?? null)

        const es = new EventSource(`/api/terminal/${data.id}/stream`)
        eventSourceRef.current = es

        es.onmessage = (event) => {
          appendOutput(JSON.parse(event.data))
        }

        es.addEventListener('exit', (event) => {
          const { code } = JSON.parse(
            (event as MessageEvent).data,
          ) as {
            code?: number
          }

          appendOutput(
            `\n[Process exited with code ${code ?? 'unknown'}]\n`,
          )
          setSessionStatus('closed')
          setStatus('disconnected')
        })

        es.addEventListener('status', (event) => {
          const { status: nextStatus } = JSON.parse(
            (event as MessageEvent).data,
          ) as {
            status?: TerminalSessionStatus
          }
          setSessionStatus(nextStatus ?? null)
        })

        es.onerror = () => {
          if (es.readyState === EventSource.CLOSED) {
            setStatus('disconnected')
          }
        }

        es.onopen = () => setStatus('connected')
      } catch (err) {
        if (!abortCtrl.signal.aborted) {
          setStatus('error')
          appendOutput(
            `Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}\n`,
          )
        }
      }
    }

    void initSession()

    return () => {
      disposed = true
      abortCtrl.abort()
      observer.disconnect()
      clearTimeout(resizeTimer)
      eventSourceRef.current?.close()
      eventSourceRef.current = null

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }

      if (sessionIdRef.current) {
        closeSession(sessionIdRef.current, true)
      }

      initedRef.current = false
    }
  }, [appendOutput, closeSession, sendResize])

  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [renderedOutput])

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const input = getInputForKey(event)
    if (!input) return

    event.preventDefault()
    void sendInput(input)
  }, [sendInput])

  const handlePaste = useCallback((event: ReactClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData('text')
    if (!text) return

    event.preventDefault()
    void sendInput(text)
  }, [sendInput])

  const indicatorClass =
    status === 'error'
      ? 'bg-rose-400'
      : status === 'disconnected'
        ? 'bg-neutral-500'
        : status === 'connecting' || sessionStatus === 'bootstrapping'
          ? 'bg-amber-400 animate-pulse'
          : sessionStatus === 'error'
            ? 'bg-rose-400'
            : 'bg-emerald-400'

  const statusLabel =
    status === 'connecting'
      ? 'Connecting…'
      : status === 'error'
        ? 'Connection failed'
        : status === 'disconnected'
          ? 'Disconnected'
          : sessionStatus === 'bootstrapping'
            ? 'Initializing CLI skills…'
            : sessionStatus === 'error'
              ? 'Skill bootstrap failed'
              : sessionStatus === 'closed'
                ? 'Session closed'
                : 'Terminal ready'

  return (
    <div className={className} style={style}>
      <div
        className="flex h-9 items-center gap-2 border-b border-white/[0.06] px-3 font-mono text-xs"
        style={{ backgroundColor: TERM_THEME.background }}
      >
        <span className={`inline-block size-1.5 rounded-full ${indicatorClass}`} />
        <span className="text-neutral-400">{statusLabel}</span>
        {tmpDir && (
          <span className="ml-auto truncate text-neutral-500" title={tmpDir}>
            {tmpDir}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ backgroundColor: TERM_THEME.background }}
      >
        <div
          ref={viewportRef}
          tabIndex={0}
          role="textbox"
          aria-label="Terminal"
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="h-full overflow-auto px-3 py-2 font-mono text-[13px] leading-[1.35] whitespace-pre-wrap break-words outline-none"
          style={{
            color: TERM_THEME.foreground,
            caretColor: TERM_THEME.cursor,
          }}
        >
          {renderedOutput || 'Starting terminal session…\n'}
        </div>
      </div>
    </div>
  )
}

'use client'

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type CSSProperties,
} from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

const TERM_THEME = {
  background: '#1c1b1a',
  foreground: '#e5e3df',
  cursor: '#6b8aeb',
  cursorAccent: '#1c1b1a',
  selectionBackground: 'rgba(107, 138, 235, 0.25)',
  selectionForeground: '#e5e3df',
  black: '#1c1b1a',
  red: '#e5736f',
  green: '#7ec47e',
  yellow: '#d4a852',
  blue: '#6b8aeb',
  magenta: '#c07edb',
  cyan: '#5fb8b3',
  white: '#e5e3df',
  brightBlack: '#5a5754',
  brightRed: '#f09a97',
  brightGreen: '#a3d8a3',
  brightYellow: '#e4c57a',
  brightBlue: '#92adf0',
  brightMagenta: '#d8a6f0',
  brightCyan: '#89d4cf',
  brightWhite: '#f5f4f1',
}

interface XtermTerminalProps {
  className?: string
  style?: CSSProperties
}

export function XtermTerminal({ className, style }: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const initedRef = useRef(false)

  const [status, setStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting')
  const [tmpDir, setTmpDir] = useState<string | null>(null)

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
    // Guard against React 19 strict-mode double-mount
    if (initedRef.current) return
    initedRef.current = true

    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Geist Mono", ui-monospace, monospace',
      lineHeight: 1.35,
      theme: TERM_THEME,
      allowProposedApi: true,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.open(container)

    // Small delay for container sizing to settle before first fit
    requestAnimationFrame(() => fitAddon.fit())

    termRef.current = term
    fitRef.current = fitAddon

    const inputDispose = term.onData((data) => sendInput(data))

    let resizeTimer: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        fitAddon.fit()
        sendResize(term.cols, term.rows)
      }, 80)
    })
    observer.observe(container)

    const abortCtrl = new AbortController()

    async function initSession() {
      try {
        const res = await fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cols: term.cols, rows: term.rows }),
          signal: abortCtrl.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        sessionIdRef.current = data.id
        setTmpDir(data.tmpDir)

        const es = new EventSource(`/api/terminal/${data.id}/stream`)
        eventSourceRef.current = es

        es.onmessage = (event) => {
          term.write(JSON.parse(event.data))
        }

        es.addEventListener('exit', (event) => {
          const { code } = JSON.parse(event.data)
          term.write(
            `\r\n\x1b[38;5;245m[Process exited with code ${code}]\x1b[0m\r\n`,
          )
          setStatus('disconnected')
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
          term.write(
            `\x1b[31mFailed to connect: ${err instanceof Error ? err.message : 'Unknown error'}\x1b[0m\r\n`,
          )
        }
      }
    }

    initSession()

    return () => {
      abortCtrl.abort()
      inputDispose.dispose()
      observer.disconnect()
      clearTimeout(resizeTimer)
      eventSourceRef.current?.close()

      if (sessionIdRef.current) {
        navigator.sendBeacon(
          `/api/terminal/${sessionIdRef.current}`,
          // sendBeacon doesn't support DELETE, so we fall back to fetch
        )
        fetch(`/api/terminal/${sessionIdRef.current}`, {
          method: 'DELETE',
        }).catch(() => {})
      }

      term.dispose()
      initedRef.current = false
    }
  }, [sendInput, sendResize])

  return (
    <div className={className} style={style}>
      {/* Status bar */}
      <div className="flex h-9 items-center gap-2 border-b border-white/[0.06] bg-[#1c1b1a] px-3 font-mono text-xs">
        <span
          className={`inline-block size-1.5 rounded-full ${
            status === 'connected'
              ? 'bg-emerald-400'
              : status === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : status === 'error'
                  ? 'bg-rose-400'
                  : 'bg-neutral-500'
          }`}
        />
        <span className="text-neutral-400">
          {status === 'connecting'
            ? 'Connecting…'
            : status === 'connected'
              ? 'Terminal'
              : status === 'error'
                ? 'Connection failed'
                : 'Disconnected'}
        </span>
        {tmpDir && (
          <span className="ml-auto truncate text-neutral-500" title={tmpDir}>
            {tmpDir}
          </span>
        )}
      </div>

      {/* Terminal */}
      <div
        ref={containerRef}
        className="flex-1 [&_.xterm]:h-full [&_.xterm-viewport]:!overflow-hidden"
        style={{ height: 'calc(100% - 2.25rem)' }}
      />
    </div>
  )
}

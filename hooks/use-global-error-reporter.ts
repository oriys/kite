'use client'

import { useEffect, useCallback, useRef } from 'react'

interface ClientErrorPayload {
  errorName: string
  errorMessage: string
  errorStack?: string
  componentStack?: string
  errorDigest?: string
  url: string
  context?: Record<string, unknown>
}

function buildClientRuntimeContext(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    referrer: document.referrer || undefined,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    online: navigator.onLine,
    language: navigator.language,
    languages: navigator.languages,
  }
}

function sendErrorReport(payload: ClientErrorPayload) {
  try {
    const body = JSON.stringify(payload)
    if (typeof navigator?.sendBeacon === 'function') {
      navigator.sendBeacon(
        '/api/error-reports',
        new Blob([body], { type: 'application/json' }),
      )
    } else {
      fetch('/api/error-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }).catch(() => {})
    }
  } catch {
    // Swallow
  }
}

/**
 * Hook: attach global window.onerror and unhandledrejection listeners.
 * Mount once in the root layout to catch uncaught client-side errors.
 */
export function useGlobalErrorReporter() {
  const reported = useRef(new Set<string>())

  const report = useCallback((payload: ClientErrorPayload) => {
    // Dedup within session
    const key = `${payload.errorName}:${payload.errorMessage}`
    if (reported.current.has(key)) return
    reported.current.add(key)
    sendErrorReport(payload)
  }, [])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      report({
        errorName: event.error?.name ?? 'Error',
        errorMessage: event.message,
        errorStack: event.error?.stack,
        url: window.location.href,
        context: buildClientRuntimeContext({
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }),
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      report({
        errorName: reason instanceof Error ? reason.name : 'UnhandledRejection',
        errorMessage:
          reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
              ? reason
              : 'Unhandled promise rejection',
        errorStack: reason instanceof Error ? reason.stack : undefined,
        url: window.location.href,
        context: buildClientRuntimeContext({
          rejectionType: 'unhandledrejection',
        }),
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [report])
}

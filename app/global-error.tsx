'use client'

import { useEffect } from 'react'
import { attemptClientRuntimeRecovery } from '@/lib/client-runtime-recovery'

type ReportErrorExtra = {
  context?: Record<string, unknown>
  [key: string]: unknown
}

function reportErrorToServer(error: Error & { digest?: string }, extra?: ReportErrorExtra) {
  try {
    const extraContext =
      typeof extra?.context === 'object' && extra.context !== null
        ? extra.context as Record<string, unknown>
        : undefined
    const extraFields: Record<string, unknown> = extra ? { ...extra } : {}
    delete extraFields.context

    const payload = {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      errorDigest: error.digest,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      context: {
        boundary: 'global-error',
        ...extraContext,
      },
      ...extraFields,
    }

    // Use sendBeacon for reliability (works even during page unload)
    if (typeof navigator?.sendBeacon === 'function') {
      navigator.sendBeacon(
        '/api/error-reports',
        new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      )
    } else {
      fetch('/api/error-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {})
    }
  } catch {
    // Swallow — error reporting should never throw
  }
}

/**
 * Next.js global error boundary — catches errors in the root layout.
 * Reports to /api/error-reports and shows a minimal fallback UI.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const recovery = attemptClientRuntimeRecovery(error)
    if (recovery.triggered) {
      return
    }

    reportErrorToServer(error, {
      context: {
        boundary: 'global-error',
        recoveryKind: recovery.kind,
        recoveryAlreadyAttempted: recovery.alreadyAttempted || undefined,
      },
    })
  }, [error])

  return (
    <html>
      <body
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: '#fafaf9',
          color: '#1c1917',
          margin: 0,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: 14,
              color: '#78716c',
              marginBottom: 24,
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred. The error has been reported automatically.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                color: '#a8a29e',
                fontFamily: 'monospace',
                marginBottom: 16,
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 500,
              border: '1px solid #d6d3d1',
              borderRadius: 6,
              background: '#fff',
              color: '#1c1917',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

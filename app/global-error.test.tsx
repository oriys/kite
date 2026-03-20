import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { attemptClientRuntimeRecoveryMock } = vi.hoisted(() => ({
  attemptClientRuntimeRecoveryMock: vi.fn(),
}))

vi.mock('@/lib/client-runtime-recovery', () => ({
  attemptClientRuntimeRecovery: attemptClientRuntimeRecoveryMock,
}))

const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
})

describe('GlobalError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn(() => true),
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('skips reporting when a recoverable chunk failure triggers a reload', async () => {
    attemptClientRuntimeRecoveryMock.mockReturnValue({
      kind: 'chunk-load',
      signature: 'kite:client-runtime-recovery:chunk-load',
      triggered: true,
      alreadyAttempted: false,
    })

    const { default: GlobalError } = await import('./global-error')
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      root.render(
        <GlobalError
          error={Object.assign(new Error('Failed to load chunk /_next/static/chunks/app.js'), {
            name: 'ChunkLoadError',
          })}
          reset={vi.fn()}
        />,
      )
      await Promise.resolve()
    })

    expect(window.navigator.sendBeacon).not.toHaveBeenCalled()

    act(() => {
      root.unmount()
    })
    consoleErrorSpy.mockRestore()
    container.remove()
  })

  it('reports non-recovered errors with recovery context', async () => {
    attemptClientRuntimeRecoveryMock.mockReturnValue({
      kind: 'chunk-load',
      signature: 'kite:client-runtime-recovery:chunk-load',
      triggered: false,
      alreadyAttempted: true,
    })

    const { default: GlobalError } = await import('./global-error')
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      root.render(
        <GlobalError
          error={Object.assign(new Error('Failed to load chunk /_next/static/chunks/app.js'), {
            name: 'ChunkLoadError',
            digest: 'digest_123',
          })}
          reset={vi.fn()}
        />,
      )
      await Promise.resolve()
    })

    expect(window.navigator.sendBeacon).toHaveBeenCalledTimes(1)
    const [, body] = vi.mocked(window.navigator.sendBeacon).mock.calls[0]
    expect(body).toBeInstanceOf(Blob)

    const payload = JSON.parse(await (body as Blob).text()) as {
      context: Record<string, unknown>
      errorDigest?: string
    }
    expect(payload.errorDigest).toBe('digest_123')
    expect(payload.context).toEqual({
      boundary: 'global-error',
      recoveryKind: 'chunk-load',
      recoveryAlreadyAttempted: true,
    })

    act(() => {
      root.unmount()
    })
    consoleErrorSpy.mockRestore()
    container.remove()
  })
})

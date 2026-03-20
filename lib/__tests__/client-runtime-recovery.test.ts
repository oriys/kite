import {
  attemptClientRuntimeRecovery,
  classifyRecoverableClientRuntimeError,
  clearClientRuntimeRecoveryState,
} from '@/lib/client-runtime-recovery'

function createStorage() {
  const values = new Map<string, string>()

  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
    removeItem(key: string) {
      values.delete(key)
    },
  }
}

describe('client runtime recovery', () => {
  it('classifies chunk load errors as recoverable', () => {
    expect(
      classifyRecoverableClientRuntimeError({
        name: 'ChunkLoadError',
        message: 'Failed to load chunk /_next/static/chunks/app.js',
      }),
    ).toEqual({
      kind: 'chunk-load',
      signature: 'kite:client-runtime-recovery:chunk-load',
    })

    expect(
      classifyRecoverableClientRuntimeError({
        name: 'TypeError',
        message: 'Failed to fetch dynamically imported module',
      }),
    ).toEqual({
      kind: 'chunk-load',
      signature: 'kite:client-runtime-recovery:chunk-load',
    })
  })

  it('reloads once for recoverable chunk load errors', () => {
    const storage = createStorage()
    const reload = vi.fn()

    const firstAttempt = attemptClientRuntimeRecovery(
      {
        name: 'ChunkLoadError',
        message: 'Failed to load chunk /_next/static/chunks/app.js',
      },
      { storage, reload },
    )

    const secondAttempt = attemptClientRuntimeRecovery(
      {
        name: 'ChunkLoadError',
        message: 'Failed to load chunk /_next/static/chunks/other.js',
      },
      { storage, reload },
    )

    expect(firstAttempt).toEqual({
      kind: 'chunk-load',
      signature: 'kite:client-runtime-recovery:chunk-load',
      triggered: true,
      alreadyAttempted: false,
    })
    expect(secondAttempt).toEqual({
      kind: 'chunk-load',
      signature: 'kite:client-runtime-recovery:chunk-load',
      triggered: false,
      alreadyAttempted: true,
    })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('clears recovery state after a successful mount', () => {
    const storage = createStorage()
    const reload = vi.fn()

    attemptClientRuntimeRecovery(
      {
        name: 'ChunkLoadError',
        message: 'Failed to load chunk /_next/static/chunks/app.js',
      },
      { storage, reload },
    )

    clearClientRuntimeRecoveryState(storage)

    const nextAttempt = attemptClientRuntimeRecovery(
      {
        name: 'ChunkLoadError',
        message: 'Failed to load chunk /_next/static/chunks/app.js',
      },
      { storage, reload },
    )

    expect(nextAttempt.triggered).toBe(true)
    expect(nextAttempt.alreadyAttempted).toBe(false)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})

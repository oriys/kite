import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAiAutocomplete } from '@/hooks/use-ai-autocomplete'
import { AI_AUTOCOMPLETE_DEBOUNCE_MS } from '@/lib/ai-autocomplete'

const baseContext = {
  prefix: 'x'.repeat(48),
  suffix: '',
  surface: 'rich' as const,
  language: 'markdown',
}

describe('useAiAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(' next section')))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('stops queued follow-up autocomplete until typing resumes', async () => {
    const { result } = renderHook(() =>
      useAiAutocomplete({
        enabled: true,
        modelId: 'model-1',
      }),
    )

    act(() => {
      result.current.schedule(baseContext, { reason: 'input' })
    })
    expect(result.current.queued).toBe(true)

    act(() => {
      result.current.stop()
    })
    expect(result.current.queued).toBe(false)
    expect(result.current.pending).toBe(false)

    act(() => {
      result.current.schedule(baseContext, { reason: 'passive' })
      vi.advanceTimersByTime(AI_AUTOCOMPLETE_DEBOUNCE_MS + 1)
    })
    expect(fetch).not.toHaveBeenCalled()

    await act(async () => {
      result.current.schedule(baseContext, { reason: 'input' })
      vi.advanceTimersByTime(AI_AUTOCOMPLETE_DEBOUNCE_MS + 1)
      await Promise.resolve()
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.current.queued).toBe(false)
    expect(result.current.surface).toBe('rich')
  })

  it('marks queued work before the request starts', () => {
    const { result } = renderHook(() =>
      useAiAutocomplete({
        enabled: true,
        modelId: 'model-1',
      }),
    )

    act(() => {
      result.current.schedule(baseContext, { reason: 'input' })
    })

    expect(result.current.queued).toBe(true)
    expect(result.current.pending).toBe(false)
    expect(result.current.surface).toBe('rich')
  })
})

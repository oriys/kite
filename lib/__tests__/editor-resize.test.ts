import { describe, expect, it } from 'vitest'

import { getNextAiSplitRatio } from '@/hooks/use-editor-resize'

describe('editor resize helpers', () => {
  it('grows the left AI panel when dragging the divider to the right', () => {
    expect(getNextAiSplitRatio(0.4, 120, 1000, 'left')).toBeCloseTo(0.52)
  })

  it('shrinks the right AI panel when dragging the divider to the right', () => {
    expect(getNextAiSplitRatio(0.4, 120, 1000, 'right')).toBeCloseTo(0.28)
  })

  it('clamps the AI split ratio to supported bounds', () => {
    expect(getNextAiSplitRatio(0.7, 500, 1000, 'left')).toBeLessThanOrEqual(0.72)
    expect(getNextAiSplitRatio(0.3, 500, 1000, 'right')).toBeGreaterThanOrEqual(0.24)
  })
})

import { describe, it, expect } from 'vitest'
import {
  clamp,
  getAiFlyoutWidth,
  AI_MENU_MODELS_WIDTH,
  AI_MENU_LANGUAGES_WIDTH,
  AI_MENU_PROMPTS_WIDTH,
} from '../doc-bubble-menu-helpers'

describe('doc-bubble-menu-helpers', () => {
  describe('clamp', () => {
    it('returns value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('clamps to min when below', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
    })

    it('clamps to max when above', () => {
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('handles equal min and max', () => {
      expect(clamp(5, 3, 3)).toBe(3)
    })
  })

  describe('getAiFlyoutWidth', () => {
    it('returns models width', () => {
      expect(getAiFlyoutWidth('models')).toBe(AI_MENU_MODELS_WIDTH)
    })

    it('returns languages width', () => {
      expect(getAiFlyoutWidth('languages')).toBe(AI_MENU_LANGUAGES_WIDTH)
    })

    it('returns prompts width', () => {
      expect(getAiFlyoutWidth('prompts')).toBe(AI_MENU_PROMPTS_WIDTH)
    })
  })
})

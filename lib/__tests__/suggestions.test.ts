import { describe, expect, it } from 'vitest'
import { diffWords, type WordDiffChange } from '@/lib/diff'
import {
  createSuggestion,
  pendingSuggestions,
  suggestionStats,
  nextPendingIndex,
  changesToSuggestions,
  buildDocTextWithPmMap,
  type Suggestion,
  type SuggestionReviewState,
} from '@/lib/suggestions'

// ── diffWords ───────────────────────────────────────────────────

describe('diffWords', () => {
  it('returns a single equal change for identical texts', () => {
    const changes = diffWords('hello world', 'hello world')
    const nonEqual = changes.filter((c) => c.type !== 'equal')
    expect(nonEqual).toHaveLength(0)
    expect(changes.map((c) => c.text).join('')).toBe('hello world')
  })

  it('detects a word replacement', () => {
    const changes = diffWords('the quick fox', 'the slow fox')
    const removes = changes.filter((c) => c.type === 'remove')
    const adds = changes.filter((c) => c.type === 'add')
    expect(removes.length).toBeGreaterThanOrEqual(1)
    expect(adds.length).toBeGreaterThanOrEqual(1)
    expect(removes.some((r) => r.text.includes('quick'))).toBe(true)
    expect(adds.some((a) => a.text.includes('slow'))).toBe(true)
  })

  it('detects a pure insertion', () => {
    const changes = diffWords('hello world', 'hello beautiful world')
    const adds = changes.filter((c) => c.type === 'add')
    expect(adds.length).toBeGreaterThanOrEqual(1)
    expect(adds.some((a) => a.text.includes('beautiful'))).toBe(true)
  })

  it('detects a pure deletion', () => {
    const changes = diffWords('hello beautiful world', 'hello world')
    const removes = changes.filter((c) => c.type === 'remove')
    expect(removes.length).toBeGreaterThanOrEqual(1)
    expect(removes.some((r) => r.text.includes('beautiful'))).toBe(true)
  })

  it('handles empty left text', () => {
    const changes = diffWords('', 'new text')
    const adds = changes.filter((c) => c.type === 'add')
    expect(adds.length).toBeGreaterThanOrEqual(1)
  })

  it('handles empty right text', () => {
    const changes = diffWords('old text', '')
    const removes = changes.filter((c) => c.type === 'remove')
    expect(removes.length).toBeGreaterThanOrEqual(1)
  })

  it('handles both empty', () => {
    const changes = diffWords('', '')
    expect(changes).toHaveLength(0)
  })

  it('preserves character offsets correctly', () => {
    const changes = diffWords('aaa bbb ccc', 'aaa ddd ccc')
    // Find the remove change for "bbb"
    const remove = changes.find((c) => c.type === 'remove' && c.text.includes('bbb'))
    expect(remove).toBeDefined()
    // "bbb" starts at offset 4 in original
    expect(remove!.origOffset).toBe(4)
    expect(remove!.origLength).toBe(3)
  })

  it('handles multi-word changes', () => {
    const changes = diffWords(
      'The API returns a JSON response',
      'The API sends back an XML payload',
    )
    const removes = changes.filter((c) => c.type === 'remove')
    const adds = changes.filter((c) => c.type === 'add')
    expect(removes.length).toBeGreaterThan(0)
    expect(adds.length).toBeGreaterThan(0)
  })

  it('keeps Chinese diffs scoped to changed characters', () => {
    const changes = diffWords('保留正确中文内容', '保留更新中文内容')
    const removes = changes.filter((c) => c.type === 'remove')
    const adds = changes.filter((c) => c.type === 'add')

    expect(removes).toHaveLength(1)
    expect(adds).toHaveLength(1)
    expect(removes[0].text).toBe('正确')
    expect(adds[0].text).toBe('更新')
  })
})

// ── createSuggestion ────────────────────────────────────────────

describe('createSuggestion', () => {
  it('creates a suggestion with pending status and unique id', () => {
    const s = createSuggestion({
      type: 'ai',
      from: 10,
      to: 20,
      originalText: 'old',
      replacementText: 'new',
    })
    expect(s.id).toBeTruthy()
    expect(s.status).toBe('pending')
    expect(s.type).toBe('ai')
    expect(s.from).toBe(10)
    expect(s.to).toBe(20)
  })

  it('generates unique ids', () => {
    const a = createSuggestion({ type: 'manual', from: 0, to: 5, originalText: 'a', replacementText: 'b' })
    const b = createSuggestion({ type: 'manual', from: 0, to: 5, originalText: 'a', replacementText: 'b' })
    expect(a.id).not.toBe(b.id)
  })
})

// ── pendingSuggestions / suggestionStats / nextPendingIndex ──────

describe('suggestion utilities', () => {
  const makeSuggestions = (): Suggestion[] => [
    { id: '1', type: 'ai', from: 0, to: 5, originalText: 'a', replacementText: 'b', status: 'pending' },
    { id: '2', type: 'ai', from: 10, to: 15, originalText: 'c', replacementText: 'd', status: 'accepted' },
    { id: '3', type: 'ai', from: 20, to: 25, originalText: 'e', replacementText: 'f', status: 'pending' },
    { id: '4', type: 'manual', from: 30, to: 35, originalText: 'g', replacementText: 'h', status: 'rejected' },
  ]

  it('pendingSuggestions filters correctly', () => {
    const state: SuggestionReviewState = { suggestions: makeSuggestions(), currentIndex: 0, active: true, aiLoading: null }
    expect(pendingSuggestions(state)).toHaveLength(2)
  })

  it('suggestionStats counts correctly', () => {
    const state: SuggestionReviewState = { suggestions: makeSuggestions(), currentIndex: 0, active: true, aiLoading: null }
    const stats = suggestionStats(state)
    expect(stats.pending).toBe(2)
    expect(stats.accepted).toBe(1)
    expect(stats.rejected).toBe(1)
    expect(stats.total).toBe(4)
  })

  it('nextPendingIndex finds next pending', () => {
    const suggestions = makeSuggestions()
    // Starting at index 0 (pending) → returns 0
    expect(nextPendingIndex(suggestions, 0)).toBe(0)
    // Starting at index 1 (accepted) → skips to 2 (pending)
    expect(nextPendingIndex(suggestions, 1)).toBe(2)
    // Starting at index 3 (rejected) → wraps to 0 (pending)
    expect(nextPendingIndex(suggestions, 3)).toBe(0)
  })

  it('nextPendingIndex returns -1 when none pending', () => {
    const all: Suggestion[] = [
      { id: '1', type: 'ai', from: 0, to: 5, originalText: 'a', replacementText: 'b', status: 'accepted' },
      { id: '2', type: 'ai', from: 10, to: 15, originalText: 'c', replacementText: 'd', status: 'rejected' },
    ]
    expect(nextPendingIndex(all, 0)).toBe(-1)
  })

  it('nextPendingIndex handles empty list', () => {
    expect(nextPendingIndex([], 0)).toBe(-1)
  })
})

// ── changesToSuggestions ─────────────────────────────────────────

describe('changesToSuggestions', () => {
  it('creates replacement suggestion from remove+add pair', () => {
    const changes: WordDiffChange[] = [
      { type: 'equal', text: 'hello ', origOffset: 0, origLength: 6 },
      { type: 'remove', text: 'world', origOffset: 6, origLength: 5 },
      { type: 'add', text: 'earth', origOffset: 11, origLength: 0 },
    ]
    // Simple identity map: text offset === PM position
    const textToPmMap = Array.from({ length: 20 }, (_, i) => i)
    const suggestions = changesToSuggestions(changes, textToPmMap, 'ai')

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].originalText).toBe('world')
    expect(suggestions[0].replacementText).toBe('earth')
    expect(suggestions[0].from).toBe(6)
    expect(suggestions[0].to).toBe(11)
    expect(suggestions[0].status).toBe('pending')
  })

  it('creates deletion suggestion from lone remove', () => {
    const changes: WordDiffChange[] = [
      { type: 'equal', text: 'hello ', origOffset: 0, origLength: 6 },
      { type: 'remove', text: 'beautiful ', origOffset: 6, origLength: 10 },
      { type: 'equal', text: 'world', origOffset: 16, origLength: 5 },
    ]
    const textToPmMap = Array.from({ length: 25 }, (_, i) => i)
    const suggestions = changesToSuggestions(changes, textToPmMap, 'ai')

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].originalText).toBe('beautiful ')
    expect(suggestions[0].replacementText).toBe('')
    expect(suggestions[0].from).toBe(6)
    expect(suggestions[0].to).toBe(16)
  })

  it('creates insertion suggestion from lone add', () => {
    const changes: WordDiffChange[] = [
      { type: 'equal', text: 'hello ', origOffset: 0, origLength: 6 },
      { type: 'add', text: 'beautiful ', origOffset: 6, origLength: 0 },
      { type: 'equal', text: 'world', origOffset: 6, origLength: 5 },
    ]
    const textToPmMap = Array.from({ length: 15 }, (_, i) => i)
    const suggestions = changesToSuggestions(changes, textToPmMap, 'manual')

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].originalText).toBe('')
    expect(suggestions[0].replacementText).toBe('beautiful ')
    expect(suggestions[0].from).toBe(6)
    expect(suggestions[0].to).toBe(6)
    expect(suggestions[0].type).toBe('manual')
  })

  it('skips equal-only changes', () => {
    const changes: WordDiffChange[] = [
      { type: 'equal', text: 'no changes here', origOffset: 0, origLength: 15 },
    ]
    const textToPmMap = Array.from({ length: 20 }, (_, i) => i)
    const suggestions = changesToSuggestions(changes, textToPmMap, 'ai')
    expect(suggestions).toHaveLength(0)
  })

  it('handles multiple non-adjacent changes', () => {
    const changes: WordDiffChange[] = [
      { type: 'remove', text: 'old1', origOffset: 0, origLength: 4 },
      { type: 'add', text: 'new1', origOffset: 4, origLength: 0 },
      { type: 'equal', text: ' middle ', origOffset: 4, origLength: 8 },
      { type: 'remove', text: 'old2', origOffset: 12, origLength: 4 },
      { type: 'add', text: 'new2', origOffset: 16, origLength: 0 },
    ]
    const textToPmMap = Array.from({ length: 20 }, (_, i) => i)
    const suggestions = changesToSuggestions(changes, textToPmMap, 'ai')
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].originalText).toBe('old1')
    expect(suggestions[0].replacementText).toBe('new1')
    expect(suggestions[1].originalText).toBe('old2')
    expect(suggestions[1].replacementText).toBe('new2')
  })

  it('merges adjacent replacements separated by whitespace-only equal', () => {
    // "old1 old2" → "new1 new2": two word replacements separated by a space
    const changes: WordDiffChange[] = [
      { type: 'remove', text: 'old1', origOffset: 0, origLength: 4 },
      { type: 'add', text: 'new1', origOffset: 4, origLength: 0 },
      { type: 'equal', text: ' ', origOffset: 4, origLength: 1 },
      { type: 'remove', text: 'old2', origOffset: 5, origLength: 4 },
      { type: 'add', text: 'new2', origOffset: 9, origLength: 0 },
    ]
    const textToPmMap = Array.from({ length: 15 }, (_, i) => i)
    const suggestions = changesToSuggestions(changes, textToPmMap, 'ai')

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].originalText).toBe('old1 old2')
    expect(suggestions[0].replacementText).toBe('new1 new2')
    expect(suggestions[0].from).toBe(0)
    expect(suggestions[0].to).toBe(9)
  })

  it('merges three consecutive whitespace-separated replacements', () => {
    // "aaa bbb ccc" → "xxx yyy zzz"
    const changes: WordDiffChange[] = [
      { type: 'remove', text: 'aaa', origOffset: 0, origLength: 3 },
      { type: 'add', text: 'xxx', origOffset: 3, origLength: 0 },
      { type: 'equal', text: ' ', origOffset: 3, origLength: 1 },
      { type: 'remove', text: 'bbb', origOffset: 4, origLength: 3 },
      { type: 'add', text: 'yyy', origOffset: 7, origLength: 0 },
      { type: 'equal', text: ' ', origOffset: 7, origLength: 1 },
      { type: 'remove', text: 'ccc', origOffset: 8, origLength: 3 },
      { type: 'add', text: 'zzz', origOffset: 11, origLength: 0 },
    ]
    const textToPmMap = Array.from({ length: 15 }, (_, i) => i)
    const suggestions = changesToSuggestions(changes, textToPmMap, 'ai')

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].originalText).toBe('aaa bbb ccc')
    expect(suggestions[0].replacementText).toBe('xxx yyy zzz')
    expect(suggestions[0].from).toBe(0)
    expect(suggestions[0].to).toBe(11)
  })

  it('keeps Chinese replacement ranges limited to the changed substring', () => {
    const original = '保留正确中文内容'
    const changes = diffWords(original, '保留更新中文内容')
    const textToPmMap = Array.from({ length: original.length }, (_, i) => i)
    const suggestions = changesToSuggestions(changes, textToPmMap, 'ai')

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].originalText).toBe('正确')
    expect(suggestions[0].replacementText).toBe('更新')
    expect(suggestions[0].from).toBe(2)
    expect(suggestions[0].to).toBe(4)
  })

  it('maps insertions after the final original character', () => {
    const changes: WordDiffChange[] = [
      { type: 'equal', text: '中', origOffset: 0, origLength: 1 },
      { type: 'equal', text: '文', origOffset: 1, origLength: 1 },
      { type: 'add', text: '测试', origOffset: 2, origLength: 0 },
    ]
    const suggestions = changesToSuggestions(changes, [10, 11], 'ai')

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].originalText).toBe('')
    expect(suggestions[0].replacementText).toBe('测试')
    expect(suggestions[0].from).toBe(12)
    expect(suggestions[0].to).toBe(12)
  })
})

// ── buildDocTextWithPmMap ────────────────────────────────────────

describe('buildDocTextWithPmMap', () => {
  // Helper: create a mock PM doc with text blocks.
  // Simulates: <doc(0)> <p(1)> text(2..) </p> <p> text </p> ... </doc>
  function mockDoc(blocks: string[]) {
    interface MockNode {
      isText: boolean
      isTextblock: boolean
      text?: string | null
      nodeSize: number
    }

    const nodes: { node: MockNode; pos: number }[] = []
    let pos = 0
    pos++ // doc open

    for (const text of blocks) {
      const pOpen = pos
      pos++ // paragraph open
      if (text.length > 0) {
        nodes.push({
          node: { isText: true, isTextblock: false, text, nodeSize: text.length },
          pos,
        })
      }
      pos += text.length
      pos++ // paragraph close
      nodes.push({
        node: { isText: false, isTextblock: true, nodeSize: text.length + 2 },
        pos: pOpen,
      })
    }

    return {
      content: { size: pos },
      nodesBetween(from: number, to: number, cb: (node: MockNode, pos: number) => boolean | void) {
        const sorted = [...nodes].sort((a, b) => a.pos - b.pos)
        for (const { node, pos: nPos } of sorted) {
          const nodeEnd = nPos + node.nodeSize
          if (nodeEnd <= from || nPos >= to) continue
          cb(node, nPos)
        }
      },
    }
  }

  it('extracts text and map from a single paragraph', () => {
    const doc = mockDoc(['hello'])
    const { text, map } = buildDocTextWithPmMap(doc)
    expect(text).toBe('hello')
    expect(map).toEqual([2, 3, 4, 5, 6, 7])
  })

  it('inserts newline between paragraphs', () => {
    const doc = mockDoc(['ab', 'cd'])
    const { text, map } = buildDocTextWithPmMap(doc)
    expect(text).toBe('ab\ncd')
    expect(map).toEqual([2, 3, 4, 6, 7, 8])
  })

  it('respects from/to range for selection-scoped diffs', () => {
    // "hello world" in one paragraph, select "world" (from=8, to=13)
    const doc = mockDoc(['hello world'])
    const { text, map } = buildDocTextWithPmMap(doc, 8, 13)
    expect(text).toBe('world')
    expect(map).toEqual([8, 9, 10, 11, 12, 13])
  })

  it('maps a removed paragraph separator to the block boundary, not the next first character', () => {
    const doc = mockDoc(['Category', 'Company'])
    const { text, map } = buildDocTextWithPmMap(doc)
    const suggestions = changesToSuggestions(diffWords(text, 'Category Company'), map, 'ai')

    expect(text).toBe('Category\nCompany')
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].originalText).toBe('\n')
    expect(suggestions[0].replacementText).toBe(' ')
    expect(suggestions[0].from).toBe(10)
    expect(suggestions[0].to).toBe(12)
  })
})

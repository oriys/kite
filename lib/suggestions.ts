// ─── Suggestion types and utilities ─────────────────────────────
// Client-only ephemeral state for inline revision review.

import { type WordDiffChange, diffWords } from '@/lib/diff'

export interface Suggestion {
  id: string
  type: 'ai' | 'manual'
  /** ProseMirror position — start of the original text range */
  from: number
  /** ProseMirror position — end of the original text range */
  to: number
  originalText: string
  /** Empty string for pure deletions */
  replacementText: string
  status: 'pending' | 'accepted' | 'rejected'
}

export interface AiLoadingInfo {
  actionLabel: string
  modelLabel: string
}

export interface SuggestionReviewState {
  suggestions: Suggestion[]
  currentIndex: number
  active: boolean
  /** Non-null when an AI action is in flight and will enter review on completion */
  aiLoading: AiLoadingInfo | null
}

export const SUGGESTION_INITIAL_STATE: SuggestionReviewState = {
  suggestions: [],
  currentIndex: 0,
  active: false,
  aiLoading: null,
}

// ── Factory ─────────────────────────────────────────────────────

export function createSuggestion(
  partial: Omit<Suggestion, 'id' | 'status'>,
): Suggestion {
  return {
    ...partial,
    id: crypto.randomUUID(),
    status: 'pending',
  }
}

// ── Queries ─────────────────────────────────────────────────────

export function pendingSuggestions(state: SuggestionReviewState): Suggestion[] {
  return state.suggestions.filter((s) => s.status === 'pending')
}

export function suggestionStats(state: SuggestionReviewState) {
  let pending = 0
  let accepted = 0
  let rejected = 0
  for (const s of state.suggestions) {
    if (s.status === 'pending') pending++
    else if (s.status === 'accepted') accepted++
    else rejected++
  }
  return { pending, accepted, rejected, total: state.suggestions.length }
}

/**
 * Find the next pending suggestion index starting from `startIndex`,
 * wrapping around the list. Returns -1 if none remain.
 */
export function nextPendingIndex(
  suggestions: Suggestion[],
  startIndex: number,
): number {
  const len = suggestions.length
  if (len === 0) return -1
  for (let i = 0; i < len; i++) {
    const idx = (startIndex + i) % len
    if (suggestions[idx].status === 'pending') return idx
  }
  return -1
}

// ── AI rewrite decomposition ────────────────────────────────────

/**
 * Walk a ProseMirror doc range and produce both the plain-text content and
 * a parallel array mapping each plain-text offset boundary → PM position.
 *
 * Unlike `doc.textContent`, this inserts `\n` between block-level nodes so
 * the output is diffable across paragraphs. The map includes boundaries for
 * those virtual newlines so paragraph-join/split diffs do not collapse onto
 * the first character of the next block.
 *
 * For selection-scoped rewrites pass the selection `from`/`to`.
 * For document-scoped rewrites omit them (defaults to full doc).
 */
export function buildDocTextWithPmMap(doc: {
  content: { size: number }
  nodesBetween: (
    from: number,
    to: number,
    callback: (
      node: {
        isText: boolean
        isTextblock: boolean
        text?: string | null
        nodeSize: number
      },
      pos: number,
    ) => boolean | void,
  ) => void
}, from?: number, to?: number): { text: string; map: number[] } {
  const start = from ?? 0
  const end = to ?? doc.content.size
  const chars: string[] = []
  const map: number[] = []
  let prevTextblockContentEnd = -1

  const ensureBoundary = (pos: number) => {
    if (map.length === 0) {
      map.push(pos)
      return
    }

    if (map[map.length - 1] !== pos) {
      map.push(pos)
    }
  }

  doc.nodesBetween(start, end, (node, pos) => {
    if (node.isTextblock) {
      const blockContentStart = pos + 1
      const blockContentEnd = pos + node.nodeSize - 1

      if (prevTextblockContentEnd >= 0) {
        // Separator between text blocks (mirrors doc.textBetween('\n'))
        ensureBoundary(prevTextblockContentEnd)
        chars.push('\n')
        ensureBoundary(blockContentStart)
      }
      prevTextblockContentEnd = blockContentEnd
    }

    if (node.isText && node.text) {
      const nodeStart = pos
      const nodeEnd = pos + node.text.length
      const cStart = Math.max(start, nodeStart)
      const cEnd = Math.min(end, nodeEnd)
      ensureBoundary(cStart)
      for (let i = cStart; i < cEnd; i++) {
        chars.push(node.text[i - nodeStart])
        map.push(i + 1)
      }
    }
  })

  if (map.length === 0) {
    map.push(start)
  }

  return { text: chars.join(''), map }
}

/** @deprecated Use buildDocTextWithPmMap instead */
export function buildTextToPmMap(doc: {
  nodeSize: number
  descendants: (
    callback: (
      node: { isText: boolean; text?: string | null; nodeSize: number },
      pos: number,
    ) => boolean | void,
  ) => void
}): number[] {
  const map: number[] = []
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        map.push(pos + i)
      }
    }
  })
  return map
}

/**
 * Decompose the diff between original text and AI-rewritten text into
 * individual `Suggestion` objects positioned against the ProseMirror doc.
 *
 * @param originalPlainText - plain text extracted from the editor for the range being diffed
 * @param rewrittenPlainText - plain text extracted from the AI result
 * @param textToPmMap - boundary map where `map[i]` is the PM position at plain-text offset `i`
 */
export function diffToSuggestions(
  originalPlainText: string,
  rewrittenPlainText: string,
  textToPmMap: number[],
): Suggestion[] {
  const changes = diffWords(originalPlainText, rewrittenPlainText)
  return changesToSuggestions(changes, textToPmMap, 'ai')
}

/**
 * Convert word-diff changes into Suggestion objects by mapping character
 * offsets to ProseMirror positions via the textToPmMap.
 */
export function changesToSuggestions(
  changes: WordDiffChange[],
  textToPmMap: number[],
  type: 'ai' | 'manual',
): Suggestion[] {
  const suggestions: Suggestion[] = []
  let i = 0

  while (i < changes.length) {
    const change = changes[i]

    if (change.type === 'equal') {
      i++
      continue
    }

    // Collect adjacent remove+add pairs into a single replacement suggestion,
    // merging across whitespace-only equal gaps to avoid visual fragmentation.
    if (change.type === 'remove') {
      const pmFrom = resolvePmOffset(textToPmMap, change.origOffset)
      let lastOrigEnd = change.origOffset + change.origLength
      let pmTo = resolvePmOffset(textToPmMap, lastOrigEnd)

      let origText = change.text
      let replText = ''

      // Check if the next change is an add (forming a replacement pair)
      if (i + 1 < changes.length && changes[i + 1].type === 'add') {
        replText = changes[i + 1].text
        i++ // skip the add
      }

      // Greedily merge: if next is whitespace-only equal then another remove(+add),
      // absorb them into this suggestion to produce one continuous replacement span.
      while (i + 1 < changes.length) {
        const peek = changes[i + 1]
        if (
          peek.type === 'equal' &&
          /^\s+$/.test(peek.text) &&
          i + 2 < changes.length &&
          changes[i + 2].type === 'remove'
        ) {
          const ws = peek
          const nextRemove = changes[i + 2]

          // Absorb whitespace + next removal into original
          origText += ws.text + nextRemove.text
          lastOrigEnd = nextRemove.origOffset + nextRemove.origLength
          pmTo = resolvePmOffset(textToPmMap, lastOrigEnd)

          // Mirror whitespace in replacement, then absorb paired add if present
          replText += ws.text
          i += 2 // skip equal + remove

          if (i + 1 < changes.length && changes[i + 1].type === 'add') {
            replText += changes[i + 1].text
            i++ // skip add
          }

          continue
        }
        break
      }

      suggestions.push(
        createSuggestion({
          type,
          from: pmFrom,
          to: pmTo,
          originalText: origText,
          replacementText: replText,
        }),
      )
    } else if (change.type === 'add') {
      // Pure insertion (no preceding remove)
      const insertAt = resolvePmOffset(textToPmMap, change.origOffset)

      suggestions.push(
        createSuggestion({
          type,
          from: insertAt,
          to: insertAt,
          originalText: '',
          replacementText: change.text,
        }),
      )
    }

    i++
  }

  return suggestions
}

function resolvePmOffset(textToPmMap: number[], offset: number): number {
  if (offset <= 0) return textToPmMap[0] ?? 0
  if (offset < textToPmMap.length) return textToPmMap[offset]

  const lastPmPos = textToPmMap[textToPmMap.length - 1]
  return lastPmPos == null ? 0 : lastPmPos + 1
}

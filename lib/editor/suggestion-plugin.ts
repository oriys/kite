import { Extension, type Editor } from '@tiptap/core'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Suggestion } from '@/lib/suggestions'

// ─── Suggestion Highlight Plugin ────────────────────────────────
// Renders inline decorations for pending suggestions:
//   • Deletions → strikethrough with muted background
//   • Insertions → highlighted widget span
//   • Current (focused) → additional focus ring

interface SuggestionPluginState {
  suggestions: Suggestion[]
  currentIndex: number
  active: boolean
}

const suggestionPluginKey = new PluginKey<DecorationSet>(
  'suggestionHighlight',
)

const META_KEY = 'suggestionHighlightUpdate'

function createInsertionWidget(text: string, isFocused: boolean): HTMLElement {
  const span = document.createElement('span')
  span.className = isFocused
    ? 'suggestion-insert suggestion-focused'
    : 'suggestion-insert'
  span.textContent = text
  span.setAttribute('aria-label', `Suggested insertion: ${text}`)
  return span
}

function buildDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  state: SuggestionPluginState,
): DecorationSet {
  if (!state.active || state.suggestions.length === 0) {
    return DecorationSet.empty
  }

  const decorations: Decoration[] = []

  state.suggestions.forEach((suggestion, index) => {
    if (suggestion.status !== 'pending') return

    const isFocused = index === state.currentIndex
    const focusClass = isFocused ? ' suggestion-focused' : ''

    // Deletion decoration (original text that would be removed)
    if (suggestion.from < suggestion.to) {
      // Clamp to doc size to avoid out-of-range
      const from = Math.max(0, suggestion.from)
      const to = Math.min(suggestion.to, doc.content.size)
      if (from < to) {
        decorations.push(
          Decoration.inline(from, to, {
            class: `suggestion-delete${focusClass}`,
            'data-suggestion-id': suggestion.id,
          }),
        )
      }
    }

    // Insertion widget (new text to be added)
    if (suggestion.replacementText) {
      const pos = Math.min(
        Math.max(suggestion.to, 0),
        doc.content.size,
      )
      decorations.push(
        Decoration.widget(
          pos,
          () => createInsertionWidget(suggestion.replacementText, isFocused),
          {
            side: 1,
            key: `suggestion-insert-${suggestion.id}`,
          },
        ),
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const SuggestionHighlight = Extension.create({
  name: 'suggestionHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: suggestionPluginKey,
        state: {
          init(): DecorationSet {
            return DecorationSet.empty
          },
          apply(tr, oldSet): DecorationSet {
            const meta = tr.getMeta(META_KEY) as
              | SuggestionPluginState
              | undefined
            if (meta) {
              return buildDecorations(tr.doc, meta)
            }
            // If the document changed, map decorations through the changes
            if (tr.docChanged) {
              return oldSet.map(tr.mapping, tr.doc)
            }
            return oldSet
          },
        },
        props: {
          decorations(state) {
            return suggestionPluginKey.getState(state)
          },
        },
      }),
    ]
  },
})

/**
 * Dispatch a transaction to update suggestion decorations in the editor.
 * Call this whenever the suggestion review state changes.
 */
export function updateSuggestionDecorations(
  editor: Editor,
  state: SuggestionPluginState,
) {
  const { tr } = editor.state
  tr.setMeta(META_KEY, state)
  editor.view.dispatch(tr)
}

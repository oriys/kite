import { Extension, type Editor } from '@tiptap/core'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface AutocompletePluginState {
  text: string
  from: number
  active: boolean
}

export const autocompletePluginKey = new PluginKey<DecorationSet>('autocompleteGhostText')

const META_KEY = 'autocompleteGhostTextUpdate'

function createGhostWidget(text: string) {
  const span = document.createElement('span')
  span.className =
    'pointer-events-none select-none whitespace-pre-wrap text-foreground/30'
  span.textContent = text
  span.setAttribute('aria-hidden', 'true')
  return span
}

function buildDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  state: AutocompletePluginState,
) {
  if (!state.active || !state.text) {
    return DecorationSet.empty
  }

  const pos = Math.min(Math.max(state.from, 0), doc.content.size)
  return DecorationSet.create(doc, [
    Decoration.widget(pos, () => createGhostWidget(state.text), {
      side: 1,
      ignoreSelection: true,
      key: `autocomplete-ghost-${pos}-${state.text}`,
    }),
  ])
}

export const AutocompleteGhostText = Extension.create({
  name: 'autocompleteGhostText',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: autocompletePluginKey,
        state: {
          init(): DecorationSet {
            return DecorationSet.empty
          },
          apply(tr, oldSet): DecorationSet {
            const meta = tr.getMeta(META_KEY) as AutocompletePluginState | undefined
            if (meta) {
              return buildDecorations(tr.doc, meta)
            }
            if (tr.docChanged) {
              return oldSet.map(tr.mapping, tr.doc)
            }
            return oldSet
          },
        },
        props: {
          decorations(state) {
            return autocompletePluginKey.getState(state)
          },
        },
      }),
    ]
  },
})

export function updateAutocompleteDecorations(
  editor: Editor,
  state: AutocompletePluginState,
) {
  const { tr } = editor.state
  tr.setMeta(META_KEY, state)
  editor.view.dispatch(tr)
}

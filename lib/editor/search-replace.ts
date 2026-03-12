'use client'

import { Extension } from '@tiptap/core'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'

export interface SearchReplaceStorage {
  searchTerm: string
  replaceTerm: string
  caseSensitive: boolean
  results: { from: number; to: number }[]
  currentIndex: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (term: string) => ReturnType
      setReplaceTerm: (term: string) => ReturnType
      setCaseSensitive: (value: boolean) => ReturnType
      goToNextMatch: () => ReturnType
      goToPrevMatch: () => ReturnType
      replaceCurrent: () => ReturnType
      replaceAll: () => ReturnType
      clearSearch: () => ReturnType
    }
  }
}

const searchReplacePluginKey = new PluginKey('searchReplace')

function findMatches(doc: EditorState['doc'], searchTerm: string, caseSensitive: boolean) {
  const results: { from: number; to: number }[] = []
  if (!searchTerm) return results

  const search = caseSensitive ? searchTerm : searchTerm.toLowerCase()

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = caseSensitive ? node.text : node.text.toLowerCase()
    let index = text.indexOf(search)
    while (index !== -1) {
      results.push({ from: pos + index, to: pos + index + search.length })
      index = text.indexOf(search, index + 1)
    }
  })

  return results
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStorage(editor: { storage: any }): SearchReplaceStorage {
  return getStorage(editor) as SearchReplaceStorage
}

export const SearchReplace = Extension.create<Record<string, never>, SearchReplaceStorage>({
  name: 'searchReplace',

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      results: [],
      currentIndex: -1,
    }
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ editor }) => {
          getStorage(editor).searchTerm = term
          const results = findMatches(
            editor.state.doc,
            term,
            getStorage(editor).caseSensitive,
          )
          getStorage(editor).results = results
          getStorage(editor).currentIndex = results.length > 0 ? 0 : -1

          // Trigger decoration update
          editor.view.dispatch(editor.state.tr.setMeta(searchReplacePluginKey, { updated: true }))
          return true
        },

      setReplaceTerm:
        (term: string) =>
        ({ editor }) => {
          getStorage(editor).replaceTerm = term
          return true
        },

      setCaseSensitive:
        (value: boolean) =>
        ({ editor }) => {
          getStorage(editor).caseSensitive = value
          // Re-run search
          const results = findMatches(
            editor.state.doc,
            getStorage(editor).searchTerm,
            value,
          )
          getStorage(editor).results = results
          getStorage(editor).currentIndex = results.length > 0 ? 0 : -1
          editor.view.dispatch(editor.state.tr.setMeta(searchReplacePluginKey, { updated: true }))
          return true
        },

      goToNextMatch:
        () =>
        ({ editor }) => {
          const storage = getStorage(editor)
          if (storage.results.length === 0) return false
          storage.currentIndex = (storage.currentIndex + 1) % storage.results.length
          const match = storage.results[storage.currentIndex]
          editor.view.dispatch(
            editor.state.tr
              .setMeta(searchReplacePluginKey, { updated: true })
              .scrollIntoView(),
          )
          editor.commands.setTextSelection({ from: match.from, to: match.to })
          return true
        },

      goToPrevMatch:
        () =>
        ({ editor }) => {
          const storage = getStorage(editor)
          if (storage.results.length === 0) return false
          storage.currentIndex =
            (storage.currentIndex - 1 + storage.results.length) % storage.results.length
          const match = storage.results[storage.currentIndex]
          editor.view.dispatch(
            editor.state.tr
              .setMeta(searchReplacePluginKey, { updated: true })
              .scrollIntoView(),
          )
          editor.commands.setTextSelection({ from: match.from, to: match.to })
          return true
        },

      replaceCurrent:
        () =>
        ({ editor }) => {
          const storage = getStorage(editor)
          if (storage.currentIndex < 0 || storage.results.length === 0) return false
          const match = storage.results[storage.currentIndex]
          editor
            .chain()
            .focus()
            .insertContentAt({ from: match.from, to: match.to }, storage.replaceTerm)
            .run()
          // Re-run search
          const results = findMatches(
            editor.state.doc,
            storage.searchTerm,
            storage.caseSensitive,
          )
          storage.results = results
          storage.currentIndex = Math.min(storage.currentIndex, results.length - 1)
          if (storage.currentIndex < 0 && results.length > 0) storage.currentIndex = 0
          editor.view.dispatch(editor.state.tr.setMeta(searchReplacePluginKey, { updated: true }))
          return true
        },

      replaceAll:
        () =>
        ({ editor }) => {
          const storage = getStorage(editor)
          if (storage.results.length === 0) return false
          // Replace from end to start to preserve positions
          const sortedResults = [...storage.results].sort((a, b) => b.from - a.from)
          const { tr } = editor.state
          for (const match of sortedResults) {
            tr.insertText(storage.replaceTerm, match.from, match.to)
          }
          editor.view.dispatch(tr)
          // Re-run search
          const results = findMatches(
            editor.state.doc,
            storage.searchTerm,
            storage.caseSensitive,
          )
          storage.results = results
          storage.currentIndex = results.length > 0 ? 0 : -1
          editor.view.dispatch(editor.state.tr.setMeta(searchReplacePluginKey, { updated: true }))
          return true
        },

      clearSearch:
        () =>
        ({ editor }) => {
          const storage = getStorage(editor)
          storage.searchTerm = ''
          storage.replaceTerm = ''
          storage.results = []
          storage.currentIndex = -1
          editor.view.dispatch(editor.state.tr.setMeta(searchReplacePluginKey, { updated: true }))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const extensionThis = this

    return [
      new Plugin({
        key: searchReplacePluginKey,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, oldSet) {
            if (!tr.getMeta(searchReplacePluginKey)) {
              return oldSet.map(tr.mapping, tr.doc)
            }

            const storage = extensionThis.storage as SearchReplaceStorage
            if (!storage.searchTerm || storage.results.length === 0) {
              return DecorationSet.empty
            }

            const decorations = storage.results.map((match, i) =>
              Decoration.inline(match.from, match.to, {
                class: i === storage.currentIndex ? 'search-match-current' : 'search-match',
              }),
            )

            return DecorationSet.create(tr.doc, decorations)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

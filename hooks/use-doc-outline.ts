'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'

export interface OutlineHeading {
  id: string
  text: string
  level: number
  pos: number
}

function extractHeadings(editor: Editor): OutlineHeading[] {
  const headings: OutlineHeading[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const level = node.attrs.level as number
      const text = node.textContent
      if (text.trim()) {
        headings.push({
          id: `outline-${pos}`,
          text,
          level,
          pos,
        })
      }
    }
  })
  return headings
}

export function useDocOutline(editor: Editor | null) {
  const [headings, setHeadings] = React.useState<OutlineHeading[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!editor) {
      setHeadings([])
      return
    }

    const update = () => setHeadings(extractHeadings(editor))
    update()

    editor.on('update', update)
    return () => {
      editor.off('update', update)
    }
  }, [editor])

  // Track which heading is closest to the current cursor position
  React.useEffect(() => {
    if (!editor || headings.length === 0) {
      setActiveId(null)
      return
    }

    const onSelectionUpdate = () => {
      const { from } = editor.state.selection
      let closest: OutlineHeading | null = null
      for (const h of headings) {
        if (h.pos <= from) {
          closest = h
        } else {
          break
        }
      }
      setActiveId(closest?.id ?? headings[0]?.id ?? null)
    }

    onSelectionUpdate()
    editor.on('selectionUpdate', onSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate)
    }
  }, [editor, headings])

  const scrollToHeading = React.useCallback(
    (heading: OutlineHeading) => {
      if (!editor) return

      editor.chain().focus().setTextSelection(heading.pos + 1).run()

      // Scroll the heading DOM element into view
      requestAnimationFrame(() => {
        const { node } = editor.view.domAtPos(heading.pos + 1)
        const el = node instanceof HTMLElement ? node : node.parentElement
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    },
    [editor],
  )

  return { headings, activeId, scrollToHeading }
}

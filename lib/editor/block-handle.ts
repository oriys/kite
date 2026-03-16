import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PmNode } from '@tiptap/pm/model'

export const BlockHandlePluginKey = new PluginKey('blockHandle')

export interface BlockHandleState {
  pos: number | null
  dom: HTMLElement | null
  nodeOffset: number
}

function resolveTopLevelBlockPos(view: EditorView, y: number): number | null {
  const { doc } = view.state

  // Walk top-level children and find the one whose DOM rect contains y
  let offset = 0
  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    const domNode = view.nodeDOM(offset)
    if (domNode && domNode instanceof HTMLElement) {
      const rect = domNode.getBoundingClientRect()
      if (y >= rect.top - 4 && y <= rect.bottom + 4) {
        return offset
      }
    }
    offset += child.nodeSize
  }

  return null
}

function createHandleElement(): HTMLElement {
  const handle = document.createElement('div')
  handle.className = 'doc-block-handle'
  handle.setAttribute('role', 'button')
  handle.setAttribute('aria-label', 'Drag to move block, click to open menu')
  handle.draggable = true
  handle.contentEditable = 'false'

  handle.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="5" cy="3" r="1.5"/>
    <circle cx="11" cy="3" r="1.5"/>
    <circle cx="5" cy="8" r="1.5"/>
    <circle cx="11" cy="8" r="1.5"/>
    <circle cx="5" cy="13" r="1.5"/>
    <circle cx="11" cy="13" r="1.5"/>
  </svg>`

  return handle
}

function createMenuElement(): HTMLElement {
  const menu = document.createElement('div')
  menu.className = 'doc-block-menu'
  menu.setAttribute('role', 'menu')
  return menu
}

interface MenuAction {
  id: string
  label: string
  icon: string
  group?: string
}

const MENU_ACTIONS: MenuAction[] = [
  { id: 'delete', label: 'Delete', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>' },
  { id: 'duplicate', label: 'Duplicate', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' },
  { id: 'moveUp', label: 'Move up', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>' },
  { id: 'moveDown', label: 'Move down', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>' },
  { id: 'sep', label: '', icon: '', group: 'separator' },
  { id: 'text', label: 'Text', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>', group: 'convert' },
  { id: 'h1', label: 'Heading 1', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>', group: 'convert' },
  { id: 'h2', label: 'Heading 2', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>', group: 'convert' },
  { id: 'h3', label: 'Heading 3', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>', group: 'convert' },
  { id: 'bulletList', label: 'Bullet list', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>', group: 'convert' },
  { id: 'orderedList', label: 'Numbered list', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>', group: 'convert' },
  { id: 'blockquote', label: 'Quote', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>', group: 'convert' },
]

function buildMenuHTML(): string {
  let html = ''
  let inConvert = false

  for (const action of MENU_ACTIONS) {
    if (action.group === 'separator') {
      html += '<div class="doc-block-menu-separator"></div>'
      continue
    }
    if (action.group === 'convert' && !inConvert) {
      html += '<div class="doc-block-menu-label">Turn into</div>'
      inConvert = true
    }
    html += `<button type="button" class="doc-block-menu-item" data-action="${action.id}" role="menuitem">${action.icon}<span>${action.label}</span></button>`
  }
  return html
}

export const BlockHandle = Extension.create({
  name: 'blockHandle',

  addProseMirrorPlugins() {
    const editor = this.editor
    let handle: HTMLElement | null = null
    let menu: HTMLElement | null = null
    let activePos: number | null = null
    let menuOpen = false
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    function showHandle(view: EditorView, pos: number) {
      if (!handle) return
      activePos = pos

      const domNode = view.nodeDOM(pos)
      if (!domNode || !(domNode instanceof HTMLElement)) {
        hideHandle()
        return
      }

      // Position handle inside the editor's padding gutter
      const editorDom = view.dom
      const editorRect = editorDom.getBoundingClientRect()
      const nodeRect = domNode.getBoundingClientRect()
      handle.style.top = `${nodeRect.top - editorRect.top + editorDom.scrollTop}px`
      handle.style.left = '4px'
      handle.style.display = 'flex'
    }

    function hideHandle() {
      if (menuOpen) return
      if (handle) handle.style.display = 'none'
      activePos = null
    }

    function closeMenu() {
      if (menu) {
        menu.style.display = 'none'
        menuOpen = false
      }
    }

    function openMenu(view: EditorView) {
      if (!handle || !menu || activePos === null) return
      menu.innerHTML = buildMenuHTML()
      menuOpen = true

      const handleRect = handle.getBoundingClientRect()
      const editorDom = view.dom
      const editorRect = editorDom.getBoundingClientRect()

      menu.style.top = `${handleRect.top - editorRect.top + editorDom.scrollTop}px`
      menu.style.left = `${handleRect.right - editorRect.left + 4}px`
      menu.style.display = 'block'

      // Bind menu item clicks
      menu.querySelectorAll('.doc-block-menu-item').forEach((btn) => {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          const actionId = (btn as HTMLElement).dataset.action
          if (actionId && activePos !== null) {
            executeAction(view, actionId, activePos)
          }
          closeMenu()
        })
      })
    }

    function executeAction(view: EditorView, actionId: string, pos: number) {
      const { state } = view
      const node = state.doc.nodeAt(pos)
      if (!node) return

      const nodeEnd = pos + node.nodeSize

      switch (actionId) {
        case 'delete':
          editor.chain().focus().deleteRange({ from: pos, to: nodeEnd }).run()
          break

        case 'duplicate': {
          const copy = node.copy(node.content)
          const tr = state.tr.insert(nodeEnd, copy)
          view.dispatch(tr)
          break
        }

        case 'moveUp': {
          if (pos === 0) break
          const $before = state.doc.resolve(pos)
          const indexBefore = $before.index($before.depth)
          if (indexBefore === 0) break
          const beforeNode = state.doc.child(indexBefore - 1)
          const beforePos = pos - beforeNode.nodeSize
          const tr = state.tr
          tr.delete(pos, nodeEnd)
          tr.insert(beforePos, node)
          view.dispatch(tr)
          break
        }

        case 'moveDown': {
          const index = findTopLevelIndex(state.doc, pos)
          if (index === null || index >= state.doc.content.childCount - 1) break
          const afterNode = state.doc.child(index + 1)
          const afterEnd = nodeEnd + afterNode.nodeSize
          const tr = state.tr
          tr.insert(afterEnd, node)
          tr.delete(pos, nodeEnd)
          view.dispatch(tr)
          break
        }

        case 'text':
          editor.chain().focus().setTextSelection(pos + 1).clearNodes().run()
          break
        case 'h1':
          editor.chain().focus().setTextSelection(pos + 1).setHeading({ level: 1 }).run()
          break
        case 'h2':
          editor.chain().focus().setTextSelection(pos + 1).setHeading({ level: 2 }).run()
          break
        case 'h3':
          editor.chain().focus().setTextSelection(pos + 1).setHeading({ level: 3 }).run()
          break
        case 'bulletList':
          editor.chain().focus().setTextSelection(pos + 1).toggleBulletList().run()
          break
        case 'orderedList':
          editor.chain().focus().setTextSelection(pos + 1).toggleOrderedList().run()
          break
        case 'blockquote':
          editor.chain().focus().setTextSelection(pos + 1).toggleBlockquote().run()
          break
      }
    }

    function findTopLevelIndex(doc: PmNode, pos: number): number | null {
      let offset = 0
      for (let i = 0; i < doc.content.childCount; i++) {
        if (offset === pos) return i
        offset += doc.content.child(i).nodeSize
      }
      return null
    }

    return [
      new Plugin({
        key: BlockHandlePluginKey,
        view(editorView) {
          handle = createHandleElement()
          handle.style.display = 'none'

          menu = createMenuElement()
          menu.style.display = 'none'

          // Append to the editor DOM itself (has padding gutter for the handle)
          const editorDom = editorView.dom
          editorDom.style.position = 'relative'
          editorDom.appendChild(handle)
          editorDom.appendChild(menu)

          // Handle click → open menu
          handle.addEventListener('mousedown', (e) => {
            // Let drag work; only open menu on click (no drag)
            if (e.button !== 0) return
          })

          handle.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (menuOpen) {
              closeMenu()
            } else {
              openMenu(editorView)
            }
          })

          // Drag start → set drag data
          handle.addEventListener('dragstart', (e) => {
            closeMenu()
            if (activePos === null) return
            const node = editorView.state.doc.nodeAt(activePos)
            if (!node) return

            const slice = editorView.state.doc.slice(activePos, activePos + node.nodeSize)

            // Serialize for dataTransfer
            const serializer = editorView.someProp('clipboardSerializer') as
              | { serializeFragment?: (fragment: typeof slice.content, options?: unknown) => DocumentFragment }
              | undefined
            if (serializer?.serializeFragment) {
              const dom = serializer.serializeFragment(slice.content)
              const wrapper = document.createElement('div')
              wrapper.appendChild(dom)
              e.dataTransfer?.setData('text/html', wrapper.innerHTML)
            }
            e.dataTransfer?.setData('text/plain', node.textContent ?? '')

            // Use ProseMirror's drag data
            editorView.dragging = {
              slice,
              move: true,
            }
          })

          // Close menu on click outside
          const onDocClick = (e: MouseEvent) => {
            if (menuOpen && menu && !menu.contains(e.target as Node) && !handle?.contains(e.target as Node)) {
              closeMenu()
            }
          }
          document.addEventListener('mousedown', onDocClick)

          return {
            update(view) {
              // Re-position if still showing
              if (activePos !== null && handle?.style.display !== 'none') {
                showHandle(view, activePos)
              }
            },
            destroy() {
              document.removeEventListener('mousedown', onDocClick)
              handle?.remove()
              menu?.remove()
              handle = null
              menu = null
            },
          }
        },
        props: {
          handleDOMEvents: {
            mousemove: (view, event) => {
              if (hideTimer) {
                clearTimeout(hideTimer)
                hideTimer = null
              }

              const pos = resolveTopLevelBlockPos(view, event.clientY)
              if (pos !== null) {
                showHandle(view, pos)
              } else {
                hideTimer = setTimeout(hideHandle, 200)
              }
              return false
            },
            mouseleave: () => {
              hideTimer = setTimeout(hideHandle, 300)
              return false
            },
          },
        },
      }),
    ]
  },
})

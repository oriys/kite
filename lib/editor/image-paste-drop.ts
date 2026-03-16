import TiptapImage from '@tiptap/extension-image'
import { Plugin, PluginKey } from '@tiptap/pm/state'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB

function getImageFiles(dataTransfer: DataTransfer): File[] {
  return Array.from(dataTransfer.files).filter(
    (file) => IMAGE_MIME_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE,
  )
}

const ImagePasteDropPluginKey = new PluginKey('imagePasteDrop')

export type ImageAlignment = 'left' | 'center' | 'right'

/**
 * Extended Image extension with resize, alignment, caption, and paste/drop support.
 */
export function createImagePasteDropExtension() {
  return TiptapImage.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        alignment: {
          default: 'center',
          parseHTML: (element: HTMLElement) => {
            // Check wrapper figure for alignment
            const figure = element.closest('figure')
            return figure?.dataset.align ?? element.dataset.align ?? 'center'
          },
          renderHTML: (attributes: Record<string, unknown>) => {
            return { 'data-align': attributes.alignment }
          },
        },
        caption: {
          default: '',
          parseHTML: (element: HTMLElement) => {
            const figure = element.closest('figure')
            const figcaption = figure?.querySelector('figcaption')
            return figcaption?.textContent ?? ''
          },
          renderHTML: (attributes: Record<string, unknown>) => {
            if (!attributes.caption) return {}
            return { 'data-caption': attributes.caption }
          },
        },
      }
    },

    renderHTML({ node, HTMLAttributes }) {
      const alignment = (node.attrs.alignment as string) || 'center'
      const caption = node.attrs.caption as string

      if (caption) {
        return [
          'figure',
          {
            class: 'doc-image-figure',
            'data-align': alignment,
          },
          ['img', HTMLAttributes],
          ['figcaption', {}, caption],
        ]
      }

      return [
        'figure',
        {
          class: 'doc-image-figure',
          'data-align': alignment,
        },
        ['img', HTMLAttributes],
      ]
    },

    parseHTML() {
      return [
        {
          tag: 'figure.doc-image-figure',
          contentElement: 'figcaption',
          getAttrs: (dom) => {
            const figure = dom as HTMLElement
            const img = figure.querySelector('img')
            if (!img) return false
            return {
              src: img.getAttribute('src'),
              alt: img.getAttribute('alt'),
              title: img.getAttribute('title'),
              width: img.getAttribute('width') ? Number(img.getAttribute('width')) : undefined,
              height: img.getAttribute('height') ? Number(img.getAttribute('height')) : undefined,
              alignment: figure.dataset.align ?? 'center',
              caption: figure.querySelector('figcaption')?.textContent ?? '',
            }
          },
        },
        { tag: 'img[src]' },
      ]
    },

    addNodeView() {
      return ({ node, getPos, editor: ed }) => {
        const dom = document.createElement('figure')
        dom.className = 'doc-image-figure'
        dom.dataset.align = (node.attrs.alignment as string) || 'center'
        dom.contentEditable = 'false'

        const img = document.createElement('img')
        img.src = node.attrs.src as string
        if (node.attrs.alt) img.alt = node.attrs.alt as string
        if (node.attrs.title) img.title = node.attrs.title as string
        if (node.attrs.width) img.style.width = `${node.attrs.width}px`
        if (node.attrs.height) img.style.height = `${node.attrs.height}px`
        dom.appendChild(img)

        // Caption element
        const figcaption = document.createElement('figcaption')
        figcaption.className = 'doc-image-caption'
        figcaption.contentEditable = 'true'
        figcaption.textContent = (node.attrs.caption as string) || ''
        figcaption.setAttribute('placeholder', 'Add a caption…')
        figcaption.addEventListener('input', () => {
          const pos = getPos()
          if (typeof pos !== 'number') return
          ed.view.dispatch(
            ed.view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              caption: figcaption.textContent || '',
            }),
          )
        })
        figcaption.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
          }
        })
        dom.appendChild(figcaption)

        // Alignment controls
        const controls = document.createElement('div')
        controls.className = 'doc-image-controls'

        for (const align of ['left', 'center', 'right'] as const) {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = `doc-image-align-btn${node.attrs.alignment === align ? ' active' : ''}`
          btn.dataset.align = align
          btn.setAttribute('aria-label', `Align ${align}`)
          btn.innerHTML = align === 'left'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>'
            : align === 'center'
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/></svg>'
              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>'
          btn.addEventListener('click', () => {
            const pos = getPos()
            if (typeof pos !== 'number') return
            ed.view.dispatch(
              ed.view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                alignment: align,
              }),
            )
          })
          controls.appendChild(btn)
        }
        dom.appendChild(controls)

        // Resize handles
        let isResizing = false
        let startX = 0
        let startWidth = 0

        const resizeHandle = document.createElement('div')
        resizeHandle.className = 'doc-image-resize-handle'

        const onMouseDown = (e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          isResizing = true
          startX = e.clientX
          startWidth = img.offsetWidth
          document.addEventListener('mousemove', onMouseMove)
          document.addEventListener('mouseup', onMouseUp)
          dom.classList.add('resizing')
        }

        const onMouseMove = (e: MouseEvent) => {
          if (!isResizing) return
          const diff = e.clientX - startX
          const newWidth = Math.max(80, startWidth + diff)
          img.style.width = `${newWidth}px`
          img.style.height = 'auto'
        }

        const onMouseUp = () => {
          if (!isResizing) return
          isResizing = false
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup', onMouseUp)
          dom.classList.remove('resizing')

          const pos = getPos()
          if (typeof pos !== 'number') return
          ed.view.dispatch(
            ed.view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              width: img.offsetWidth,
              height: undefined,
            }),
          )
        }

        resizeHandle.addEventListener('mousedown', onMouseDown)
        dom.appendChild(resizeHandle)

        return {
          dom,
          update: (updatedNode) => {
            if (updatedNode.type.name !== 'image') return false
            img.src = updatedNode.attrs.src as string
            if (updatedNode.attrs.alt) img.alt = updatedNode.attrs.alt as string
            if (updatedNode.attrs.width) img.style.width = `${updatedNode.attrs.width}px`
            dom.dataset.align = (updatedNode.attrs.alignment as string) || 'center'
            if (figcaption.textContent !== (updatedNode.attrs.caption || '')) {
              figcaption.textContent = updatedNode.attrs.caption as string || ''
            }
            controls.querySelectorAll('.doc-image-align-btn').forEach((btn) => {
              const el = btn as HTMLElement
              el.classList.toggle('active', el.dataset.align === updatedNode.attrs.alignment)
            })
            return true
          },
          destroy: () => {
            resizeHandle.removeEventListener('mousedown', onMouseDown)
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
          },
        }
      }
    },

    addProseMirrorPlugins() {
      const parentPlugins = this.parent?.() ?? []
      return [
        ...parentPlugins,
        new Plugin({
          key: ImagePasteDropPluginKey,
          props: {
            handlePaste: (_view, event) => {
              const files = getImageFiles(event.clipboardData ?? new DataTransfer())
              if (files.length === 0) return false

              event.preventDefault()
              for (const file of files) {
                fileToBase64(file).then((src) => {
                  this.editor
                    .chain()
                    .focus()
                    .setImage({ src, alt: file.name })
                    .run()
                })
              }
              return true
            },
            handleDrop: (_view, event, _slice, moved) => {
              if (moved) return false
              const files = getImageFiles(event.dataTransfer ?? new DataTransfer())
              if (files.length === 0) return false

              event.preventDefault()
              const pos = this.editor.view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              })
              for (const file of files) {
                fileToBase64(file).then((src) => {
                  const { tr } = this.editor.view.state
                  const insertPos = pos?.pos ?? tr.selection.from
                  const node = this.editor.schema.nodes.image.create({
                    src,
                    alt: file.name,
                  })
                  this.editor.view.dispatch(tr.insert(insertPos, node))
                })
              }
              return true
            },
          },
        }),
      ]
    },
  })
}

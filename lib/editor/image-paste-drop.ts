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

/**
 * Extended Image extension with clipboard paste and drag-drop support.
 * Images are converted to base64 data URIs (up to 5 MB).
 */
export function createImagePasteDropExtension() {
  return TiptapImage.extend({
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

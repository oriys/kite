import { Node, mergeAttributes } from '@tiptap/core'
import { renderMarkdown } from '@/lib/markdown'
import {
  decodeHeatmapDocument,
  renderHeatmapBlockFromData,
} from '@/lib/heatmap'

export const JsonViewerNode = Node.create({
  name: 'jsonViewer',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      data: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.doc-json-viewer',
        getAttrs: (dom) => ({
          data: (dom as HTMLElement).dataset.docJson || '',
        }),
      },
    ]
  },

  renderHTML({ node }) {
    return [
      'div',
      mergeAttributes({
        class: 'doc-json-viewer',
        'data-doc-json': node.attrs.data,
        contenteditable: 'false',
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'doc-json-viewer'
      dom.dataset.docJson = node.attrs.data
      dom.contentEditable = 'false'
      try {
        const json = decodeURIComponent(node.attrs.data)
        const parsed = JSON.parse(json)
        const html = renderMarkdown('```json\n' + JSON.stringify(parsed, null, 2) + '\n```')
        const wrapper = document.createElement('div')
        wrapper.innerHTML = html
        const viewer = wrapper.querySelector('.doc-json-viewer')
        if (viewer) {
          dom.innerHTML = viewer.innerHTML
        }
      } catch {
        dom.textContent = 'Invalid JSON'
      }
      return { dom }
    }
  },
})

export const SchemaViewerNode = Node.create({
  name: 'schemaViewer',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      data: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.doc-schema-viewer',
        getAttrs: (dom) => ({
          data: (dom as HTMLElement).dataset.docSchema || '',
        }),
      },
    ]
  },

  renderHTML({ node }) {
    return [
      'div',
      mergeAttributes({
        class: 'doc-schema-viewer',
        'data-doc-schema': node.attrs.data,
        contenteditable: 'false',
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'doc-schema-viewer'
      dom.dataset.docSchema = node.attrs.data
      dom.contentEditable = 'false'
      try {
        const md = decodeURIComponent(node.attrs.data)
        const html = renderMarkdown(md)
        dom.innerHTML = html
      } catch {
        dom.textContent = 'Invalid schema'
      }
      return { dom }
    }
  },
})

export const HeatmapNode = Node.create({
  name: 'heatmapBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      data: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.doc-heatmap',
        getAttrs: (dom) => ({
          data: (dom as HTMLElement).dataset.docHeatmap || '',
        }),
      },
    ]
  },

  renderHTML({ node }) {
    return [
      'div',
      mergeAttributes({
        class: 'doc-heatmap',
        'data-doc-heatmap': node.attrs.data,
        contenteditable: 'false',
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'doc-heatmap'
      dom.dataset.docHeatmap = node.attrs.data
      dom.contentEditable = 'false'
      const heatmapDoc = decodeHeatmapDocument(node.attrs.data)
      if (heatmapDoc) {
        dom.innerHTML = renderHeatmapBlockFromData(heatmapDoc)
      } else {
        dom.textContent = 'Invalid heatmap data'
      }
      return { dom }
    }
  },
})

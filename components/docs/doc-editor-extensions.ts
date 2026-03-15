import StarterKit from '@tiptap/starter-kit'
import { Table as TiptapTable } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TiptapLink from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import CharacterCount from '@tiptap/extension-character-count'
import { common, createLowlight } from 'lowlight'
import { JsonViewerNode, SchemaViewerNode, HeatmapNode } from '@/lib/editor/custom-nodes'
import { CommentMark } from '@/lib/editor/comment-marks'
import { createImagePasteDropExtension } from '@/lib/editor/image-paste-drop'
import { SearchReplace } from '@/lib/editor/search-replace'

const lowlight = createLowlight(common)

export function createEditorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      dropcursor: { color: 'oklch(0.63 0.16 244)', width: 2 },
    }),
    TiptapTable.configure({
      resizable: true,
      HTMLAttributes: { class: '' },
    }),
    TableRow,
    TableCell,
    TableHeader,
    TiptapLink.configure({
      openOnClick: false,
      HTMLAttributes: { class: '' },
    }),
    createImagePasteDropExtension().configure({
      HTMLAttributes: { class: '' },
      allowBase64: true,
    }),
    Placeholder.configure({
      placeholder: 'Start writing, or type / for commands…',
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'text',
      HTMLAttributes: {},
    }),
    CharacterCount,
    SearchReplace,
    CommentMark,
    JsonViewerNode,
    SchemaViewerNode,
    HeatmapNode,
  ]
}

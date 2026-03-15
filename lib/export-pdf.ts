import jsPDF from 'jspdf'

interface ExportPdfOptions {
  title: string
  content: string
  branding?: {
    logoUrl?: string | null
    primaryColor?: string | null
    accentColor?: string | null
  }
}

interface Block {
  type:
    | 'heading'
    | 'paragraph'
    | 'code'
    | 'list'
    | 'table'
    | 'blockquote'
    | 'hr'
  level?: number
  text?: string
  language?: string
  items?: string[]
  ordered?: boolean
  rows?: string[][]
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_LEFT = 25
const MARGIN_RIGHT = 25
const MARGIN_TOP = 30
const MARGIN_BOTTOM = 25
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
const FOOTER_Y = PAGE_HEIGHT - 15

function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace('#', '')
  if (hex.length === 3)
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  const num = parseInt(hex, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.+?\)/g, '[image]')
}

function parseMarkdownBlocks(content: string): Block[] {
  const blocks: Block[] = []
  const lines = content.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
      continue
    }

    // Code block
    const codeMatch = line.match(/^```(\w*)/)
    if (codeMatch) {
      const lang = codeMatch[1] || ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      blocks.push({
        type: 'code',
        text: codeLines.join('\n'),
        language: lang,
      })
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: stripInlineMarkdown(headingMatch[2]),
      })
      i++
      continue
    }

    // HR
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && /\|[\s-:]+\|/.test(lines[i + 1])) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|')) {
        const row = lines[i]
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean)
        if (!/^[-:\s]+$/.test(lines[i].replace(/\|/g, ''))) {
          rows.push(row.map(stripInlineMarkdown))
        }
        i++
      }
      blocks.push({ type: 'table', rows })
      continue
    }

    // List
    if (/^(\s*[-*+]|\s*\d+\.)\s/.test(line)) {
      const items: string[] = []
      const ordered = /^\s*\d+\./.test(line)
      while (i < lines.length && /^(\s*[-*+]|\s*\d+\.)\s/.test(lines[i])) {
        items.push(stripInlineMarkdown(lines[i].replace(/^\s*[-*+]\s+/, '').replace(/^\s*\d+\.\s+/, '')))
        i++
      }
      blocks.push({ type: 'list', items, ordered })
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(stripInlineMarkdown(lines[i].replace(/^>\s?/, '')))
        i++
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') })
      continue
    }

    // Paragraph: collect contiguous non-empty lines
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('>') &&
      !/^(\s*[-*+]|\s*\d+\.)\s/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: stripInlineMarkdown(paraLines.join(' ')),
      })
    }
  }

  return blocks
}

function addPageNumber(doc: jsPDF, pageNum: number, totalPages: number) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 160)
  doc.text(`${pageNum} / ${totalPages}`, PAGE_WIDTH / 2, FOOTER_Y, {
    align: 'center',
  })
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage()
    return MARGIN_TOP
  }
  return y
}

export async function exportToPdf(options: ExportPdfOptions): Promise<Uint8Array> {
  const { title, content, branding } = options
  const blocks = parseMarkdownBlocks(content)
  const primaryColor = branding?.primaryColor
    ? hexToRgb(branding.primaryColor)
    : ([30, 64, 175] as [number, number, number])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // --- Cover page ---
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, PAGE_WIDTH, 6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(30, 30, 30)
  const titleLines = doc.splitTextToSize(title, CONTENT_WIDTH)
  const titleStartY = 80
  doc.text(titleLines, MARGIN_LEFT, titleStartY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(120, 120, 120)
  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    MARGIN_LEFT,
    titleStartY + titleLines.length * 12 + 10,
  )

  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.setLineWidth(0.5)
  doc.line(
    MARGIN_LEFT,
    titleStartY + titleLines.length * 12 + 2,
    MARGIN_LEFT + 50,
    titleStartY + titleLines.length * 12 + 2,
  )

  // --- Table of Contents ---
  const headings = blocks.filter((b) => b.type === 'heading' && (b.level ?? 0) <= 3)
  if (headings.length > 0) {
    doc.addPage()
    let y = MARGIN_TOP

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(30, 30, 30)
    doc.text('Table of Contents', MARGIN_LEFT, y)
    y += 12

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    for (const h of headings) {
      y = ensureSpace(doc, y, 7)
      const indent = ((h.level ?? 1) - 1) * 6
      doc.setTextColor(80, 80, 80)
      const tocText = doc.splitTextToSize(h.text ?? '', CONTENT_WIDTH - indent)
      doc.text(tocText, MARGIN_LEFT + indent, y)
      y += tocText.length * 5 + 2
    }
  }

  // --- Content pages ---
  doc.addPage()
  let y = MARGIN_TOP

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const level = block.level ?? 1
        const fontSize = level === 1 ? 18 : level === 2 ? 14 : level === 3 ? 12 : 11
        const spacing = level <= 2 ? 10 : 6

        y = ensureSpace(doc, y, spacing + fontSize * 0.5)
        y += spacing

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(fontSize)
        if (level <= 2) {
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
        } else {
          doc.setTextColor(40, 40, 40)
        }
        const hLines = doc.splitTextToSize(block.text ?? '', CONTENT_WIDTH)
        doc.text(hLines, MARGIN_LEFT, y)
        y += hLines.length * (fontSize * 0.45) + 4
        break
      }

      case 'paragraph': {
        y = ensureSpace(doc, y, 10)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(50, 50, 50)
        const pLines = doc.splitTextToSize(block.text ?? '', CONTENT_WIDTH)
        for (const line of pLines) {
          y = ensureSpace(doc, y, 5)
          doc.text(line, MARGIN_LEFT, y)
          y += 4.5
        }
        y += 3
        break
      }

      case 'code': {
        const codeText = block.text ?? ''
        doc.setFont('courier', 'normal')
        doc.setFontSize(8.5)
        const codeLines = doc.splitTextToSize(codeText, CONTENT_WIDTH - 10)

        const blockHeight = codeLines.length * 4 + 8
        y = ensureSpace(doc, y, Math.min(blockHeight, 60))

        // Language label
        if (block.language) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(140, 140, 140)
          doc.text(block.language, MARGIN_LEFT + 4, y + 1)
          y += 5
        }

        // Background
        const bgHeight = Math.min(codeLines.length * 4 + 6, PAGE_HEIGHT - MARGIN_BOTTOM - y)
        doc.setFillColor(245, 245, 245)
        doc.roundedRect(MARGIN_LEFT, y - 3, CONTENT_WIDTH, bgHeight, 1.5, 1.5, 'F')

        doc.setFont('courier', 'normal')
        doc.setFontSize(8.5)
        doc.setTextColor(60, 60, 60)
        let codeY = y + 2
        for (const line of codeLines) {
          if (codeY > PAGE_HEIGHT - MARGIN_BOTTOM) {
            doc.addPage()
            codeY = MARGIN_TOP
            doc.setFillColor(245, 245, 245)
            const remainLines = codeLines.length * 4 + 6
            doc.roundedRect(
              MARGIN_LEFT,
              codeY - 3,
              CONTENT_WIDTH,
              Math.min(remainLines, PAGE_HEIGHT - MARGIN_BOTTOM - codeY + 3),
              1.5,
              1.5,
              'F',
            )
          }
          doc.text(line, MARGIN_LEFT + 4, codeY)
          codeY += 4
        }
        y = codeY + 4
        break
      }

      case 'list': {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(50, 50, 50)
        const listItems = block.items ?? []
        for (let idx = 0; idx < listItems.length; idx++) {
          y = ensureSpace(doc, y, 6)
          const bullet = block.ordered ? `${idx + 1}.` : '•'
          doc.text(bullet, MARGIN_LEFT + 2, y)
          const itemLines = doc.splitTextToSize(listItems[idx], CONTENT_WIDTH - 12)
          doc.text(itemLines, MARGIN_LEFT + 10, y)
          y += itemLines.length * 4.5 + 1.5
        }
        y += 2
        break
      }

      case 'table': {
        const rows = block.rows ?? []
        if (rows.length === 0) break

        const colCount = Math.max(...rows.map((r) => r.length))
        const colWidth = CONTENT_WIDTH / colCount

        y = ensureSpace(doc, y, 14)

        for (let ri = 0; ri < rows.length; ri++) {
          y = ensureSpace(doc, y, 7)
          const row = rows[ri]

          if (ri === 0) {
            doc.setFillColor(245, 245, 245)
            doc.rect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 7, 'F')
            doc.setFont('helvetica', 'bold')
          } else {
            doc.setFont('helvetica', 'normal')
          }

          doc.setFontSize(9)
          doc.setTextColor(50, 50, 50)

          for (let ci = 0; ci < colCount; ci++) {
            const cellText = ci < row.length ? row[ci] : ''
            const truncated = doc.splitTextToSize(cellText, colWidth - 4)
            doc.text(truncated[0] || '', MARGIN_LEFT + ci * colWidth + 2, y)
          }

          doc.setDrawColor(220, 220, 220)
          doc.setLineWidth(0.2)
          doc.line(MARGIN_LEFT, y + 2.5, MARGIN_LEFT + CONTENT_WIDTH, y + 2.5)
          y += 7
        }
        y += 3
        break
      }

      case 'blockquote': {
        y = ensureSpace(doc, y, 10)
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
        doc.rect(MARGIN_LEFT, y - 3, 1.5, 0, 'F')

        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        doc.setTextColor(100, 100, 100)
        const quoteLines = doc.splitTextToSize(block.text ?? '', CONTENT_WIDTH - 10)

        // Draw side bar spanning the blockquote
        const quoteHeight = quoteLines.length * 4.5 + 2
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
        doc.rect(MARGIN_LEFT, y - 2, 1.5, quoteHeight, 'F')

        for (const ql of quoteLines) {
          y = ensureSpace(doc, y, 5)
          doc.text(ql, MARGIN_LEFT + 6, y)
          y += 4.5
        }
        y += 3
        break
      }

      case 'hr': {
        y = ensureSpace(doc, y, 10)
        y += 4
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.3)
        doc.line(MARGIN_LEFT, y, MARGIN_LEFT + CONTENT_WIDTH, y)
        y += 6
        break
      }
    }
  }

  // Add page numbers
  const totalPages = doc.getNumberOfPages()
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p)
    addPageNumber(doc, p - 1, totalPages - 1)
  }

  return new Uint8Array(doc.output('arraybuffer'))
}

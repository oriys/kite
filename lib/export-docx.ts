import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  PageBreak,
  ExternalHyperlink,
} from 'docx'

interface ExportDocxOptions {
  title: string
  content: string
  branding?: {
    primaryColor?: string | null
    accentColor?: string | null
  }
}

interface ParsedBlock {
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
  items?: ListItem[]
  ordered?: boolean
  rows?: string[][]
}

interface ListItem {
  text: string
  level: number
}

interface InlineSegment {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  strikethrough?: boolean
  link?: string
}

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
}

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  // Match: bold, italic, bold-italic, strikethrough, code, links
  const regex =
    /(\*\*\*(.+?)\*\*\*|___(.+?)___|(\*\*|__)(.+?)(\*\*|__)|(\*|_)(.+?)(\*|_)|~~(.+?)~~|`(.+?)`|\[(.+?)\]\((.+?)\))/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) })
    }

    if (match[2] || match[3]) {
      // bold + italic
      segments.push({ text: match[2] || match[3], bold: true, italic: true })
    } else if (match[5]) {
      // bold
      segments.push({ text: match[5], bold: true })
    } else if (match[8]) {
      // italic
      segments.push({ text: match[8], italic: true })
    } else if (match[10]) {
      // strikethrough
      segments.push({ text: match[10], strikethrough: true })
    } else if (match[11]) {
      // code
      segments.push({ text: match[11], code: true })
    } else if (match[12] && match[13]) {
      // link
      segments.push({ text: match[12], link: match[13] })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) })
  }

  if (segments.length === 0 && text.length > 0) {
    segments.push({ text })
  }

  return segments
}

function segmentsToRuns(segments: InlineSegment[], primaryColor: string): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = []

  for (const seg of segments) {
    if (seg.link) {
      runs.push(
        new ExternalHyperlink({
          children: [
            new TextRun({
              text: seg.text,
              color: primaryColor,
              underline: { type: 'single' },
              font: 'Helvetica',
              size: 22,
            }),
          ],
          link: seg.link,
        }),
      )
    } else if (seg.code) {
      runs.push(
        new TextRun({
          text: seg.text,
          font: 'Courier New',
          size: 20,
          shading: {
            type: ShadingType.CLEAR,
            fill: 'F0F0F0',
          },
        }),
      )
    } else {
      runs.push(
        new TextRun({
          text: seg.text,
          bold: seg.bold,
          italics: seg.italic,
          strike: seg.strikethrough,
          font: 'Helvetica',
          size: 22,
        }),
      )
    }
  }

  return runs
}

function parseMarkdownBlocks(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
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
      blocks.push({ type: 'code', text: codeLines.join('\n'), language: lang })
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
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
        const cells = lines[i]
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean)
        if (!/^[-:\s]+$/.test(lines[i].replace(/\|/g, ''))) {
          rows.push(cells)
        }
        i++
      }
      blocks.push({ type: 'table', rows })
      continue
    }

    // List (with nesting support)
    if (/^(\s*[-*+]|\s*\d+\.)\s/.test(line)) {
      const items: ListItem[] = []
      const ordered = /^\s*\d+\./.test(line)
      while (i < lines.length && /^(\s*[-*+]|\s*\d+\.)\s/.test(lines[i])) {
        const indentMatch = lines[i].match(/^(\s*)/)
        const indent = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0
        const text = lines[i].replace(/^\s*[-*+]\s+/, '').replace(/^\s*\d+\.\s+/, '')
        items.push({ text, level: indent })
        i++
      }
      blocks.push({ type: 'list', items, ordered })
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
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
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim()) &&
      !(lines[i].includes('|') && i + 1 < lines.length && /\|[\s-:]+\|/.test(lines[i + 1] ?? ''))
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') })
    }
  }

  return blocks
}

function buildTitlePage(title: string, primaryColor: string): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 3000 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 56,
          font: 'Helvetica',
          color: primaryColor,
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
          size: 22,
          color: '888888',
          font: 'Helvetica',
        }),
      ],
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new PageBreak()],
    }),
  ]
}

function buildContentParagraphs(
  blocks: ParsedBlock[],
  primaryColor: string,
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = []
  const noBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: 'FFFFFF',
  }

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const level = block.level ?? 1
        const headingLevel = HEADING_MAP[level] ?? HeadingLevel.HEADING_4
        const segments = parseInline(block.text ?? '')
        const runs = segments.map(
          (seg) =>
            new TextRun({
              text: seg.text,
              bold: true,
              font: 'Helvetica',
              size: level === 1 ? 36 : level === 2 ? 28 : level === 3 ? 24 : 22,
              color: level <= 2 ? primaryColor : '333333',
            }),
        )
        elements.push(
          new Paragraph({
            heading: headingLevel,
            children: runs,
            spacing: { before: level <= 2 ? 400 : 240, after: 120 },
          }),
        )
        break
      }

      case 'paragraph': {
        const segments = parseInline(block.text ?? '')
        const runs = segmentsToRuns(segments, primaryColor)
        elements.push(
          new Paragraph({
            children: runs,
            spacing: { after: 160 },
          }),
        )
        break
      }

      case 'code': {
        const codeText = block.text ?? ''
        if (block.language) {
          elements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: block.language,
                  font: 'Helvetica',
                  size: 16,
                  color: '999999',
                }),
              ],
              spacing: { before: 120, after: 40 },
            }),
          )
        }

        const codeLines = codeText.split('\n')
        for (const codeLine of codeLines) {
          elements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: codeLine || ' ',
                  font: 'Courier New',
                  size: 18,
                  color: '444444',
                }),
              ],
              shading: {
                type: ShadingType.CLEAR,
                fill: 'F5F5F5',
              },
              spacing: { after: 0, line: 276 },
              indent: { left: 200 },
            }),
          )
        }
        // Spacing after code block
        elements.push(new Paragraph({ spacing: { after: 160 } }))
        break
      }

      case 'list': {
        const items = block.items ?? []
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx]
          const segments = parseInline(item.text)
          const runs = segmentsToRuns(segments, primaryColor)
          elements.push(
            new Paragraph({
              children: runs,
              bullet: { level: item.level },
              numbering: block.ordered
                ? { reference: 'default-numbering', level: item.level }
                : undefined,
              spacing: { after: 60 },
            }),
          )
        }
        elements.push(new Paragraph({ spacing: { after: 80 } }))
        break
      }

      case 'table': {
        const rows = block.rows ?? []
        if (rows.length === 0) break

        const colCount = Math.max(...rows.map((r) => r.length))

        const tableRows = rows.map(
          (row, ri) =>
            new TableRow({
              children: Array.from({ length: colCount }, (_, ci) => {
                const cellText = ci < row.length ? row[ci] : ''
                const segments = parseInline(cellText)
                const runs = segmentsToRuns(segments, primaryColor)
                return new TableCell({
                  children: [
                    new Paragraph({
                      children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
                    }),
                  ],
                  shading:
                    ri === 0
                      ? { type: ShadingType.CLEAR, fill: 'F5F5F5' }
                      : undefined,
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
                    left: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
                    right: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
                  },
                  width: { size: Math.floor(100 / colCount), type: WidthType.PERCENTAGE },
                })
              }),
            }),
        )

        elements.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        )
        elements.push(new Paragraph({ spacing: { after: 160 } }))
        break
      }

      case 'blockquote': {
        const segments = parseInline(block.text ?? '')
        const runs = segments.map(
          (seg) =>
            new TextRun({
              text: seg.text,
              italics: true,
              font: 'Helvetica',
              size: 22,
              color: '777777',
            }),
        )
        elements.push(
          new Paragraph({
            children: runs,
            indent: { left: 400 },
            border: {
              left: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: primaryColor,
                space: 8,
              },
              top: noBorder,
              bottom: noBorder,
              right: noBorder,
            },
            spacing: { before: 120, after: 120 },
          }),
        )
        break
      }

      case 'hr': {
        elements.push(
          new Paragraph({
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: 'DDDDDD',
              },
              top: noBorder,
              left: noBorder,
              right: noBorder,
            },
            spacing: { before: 200, after: 200 },
          }),
        )
        break
      }
    }
  }

  return elements
}

export async function exportToDocx(
  options: ExportDocxOptions,
): Promise<Buffer> {
  const { title, content, branding } = options
  const primaryColor = branding?.primaryColor?.replace('#', '') ?? '1E40AF'
  const blocks = parseMarkdownBlocks(content)

  const titlePage = buildTitlePage(title, primaryColor)
  const contentParagraphs = buildContentParagraphs(blocks, primaryColor)

  // Check if we need TOC
  const hasHeadings = blocks.some((b) => b.type === 'heading')

  const tocElements: Paragraph[] = []
  if (hasHeadings) {
    tocElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Table of Contents',
            bold: true,
            size: 36,
            font: 'Helvetica',
            color: primaryColor,
          }),
        ],
        spacing: { after: 200 },
      }),
    )

    for (const block of blocks) {
      if (block.type === 'heading' && (block.level ?? 0) <= 3) {
        const indent = ((block.level ?? 1) - 1) * 360
        tocElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.text?.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1') ?? '',
                size: block.level === 1 ? 22 : 20,
                font: 'Helvetica',
                bold: block.level === 1,
                color: '555555',
              }),
            ],
            indent: { left: indent },
            spacing: { after: 60 },
          }),
        )
      }
    }
    tocElements.push(new Paragraph({ children: [new PageBreak()] }))
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Helvetica',
            size: 22,
            color: '333333',
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: 'decimal' as const,
            text: `%${i + 1}.`,
            alignment: AlignmentType.LEFT,
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: [...titlePage, ...tocElements, ...contentParagraphs],
      },
    ],
  })

  return await Packer.toBuffer(doc)
}

export interface MarkdownHeading {
  id: string
  text: string
  level: number
}

export function extractMarkdownHeadings(
  content: string,
  options: { maxLevel?: number } = {},
) {
  const headings: MarkdownHeading[] = []
  const maxLevel = options.maxLevel ?? 4
  const regex = /^(#{1,6})\s+(.+)$/gm
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length
    if (level > maxLevel) continue

    const text = normalizeMarkdownHeadingText(match[2])
    if (!text) continue

    headings.push({
      id: slugifyMarkdownHeading(text),
      text,
      level,
    })
  }

  return headings
}

function normalizeMarkdownHeadingText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+#+\s*$/g, '')
    .trim()
}

function slugifyMarkdownHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}

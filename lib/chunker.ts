import { createHash } from 'crypto'
import { encodingForModel } from 'js-tiktoken'
import { TARGET_CHUNK_TOKENS, OVERLAP_TOKENS } from '@/lib/ai-config'

const ATOMIC_BLOCK_OVERSHOOT = 1.5
const MIN_BOUNDARY_RATIO = 0.5
const LOOKAHEAD_CHARS = 100

export interface DocumentChunk {
  chunkIndex: number
  chunkText: string
  embeddingText: string
  tokenCount: number
  sectionPath: string | null
  heading: string | null
}

const CHARS_PER_TOKEN_EN = 4
const CHARS_PER_TOKEN_CJK = 2

function containsCjk(text: string) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)
}

function estimateTokensFast(text: string) {
  const charsPerToken = containsCjk(text) ? CHARS_PER_TOKEN_CJK : CHARS_PER_TOKEN_EN
  return Math.ceil(text.length / charsPerToken)
}

let _enc: ReturnType<typeof encodingForModel> | null = null
function getEncoder() {
  if (!_enc) _enc = encodingForModel('gpt-4o')
  return _enc
}

function countTokensExact(text: string) {
  return getEncoder().encode(text).length
}

export function estimateTokens(text: string) {
  // Short text: fast char-based estimate is accurate enough
  if (text.length < 100) return estimateTokensFast(text)
  return countTokensExact(text)
}

function stripForEmbedding(text: string) {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, body) => {
      const preview = body.trim().split('\n').slice(0, 3).join(' ')
      return ` [code${lang ? ': ' + lang : ''}] ${preview} `
    })
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract heading level (1-6) from a markdown heading line.
 */
function getHeadingLevel(line: string): number {
  const match = line.match(/^\s{0,3}(#{1,6})\s+/)
  return match ? match[1].length : 0
}

/**
 * Extract heading text (without the # prefix) from a heading line.
 */
function getHeadingText(line: string): string {
  return line.replace(/^\s{0,3}#{1,6}\s+/, '').trim()
}

/**
 * Split markdown content into sections by headings.
 * Returns array of { heading, body, headingLevel, sectionPath } where heading is the full heading line.
 */
function splitByHeadings(content: string): Array<{
  heading: string
  body: string
  headingLevel: number
  sectionPath: string
}> {
  const lines = content.split('\n')
  const sections: Array<{
    heading: string
    body: string
    headingLevel: number
    sectionPath: string
  }> = []
  let currentHeading = ''
  let currentHeadingLevel = 0
  let currentBody: string[] = []

  // Stack of [level, text] for building section paths
  const headingStack: Array<{ level: number; text: string }> = []

  const buildSectionPath = (): string =>
    headingStack.map((h) => h.text).join(' > ')

  const pushSection = () => {
    if (currentBody.length > 0 || currentHeading) {
      sections.push({
        heading: currentHeading,
        body: currentBody.join('\n').trim(),
        headingLevel: currentHeadingLevel,
        sectionPath: buildSectionPath(),
      })
    }
  }

  for (const line of lines) {
    if (/^\s{0,3}#{1,6}\s+/.test(line)) {
      pushSection()

      const level = getHeadingLevel(line)
      const text = getHeadingText(line)

      // Pop stack entries that are at the same level or deeper
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop()
      }
      headingStack.push({ level, text })

      currentHeading = line.trim()
      currentHeadingLevel = level
      currentBody = []
    } else {
      currentBody.push(line)
    }
  }

  pushSection()

  return sections
}

/**
 * Identify atomic blocks (tables, ordered lists) that should not be split mid-way.
 * Returns character ranges [start, end) within the text.
 */
function findAtomicBoundaries(text: string): Array<{ start: number; end: number }> {
  const boundaries: Array<{ start: number; end: number }> = []
  const lines = text.split('\n')
  let offset = 0
  let blockStart = -1
  let blockType: 'table' | 'list' | null = null

  const flush = () => {
    if (blockStart >= 0 && blockType) {
      boundaries.push({ start: blockStart, end: offset })
    }
    blockStart = -1
    blockType = null
  }

  for (const line of lines) {
    const isTableLine = /^\s*\|/.test(line)
    const isOrderedListLine = /^\s*\d+\.\s/.test(line)

    if (isTableLine) {
      if (blockType !== 'table') {
        flush()
        blockStart = offset
        blockType = 'table'
      }
    } else if (isOrderedListLine) {
      if (blockType !== 'list') {
        flush()
        blockStart = offset
        blockType = 'list'
      }
    } else if (blockType && line.trim() === '') {
      // Allow a single blank line inside a block — but two ends it
    } else if (blockType && line.trim() !== '') {
      flush()
    }

    offset += line.length + 1 // +1 for the '\n'
  }

  flush()
  return boundaries
}

/**
 * Split a text block into token-sized chunks with overlap.
 * Respects atomic blocks (tables, ordered lists) — avoids breaking them mid-row.
 */
function splitTextIntoChunks(
  text: string,
  targetTokens: number,
  overlapTokens: number,
): string[] {
  const charsPerToken = containsCjk(text) ? CHARS_PER_TOKEN_CJK : CHARS_PER_TOKEN_EN
  const targetChars = targetTokens * charsPerToken
  const overlapChars = overlapTokens * charsPerToken
  const maxAtomicChars = Math.floor(targetChars * ATOMIC_BLOCK_OVERSHOOT)

  if (text.length <= targetChars) {
    return text.trim() ? [text.trim()] : []
  }

  const atomicBlocks = findAtomicBoundaries(text)

  /**
   * If `end` falls inside an atomic block, extend to the block's end
   * (if within 1.5x target) or retreat to the block's start.
   */
  const adjustForAtomicBoundary = (start: number, end: number): number => {
    for (const block of atomicBlocks) {
      if (end > block.start && end < block.end) {
        // end is inside this atomic block
        if (block.end - start <= maxAtomicChars) {
          return block.end // extend to include entire block
        }
        // Block too large — fall back to block start if that's past our start
        if (block.start > start) {
          return block.start
        }
        // Super-large block starting at our start — break at line boundary
        const lineBreak = text.lastIndexOf('\n', end)
        if (lineBreak > start) return lineBreak + 1
      }
    }
    return end
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + targetChars

    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end + LOOKAHEAD_CHARS)
      const paragraphBreak = slice.lastIndexOf('\n\n')
      if (paragraphBreak > targetChars * MIN_BOUNDARY_RATIO) {
        end = start + paragraphBreak + 2
      } else {
        const sentenceBreak = slice.search(/[.!?。！？]\s/)
        if (sentenceBreak > targetChars * MIN_BOUNDARY_RATIO) {
          end = start + sentenceBreak + 2
        }
      }

      // Adjust for atomic blocks (tables/ordered lists)
      end = adjustForAtomicBoundary(start, end)
    } else {
      end = text.length
    }

    if (end <= start) {
      end = Math.min(text.length, start + targetChars)
      if (end <= start) {
        break
      }
    }

    const chunk = text.slice(start, end).trim()
    if (chunk) chunks.push(chunk)

    const nextStart = Math.max(start + 1, end - overlapChars)
    start = nextStart
    if (start >= text.length) break
    if (end >= text.length) break
  }

  return chunks
}

/**
 * Chunk a document into embedding-ready pieces.
 * Respects markdown heading boundaries and targets ~500 tokens per chunk.
 */
export function chunkDocument(title: string, content: string): DocumentChunk[] {
  const sections = splitByHeadings(content)
  const chunks: DocumentChunk[] = []
  let chunkIndex = 0

  for (const section of sections) {
    const sectionText = [section.heading, section.body].filter(Boolean).join('\n')
    if (!sectionText.trim()) continue

    const sectionTokens = estimateTokens(sectionText)
    const headingText = section.heading ? getHeadingText(section.heading) : null
    const sectionPath = section.sectionPath || null

    // Build contextual embedding prefix including section hierarchy
    const contextParts: string[] = []
    if (title) contextParts.push(`Document: ${title}`)
    if (sectionPath) contextParts.push(`Section: ${sectionPath}`)
    const contextPrefix = contextParts.length > 0 ? contextParts.join('\n') + '\n' : ''

    if (sectionTokens <= TARGET_CHUNK_TOKENS) {
      const chunkText = sectionText.trim()
      chunks.push({
        chunkIndex,
        chunkText,
        embeddingText: stripForEmbedding(`${contextPrefix}${chunkText}`),
        tokenCount: countTokensExact(chunkText),
        sectionPath,
        heading: headingText,
      })
      chunkIndex += 1
    } else {
      const textChunks = splitTextIntoChunks(
        sectionText,
        TARGET_CHUNK_TOKENS,
        OVERLAP_TOKENS,
      )

      for (const textChunk of textChunks) {
        chunks.push({
          chunkIndex,
          chunkText: textChunk,
          embeddingText: stripForEmbedding(`${contextPrefix}${textChunk}`),
          tokenCount: countTokensExact(textChunk),
          sectionPath,
          heading: headingText,
        })
        chunkIndex += 1
      }
    }
  }

  return chunks
}

/**
 * Compute a content hash for change detection.
 */
export function computeContentHash(title: string, content: string) {
  return createHash('sha256')
    .update(`${title}\n---\n${content}`, 'utf8')
    .digest('hex')
    .slice(0, 16)
}

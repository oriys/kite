import { createHash } from 'crypto'
import { TARGET_CHUNK_TOKENS, OVERLAP_TOKENS } from '@/lib/ai-config'

export interface DocumentChunk {
  chunkIndex: number
  chunkText: string
  embeddingText: string
  tokenCount: number
}

const CHARS_PER_TOKEN_EN = 4
const CHARS_PER_TOKEN_CJK = 2

function containsCjk(text: string) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)
}

function estimateTokens(text: string) {
  const charsPerToken = containsCjk(text) ? CHARS_PER_TOKEN_CJK : CHARS_PER_TOKEN_EN
  return Math.ceil(text.length / charsPerToken)
}

function stripForEmbedding(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' [code block] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split markdown content into sections by headings.
 * Returns array of { heading, body } where heading is the full heading line.
 */
function splitByHeadings(content: string): Array<{ heading: string; body: string }> {
  const lines = content.split('\n')
  const sections: Array<{ heading: string; body: string }> = []
  let currentHeading = ''
  let currentBody: string[] = []

  for (const line of lines) {
    if (/^\s{0,3}#{1,6}\s+/.test(line)) {
      if (currentBody.length > 0 || currentHeading) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join('\n').trim(),
        })
      }
      currentHeading = line.trim()
      currentBody = []
    } else {
      currentBody.push(line)
    }
  }

  if (currentBody.length > 0 || currentHeading) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join('\n').trim(),
    })
  }

  return sections
}

/**
 * Split a text block into token-sized chunks with overlap.
 */
function splitTextIntoChunks(
  text: string,
  targetTokens: number,
  overlapTokens: number,
): string[] {
  const charsPerToken = containsCjk(text) ? CHARS_PER_TOKEN_CJK : CHARS_PER_TOKEN_EN
  const targetChars = targetTokens * charsPerToken
  const overlapChars = overlapTokens * charsPerToken

  if (text.length <= targetChars) {
    return text.trim() ? [text.trim()] : []
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + targetChars

    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end + 100)
      const paragraphBreak = slice.lastIndexOf('\n\n')
      if (paragraphBreak > targetChars * 0.5) {
        end = start + paragraphBreak + 2
      } else {
        const sentenceBreak = slice.search(/[.!?。！？]\s/)
        if (sentenceBreak > targetChars * 0.5) {
          end = start + sentenceBreak + 2
        }
      }
    } else {
      end = text.length
    }

    const chunk = text.slice(start, end).trim()
    if (chunk) chunks.push(chunk)

    start = end - overlapChars
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

    if (sectionTokens <= TARGET_CHUNK_TOKENS) {
      const chunkText = sectionText.trim()
      const contextPrefix = title ? `Document: ${title}\n` : ''
      chunks.push({
        chunkIndex,
        chunkText,
        embeddingText: stripForEmbedding(`${contextPrefix}${chunkText}`),
        tokenCount: estimateTokens(chunkText),
      })
      chunkIndex += 1
    } else {
      const textChunks = splitTextIntoChunks(
        sectionText,
        TARGET_CHUNK_TOKENS,
        OVERLAP_TOKENS,
      )

      for (const textChunk of textChunks) {
        const contextPrefix = title ? `Document: ${title}\n` : ''
        chunks.push({
          chunkIndex,
          chunkText: textChunk,
          embeddingText: stripForEmbedding(`${contextPrefix}${textChunk}`),
          tokenCount: estimateTokens(textChunk),
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

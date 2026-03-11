import { requestAiTextCompletion } from '@/lib/ai-server'

const MAX_SUMMARY_SOURCE_LENGTH = 6000
const MAX_SUMMARY_RESULT_LENGTH = 120
const MAX_SUMMARY_RESULT_CJK_LENGTH = 48

function stripMarkdown(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/[*_~>|-]/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function containsCjk(value: string) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(value)
}

function normalizeSummary(summary: string, sourceText: string) {
  const normalized = summary
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return ''

  const maxLength = containsCjk(sourceText)
    ? MAX_SUMMARY_RESULT_CJK_LENGTH
    : MAX_SUMMARY_RESULT_LENGTH

  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function createFallbackSummary(title: string, content: string) {
  const plain = stripMarkdown(content)
  if (!plain) return ''

  const maxLength = containsCjk(plain) ? MAX_SUMMARY_RESULT_CJK_LENGTH : MAX_SUMMARY_RESULT_LENGTH
  const firstSentence = plain.split(/(?<=[.!?。！？])\s+/)[0]?.trim() || plain
  const fallback = firstSentence === title ? plain : firstSentence

  if (fallback.length <= maxLength) return fallback
  return `${fallback.slice(0, maxLength - 1).trimEnd()}…`
}

export async function generateDocumentSummary(input: {
  title: string
  content: string
}) {
  const title = input.title.trim()
  const plainContent = stripMarkdown(input.content)

  if (!plainContent) return ''

  const sourceText = plainContent.slice(0, MAX_SUMMARY_SOURCE_LENGTH)

  try {
    const completion = await requestAiTextCompletion({
      systemPrompt:
        'You write ultra-concise document card summaries. Return one short sentence only. Be accurate, literal, and grounded in the provided content. Use the same language as the source. Avoid filler, markdown, bullets, quotes, and meta phrases.',
      userPrompt: [
        'Write a simple and accurate summary for a document list card.',
        'Keep it brief and concrete.',
        containsCjk(sourceText)
          ? 'Preferred length: 12 to 40 Chinese characters.'
          : 'Preferred length: under 100 characters.',
        '',
        '<title>',
        title || 'Untitled',
        '</title>',
        '',
        '<content>',
        sourceText,
        '</content>',
      ].join('\n'),
      temperature: 0.1,
    })

    return normalizeSummary(completion.result, sourceText)
  } catch {
    return createFallbackSummary(title, sourceText)
  }
}

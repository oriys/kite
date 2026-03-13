import {
  requestAiTextCompletion,
  resolveAiModelSelection,
  resolveWorkspaceAiProviders,
} from '@/lib/ai-server'
import {
  isDocumentTitleMissing,
  UNTITLED_DOCUMENT_TITLE,
} from '@/lib/documents'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'
import { logServerError } from '@/lib/server-errors'

const MAX_SUMMARY_SOURCE_LENGTH = 6000
const MAX_SUMMARY_RESULT_LENGTH = 120
const MAX_SUMMARY_RESULT_CJK_LENGTH = 48
const MAX_TITLE_RESULT_LENGTH = 72
const MAX_TITLE_RESULT_CJK_LENGTH = 24

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

function normalizeTitle(title: string, sourceText: string) {
  const normalized = stripMarkdown(title)
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .replace(/[:：]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return ''

  const maxLength = containsCjk(sourceText)
    ? MAX_TITLE_RESULT_CJK_LENGTH
    : MAX_TITLE_RESULT_LENGTH

  if (normalized.length <= maxLength) return normalized
  return normalized.slice(0, maxLength).trimEnd()
}

function extractFirstHeading(content: string) {
  const headingMatch = content.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/m)
  return headingMatch?.[1]?.trim() ?? ''
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

function createFallbackTitle(content: string) {
  const heading = extractFirstHeading(content)
  if (heading) {
    return normalizeTitle(heading, heading)
  }

  const plain = stripMarkdown(content)
  if (!plain) return ''

  const firstSentence = plain.split(/(?<=[.!?。！？])\s+/)[0]?.trim() || plain
  const compactTitle = containsCjk(plain)
    ? firstSentence
    : firstSentence
        .split(/\s+/)
        .slice(0, 10)
        .join(' ')

  return normalizeTitle(compactTitle, plain)
}

function extractStructuredMetadata(raw: string) {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch?.[1]?.trim() ?? raw.trim()
  const objectMatch = candidate.match(/\{[\s\S]*\}/)

  if (!objectMatch) {
    return null
  }

  try {
    const parsed = JSON.parse(objectMatch[0]) as {
      summary?: unknown
      title?: unknown
    }

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      title: typeof parsed.title === 'string' ? parsed.title : '',
    }
  } catch {
    return null
  }
}

export async function generateDocumentMetadata(input: {
  workspaceId: string
  title: string
  content: string
}) {
  const title = input.title.trim()
  const plainContent = stripMarkdown(input.content)
  const shouldGenerateTitle = isDocumentTitleMissing(title)

  if (!plainContent) {
    return {
      summary: '',
      title: '',
    }
  }

  const sourceText = plainContent.slice(0, MAX_SUMMARY_SOURCE_LENGTH)

  try {
    const [providers, workspaceSettings] = await Promise.all([
      resolveWorkspaceAiProviders(input.workspaceId),
      getAiWorkspaceSettings(input.workspaceId),
    ])

    const selection = resolveAiModelSelection({
      defaultModelId: workspaceSettings?.defaultModelId ?? null,
      enabledModelIds: Array.isArray(workspaceSettings?.enabledModelIds)
        ? workspaceSettings.enabledModelIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
      providers,
    })

    if (!selection) {
      throw new Error('No AI model configured for document metadata generation.')
    }

    const completion = await requestAiTextCompletion({
      provider: selection.provider,
      model: selection.modelId,
      systemPrompt: [
        'You generate document metadata for an editor.',
        'Return strict JSON only with exactly two string fields: "summary" and "title".',
        'The summary must be one short sentence for a document list card.',
        'The title must be short, specific, and useful as a document title.',
        'Use the same language as the source.',
        'Avoid markdown, bullets, quotes, labels, and commentary.',
        'If the existing title should be kept, return an empty string for "title".',
      ].join(' '),
      userPrompt: [
        'Generate document metadata from the content below.',
        containsCjk(sourceText)
          ? 'Summary length: 12 to 40 Chinese characters. Title length: under 24 Chinese characters.'
          : 'Summary length: under 100 characters. Title length: under 72 characters.',
        shouldGenerateTitle
          ? 'The current title is missing. Produce both a title and a summary.'
          : 'The current title is already set. Produce only the summary and leave title as an empty string.',
        '',
        '<existingTitle>',
        title || UNTITLED_DOCUMENT_TITLE,
        '</existingTitle>',
        '',
        '<content>',
        sourceText,
        '</content>',
      ].join('\n'),
      temperature: 0.1,
    })

    const structured = extractStructuredMetadata(completion.result)

    return {
      summary: normalizeSummary(
        structured?.summary ?? createFallbackSummary(title, sourceText),
        sourceText,
      ),
      title: shouldGenerateTitle
        ? normalizeTitle(
            structured?.title ?? createFallbackTitle(input.content),
            sourceText,
          )
        : '',
    }
  } catch (error) {
    logServerError('Failed to generate document metadata with AI.', error, {
      workspaceId: input.workspaceId,
      titleLength: title.length,
      contentLength: sourceText.length,
      shouldGenerateTitle,
    })

    return {
      summary: createFallbackSummary(title, sourceText),
      title: shouldGenerateTitle ? createFallbackTitle(input.content) : '',
    }
  }
}

export async function generateDocumentSummary(input: {
  workspaceId: string
  title: string
  content: string
}) {
  const metadata = await generateDocumentMetadata(input)
  return metadata.summary
}

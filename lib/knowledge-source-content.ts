import {
  extractOpenApiContent,
  extractGraphQlContent,
  extractZipContent,
  extractAsyncApiContent,
  extractProtobufContent,
  extractRstContent,
  extractAsciidocContent,
  extractCsvContent,
  extractSqlDdlContent,
  extractTypeScriptDefsContent,
  extractPostmanContent,
} from '@/lib/knowledge-extractors'

export const EXTRACTABLE_KNOWLEDGE_SOURCE_TYPES = [
  'document',
  'pdf',
  'url',
  'markdown',
  'faq',
  'openapi',
  'graphql',
  'zip',
  'asyncapi',
  'protobuf',
  'rst',
  'asciidoc',
  'csv',
  'sql_ddl',
  'typescript_defs',
  'postman',
] as const

export type ExtractableKnowledgeSourceType =
  (typeof EXTRACTABLE_KNOWLEDGE_SOURCE_TYPES)[number]

export async function extractKnowledgeSourceContent(
  sourceType: ExtractableKnowledgeSourceType,
  rawContent: string,
): Promise<{ title: string; content: string }> {
  switch (sourceType) {
    case 'openapi':
      return extractOpenApiContent(rawContent)
    case 'graphql':
      return extractGraphQlContent(rawContent)
    case 'zip':
      return extractZipContent(rawContent)
    case 'asyncapi':
      return extractAsyncApiContent(rawContent)
    case 'protobuf':
      return extractProtobufContent(rawContent)
    case 'rst':
      return extractRstContent(rawContent)
    case 'asciidoc':
      return extractAsciidocContent(rawContent)
    case 'csv':
      return extractCsvContent(rawContent)
    case 'sql_ddl':
      return extractSqlDdlContent(rawContent)
    case 'typescript_defs':
      return extractTypeScriptDefsContent(rawContent)
    case 'postman':
      return extractPostmanContent(rawContent)
    case 'faq': {
      try {
        const pairs = JSON.parse(rawContent) as Array<{
          question: string
          answer: string
        }>
        const content = pairs
          .map((pair) => `## ${pair.question}\n\n${pair.answer}`)
          .join('\n\n')
        return { title: 'FAQ', content }
      } catch {
        return { title: 'FAQ', content: rawContent }
      }
    }
    case 'url':
    case 'pdf':
    case 'markdown':
    case 'document':
    default:
      return { title: '', content: rawContent }
  }
}

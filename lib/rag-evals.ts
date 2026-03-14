import { debugRetrieveChatContext } from '@/lib/ai-chat'

interface RagEvalCase {
  id: string
  query: string
  expectedSourceTitleIncludes: string[]
  expectedContextIncludes?: string[]
}

export const SHOPLINE_RAG_EVAL_CASES: RagEvalCase[] = [
  {
    id: 'metaobject-access-scope',
    query: 'metaobject的权限点是什么',
    expectedSourceTitleIncludes: ['创建元对象定义', 'AccessScope'],
    expectedContextIncludes: ['write_metaobject_definition'],
  },
  {
    id: 'access-scope-inventory',
    query: 'AccessScope 文档里 write_inventory 是什么权限点？',
    expectedSourceTitleIncludes: ['AccessScope'],
    expectedContextIncludes: ['write_inventory'],
  },
  {
    id: 'http-status-codes',
    query: 'HTTP 状态码文档在哪里',
    expectedSourceTitleIncludes: ['HTTP 状态码'],
  },
  {
    id: 'bulk-metafields',
    query: '批量操作元字段接口文档在哪',
    expectedSourceTitleIncludes: ['批量操作元字段'],
  },
]

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF\\\s_\-:/]+/g, '')
    .trim()
}

function includesNormalized(haystack: string, needle: string) {
  const normalizedNeedle = normalizeForMatch(needle)
  if (!normalizedNeedle) return false
  return normalizeForMatch(haystack).includes(normalizedNeedle)
}

export async function runWorkspaceRagEvals(input: {
  workspaceId: string
  documentId?: string
}) {
  const results = await Promise.all(
    SHOPLINE_RAG_EVAL_CASES.map(async (testCase) => {
      const { contextText, sources } = await debugRetrieveChatContext({
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        query: testCase.query,
      })

      const sourceTitles = sources.map((source) => source.title)
      const missingSourceTitles = testCase.expectedSourceTitleIncludes.filter(
        (expectedTitle) =>
          !sourceTitles.some((actualTitle) =>
            includesNormalized(actualTitle, expectedTitle),
          ),
      )
      const missingContextTerms = (testCase.expectedContextIncludes ?? []).filter(
        (expectedTerm) => !includesNormalized(contextText, expectedTerm),
      )

      return {
        id: testCase.id,
        query: testCase.query,
        passed:
          missingSourceTitles.length === 0 && missingContextTerms.length === 0,
        expectedSourceTitleIncludes: testCase.expectedSourceTitleIncludes,
        expectedContextIncludes: testCase.expectedContextIncludes ?? [],
        missingSourceTitles,
        missingContextTerms,
        sourceTitles,
        contextPreview: contextText.slice(0, 1200),
      }
    }),
  )

  const passed = results.filter((result) => result.passed).length

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    cases: results,
  }
}

import {
  debugRetrieveChatContext,
  type RetrievalDiagnostics,
} from '@/lib/ai-chat'

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

/**
 * Compute Recall@K: fraction of expected source titles found in the top-K retrieved sources.
 */
function computeRecallAtK(
  sourceTitles: string[],
  expectedTitles: string[],
  k: number,
): number {
  if (expectedTitles.length === 0) return 1
  const topK = sourceTitles.slice(0, k)
  const found = expectedTitles.filter((expected) =>
    topK.some((actual) => includesNormalized(actual, expected)),
  )
  return found.length / expectedTitles.length
}

/**
 * Compute MRR (Mean Reciprocal Rank): 1/(rank of first relevant result).
 */
function computeMrr(
  sourceTitles: string[],
  expectedTitles: string[],
): number {
  for (let i = 0; i < sourceTitles.length; i++) {
    if (
      expectedTitles.some((expected) =>
        includesNormalized(sourceTitles[i], expected),
      )
    ) {
      return 1 / (i + 1)
    }
  }
  return 0
}

/**
 * Compute context coverage: fraction of expected terms found in the context.
 */
function computeContextCoverage(
  contextText: string,
  expectedTerms: string[],
): number {
  if (expectedTerms.length === 0) return 1
  const found = expectedTerms.filter((term) =>
    includesNormalized(contextText, term),
  )
  return found.length / expectedTerms.length
}

export async function runWorkspaceRagEvals(input: {
  workspaceId: string
  documentId?: string
}) {
  const results = await Promise.all(
    SHOPLINE_RAG_EVAL_CASES.map(async (testCase) => {
      const { contextText, sources, diagnostics } =
        await debugRetrieveChatContext({
          workspaceId: input.workspaceId,
          documentId: input.documentId,
          query: testCase.query,
          debug: true,
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
        metrics: {
          recallAt3: computeRecallAtK(
            sourceTitles,
            testCase.expectedSourceTitleIncludes,
            3,
          ),
          recallAt5: computeRecallAtK(
            sourceTitles,
            testCase.expectedSourceTitleIncludes,
            5,
          ),
          mrr: computeMrr(sourceTitles, testCase.expectedSourceTitleIncludes),
          contextCoverage: computeContextCoverage(
            contextText,
            testCase.expectedContextIncludes ?? [],
          ),
        },
        diagnostics: diagnostics as RetrievalDiagnostics | undefined,
      }
    }),
  )

  const passed = results.filter((result) => result.passed).length
  const avgRecallAt3 =
    results.reduce((sum, r) => sum + r.metrics.recallAt3, 0) / results.length
  const avgRecallAt5 =
    results.reduce((sum, r) => sum + r.metrics.recallAt5, 0) / results.length
  const avgMrr =
    results.reduce((sum, r) => sum + r.metrics.mrr, 0) / results.length
  const avgContextCoverage =
    results.reduce((sum, r) => sum + r.metrics.contextCoverage, 0) /
    results.length

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    aggregateMetrics: {
      avgRecallAt3: Math.round(avgRecallAt3 * 1000) / 1000,
      avgRecallAt5: Math.round(avgRecallAt5 * 1000) / 1000,
      avgMrr: Math.round(avgMrr * 1000) / 1000,
      avgContextCoverage: Math.round(avgContextCoverage * 1000) / 1000,
    },
    cases: results,
  }
}

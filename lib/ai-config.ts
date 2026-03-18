/**
 * Centralized AI / RAG configuration.
 *
 * Every value has a sensible default but can be overridden via
 * environment variable for production tuning (prefix: AI_).
 */

function envInt(key: string, fallback: number): number {
  const v = process.env[key]
  if (v == null) return fallback
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? fallback : n
}

function envFloat(key: string, fallback: number): number {
  const v = process.env[key]
  if (v == null) return fallback
  const n = parseFloat(v)
  return Number.isNaN(n) ? fallback : n
}

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

// ---------------------------------------------------------------------------
// Embedding & models
// ---------------------------------------------------------------------------
export const DEFAULT_EMBEDDING_MODEL = envStr(
  'AI_DEFAULT_EMBEDDING_MODEL',
  'text-embedding-3-small',
)
export const EMBEDDING_VECTOR_DIMENSION = 1536

export const DEFAULT_RERANKER_MODEL = envStr(
  'AI_DEFAULT_RERANKER_MODEL',
  'BAAI/bge-reranker-v2-m3',
)

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------
export const TARGET_CHUNK_TOKENS = envInt('AI_TARGET_CHUNK_TOKENS', 500)
export const OVERLAP_TOKENS = envInt('AI_OVERLAP_TOKENS', 50)
export const EMBEDDING_BATCH_SIZE = envInt('AI_EMBEDDING_BATCH_SIZE', 20)

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------
export const TOP_K_CHUNKS = envInt('AI_TOP_K_CHUNKS', 15)
export const TOP_K_KEYWORD_DOCUMENTS = envInt('AI_TOP_K_KEYWORD_DOCUMENTS', 4)
export const SEMANTIC_TOP_K = envInt('AI_SEMANTIC_TOP_K', 20)
export const MAX_QUERY_VARIANTS = envInt('AI_MAX_QUERY_VARIANTS', 4)
export const MAX_SEMANTIC_CHUNKS = envInt('AI_MAX_SEMANTIC_CHUNKS', 10)
export const MAX_SEMANTIC_CHUNKS_PER_DOCUMENT = envInt(
  'AI_MAX_SEMANTIC_CHUNKS_PER_DOCUMENT',
  3,
)
export const ADJACENT_CHUNK_RADIUS = envInt('AI_ADJACENT_CHUNK_RADIUS', 1)

// ---------------------------------------------------------------------------
// Context assembly
// ---------------------------------------------------------------------------
export const MAX_CONTEXT_CHARS = envInt('AI_MAX_CONTEXT_CHARS', 20_000)
export const MAX_CONTEXT_SECTIONS = envInt('AI_MAX_CONTEXT_SECTIONS', 12)
export const MAX_SECTION_CHARS = envInt('AI_MAX_SECTION_CHARS', 2_500)
export const MAX_COMPRESSED_BLOCKS = envInt('AI_MAX_COMPRESSED_BLOCKS', 4)
export const MAX_KEYWORD_SNIPPET_CHARS = envInt(
  'AI_MAX_KEYWORD_SNIPPET_CHARS',
  1_600,
)

// ---------------------------------------------------------------------------
// Token budget (replaces character-based limits)
// ---------------------------------------------------------------------------
export const MAX_CONTEXT_TOKENS = envInt('AI_MAX_CONTEXT_TOKENS', 8_000)
export const MAX_SECTION_TOKENS = envInt('AI_MAX_SECTION_TOKENS', 1_500)
export const MAX_ENTITY_TOKENS = envInt('AI_MAX_ENTITY_TOKENS', 2_000)
export const MAX_RELATION_TOKENS = envInt('AI_MAX_RELATION_TOKENS', 2_000)
export const MAX_CHUNK_TOKENS = envInt('AI_MAX_CHUNK_TOKENS', 4_000)

// ---------------------------------------------------------------------------
// Vector similarity
// ---------------------------------------------------------------------------
export const MIN_VECTOR_SIMILARITY = envFloat('AI_MIN_VECTOR_SIMILARITY', 0.28)
export const VECTOR_SIMILARITY_WINDOW = envFloat(
  'AI_VECTOR_SIMILARITY_WINDOW',
  0.12,
)

export const SIMILARITY_PROFILES: Record<string, { min: number; window: number }> = (() => {
  const defaults: Record<string, { min: number; window: number }> = {
    'text-embedding-3-small': { min: 0.28, window: 0.12 },
    'text-embedding-3-large': { min: 0.32, window: 0.10 },
    'text-embedding-ada-002': { min: 0.22, window: 0.15 },
  }
  const envJson = process.env.AI_SIMILARITY_PROFILES_JSON
  if (envJson) {
    try {
      return { ...defaults, ...JSON.parse(envJson) }
    } catch {
      // ignore invalid JSON, use defaults
    }
  }
  return defaults
})()

// ---------------------------------------------------------------------------
// Document limits
// ---------------------------------------------------------------------------
export const MAX_PRIMARY_DOCUMENTS = envInt('AI_MAX_PRIMARY_DOCUMENTS', 4)
export const MAX_REFERENCE_LINKS_PER_DOCUMENT = envInt(
  'AI_MAX_REFERENCE_LINKS_PER_DOCUMENT',
  4,
)
export const MAX_REFERENCE_SEARCH_RESULTS = envInt(
  'AI_MAX_REFERENCE_SEARCH_RESULTS',
  5,
)
export const MAX_RELATED_DOCUMENTS = envInt('AI_MAX_RELATED_DOCUMENTS', 4)
export const MAX_RERANK_DOCUMENT_CHARS = envInt(
  'AI_MAX_RERANK_DOCUMENT_CHARS',
  3_000,
)

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export const MAX_HISTORY_MESSAGES = envInt('AI_MAX_HISTORY_MESSAGES', 10)

// ---------------------------------------------------------------------------
// Summarisation
// ---------------------------------------------------------------------------
export const MAX_SUMMARY_SOURCE_LENGTH = envInt(
  'AI_MAX_SUMMARY_SOURCE_LENGTH',
  6_000,
)
export const MAX_SUMMARY_RESULT_LENGTH = envInt(
  'AI_MAX_SUMMARY_RESULT_LENGTH',
  120,
)
export const MAX_SUMMARY_RESULT_CJK_LENGTH = envInt(
  'AI_MAX_SUMMARY_RESULT_CJK_LENGTH',
  48,
)
export const MAX_TITLE_RESULT_LENGTH = envInt('AI_MAX_TITLE_RESULT_LENGTH', 72)
export const MAX_TITLE_RESULT_CJK_LENGTH = envInt(
  'AI_MAX_TITLE_RESULT_CJK_LENGTH',
  24,
)

// ---------------------------------------------------------------------------
// Temperature defaults (per use-case)
// ---------------------------------------------------------------------------
export const TEMPERATURE_CHAT = envFloat('AI_TEMPERATURE_CHAT', 0.3)
export const TEMPERATURE_COMPLETION = envFloat('AI_TEMPERATURE_COMPLETION', 0.2)
export const TEMPERATURE_SUMMARY = envFloat('AI_TEMPERATURE_SUMMARY', 0.1)
export const TEMPERATURE_DOC_GEN = envFloat('AI_TEMPERATURE_DOC_GEN', 0.2)
export const TEMPERATURE_QUERY_REWRITE = envFloat(
  'AI_TEMPERATURE_QUERY_REWRITE',
  0.0,
)

// ---------------------------------------------------------------------------
// Multi-turn RAG
// ---------------------------------------------------------------------------
export const MAX_HISTORY_TURNS_FOR_REWRITE = envInt(
  'AI_MAX_HISTORY_TURNS_FOR_REWRITE',
  4,
)
export const BOOST_RECENT_SOURCE_SCORE = envInt(
  'AI_BOOST_RECENT_SOURCE_SCORE',
  15,
)
export const ENABLE_ITERATIVE_RETRIEVAL = envInt(
  'AI_ENABLE_ITERATIVE_RETRIEVAL',
  0,
)
export const MIN_CONTEXT_SECTIONS_FOR_SKIP = envInt(
  'AI_MIN_CONTEXT_SECTIONS_FOR_SKIP',
  2,
)
export const MAX_ITERATIVE_FOLLOWUP_QUERIES = envInt(
  'AI_MAX_ITERATIVE_FOLLOWUP_QUERIES',
  2,
)

// ---------------------------------------------------------------------------
// Query expansion
// ---------------------------------------------------------------------------
export interface QueryExpansionRule {
  pattern: string
  expansions: string[]
  scoreBoost?: number
}

export const AI_DEFAULT_QUERY_EXPANSION_RULES: QueryExpansionRule[] = [
  { pattern: '(权限点|权限|access\\s*scope|accessscope|scope|permission)', expansions: ['权限点', 'AccessScope', 'access scope', '授权'], scoreBoost: 18 },
  { pattern: '(metaobject|元对象)', expansions: ['metaobject', '元对象'], scoreBoost: 14 },
  { pattern: '(metafield|元字段)', expansions: ['metafield', '元字段'] },
  { pattern: '(webhook|事件通知|回调)', expansions: ['webhook', '事件', '回调', 'callback', 'notification'] },
  { pattern: '(token|访问令牌|授权令牌)', expansions: ['token', '访问令牌', 'access token'] },
  { pattern: '(admin\\s*rest|admin-rest-api|restful|rest\\s+api|rest接口)', expansions: ['admin rest api', 'admin-rest-api'] },
  { pattern: '(graphql|graph\\s*ql)', expansions: ['graphql'] },
  { pattern: '\\b(auth|authentication|authorize)\\b', expansions: ['authentication', 'authorization', 'API key', 'OAuth', 'token'] },
  { pattern: '\\b(rate\\s*limit|throttl)', expansions: ['rate limit', 'throttling', 'quota', '429'] },
  { pattern: '\\b(pagina)', expansions: ['pagination', 'cursor', 'page', 'offset', 'limit'] },
  { pattern: '\\b(error|错误|fail)', expansions: ['error', 'error code', 'status code', '错误码'] },
]

// ---------------------------------------------------------------------------
// Dynamic context window
// ---------------------------------------------------------------------------
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-3.5-turbo': 16_385,
  'claude-sonnet-4-20250514': 200_000,
  'claude-opus-4-20250514': 200_000,
}

export interface ContextLimits {
  maxContextChars: number
  maxSectionChars: number
  maxCompressedBlocks: number
  adjacentChunkRadius: number
  // Token-based limits
  maxContextTokens: number
  maxSectionTokens: number
  maxEntityTokens: number
  maxRelationTokens: number
  maxChunkTokens: number
}

export function resolveContextLimits(modelId?: string): ContextLimits {
  const contextWindow = (modelId && MODEL_CONTEXT_WINDOWS[modelId]) || 16_000
  const scaleFactor = Math.min(contextWindow / 16_000, 4)
  return {
    // Existing char-based (keep for backward compat)
    maxContextChars: Math.min(Math.round(20_000 * scaleFactor), 80_000),
    maxSectionChars: Math.min(Math.round(2_500 * scaleFactor), 8_000),
    maxCompressedBlocks: Math.min(Math.round(4 * scaleFactor), 12),
    adjacentChunkRadius: scaleFactor >= 2 ? 2 : 1,
    // Token-based limits (scale with model)
    maxContextTokens: Math.min(Math.round(MAX_CONTEXT_TOKENS * scaleFactor), 32_000),
    maxSectionTokens: Math.min(Math.round(MAX_SECTION_TOKENS * scaleFactor), 6_000),
    maxEntityTokens: Math.min(Math.round(MAX_ENTITY_TOKENS * scaleFactor), 8_000),
    maxRelationTokens: Math.min(Math.round(MAX_RELATION_TOKENS * scaleFactor), 8_000),
    maxChunkTokens: Math.min(Math.round(MAX_CHUNK_TOKENS * scaleFactor), 16_000),
  }
}

// ---------------------------------------------------------------------------
// External
// ---------------------------------------------------------------------------
export const SHOPLINE_DOCS_BASE_URL = envStr(
  'AI_SHOPLINE_DOCS_BASE_URL',
  'https://developer.shopline.com',
)

// ---------------------------------------------------------------------------
// MCP (Model Context Protocol)
// ---------------------------------------------------------------------------
export const MAX_MCP_TOOLS_PER_REQUEST = envInt(
  'AI_MAX_MCP_TOOLS_PER_REQUEST',
  64,
)
export const MAX_MCP_TOOL_STEPS = envInt('AI_MAX_MCP_TOOL_STEPS', 5)
export const MCP_TOOL_CALL_TIMEOUT_MS = envInt(
  'AI_MCP_TOOL_CALL_TIMEOUT_MS',
  30_000,
)
export const MCP_CONNECTION_TIMEOUT_MS = envInt(
  'AI_MCP_CONNECTION_TIMEOUT_MS',
  10_000,
)
export const MAX_MCP_RESOURCE_SIZE_BYTES = envInt(
  'AI_MAX_MCP_RESOURCE_SIZE_BYTES',
  100_000,
)

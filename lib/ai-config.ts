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
export const TOP_K_CHUNKS = envInt('AI_TOP_K_CHUNKS', 8)
export const TOP_K_KEYWORD_DOCUMENTS = envInt('AI_TOP_K_KEYWORD_DOCUMENTS', 4)
export const SEMANTIC_TOP_K = envInt('AI_SEMANTIC_TOP_K', 20)
export const MAX_QUERY_VARIANTS = envInt('AI_MAX_QUERY_VARIANTS', 4)
export const MAX_SEMANTIC_CHUNKS = envInt('AI_MAX_SEMANTIC_CHUNKS', 6)
export const MAX_SEMANTIC_CHUNKS_PER_DOCUMENT = envInt(
  'AI_MAX_SEMANTIC_CHUNKS_PER_DOCUMENT',
  2,
)
export const ADJACENT_CHUNK_RADIUS = envInt('AI_ADJACENT_CHUNK_RADIUS', 1)

// ---------------------------------------------------------------------------
// Context assembly
// ---------------------------------------------------------------------------
export const MAX_CONTEXT_CHARS = envInt('AI_MAX_CONTEXT_CHARS', 12_000)
export const MAX_CONTEXT_SECTIONS = envInt('AI_MAX_CONTEXT_SECTIONS', 8)
export const MAX_SECTION_CHARS = envInt('AI_MAX_SECTION_CHARS', 1_700)
export const MAX_COMPRESSED_BLOCKS = envInt('AI_MAX_COMPRESSED_BLOCKS', 4)
export const MAX_KEYWORD_SNIPPET_CHARS = envInt(
  'AI_MAX_KEYWORD_SNIPPET_CHARS',
  1_600,
)

// ---------------------------------------------------------------------------
// Vector similarity
// ---------------------------------------------------------------------------
export const MIN_VECTOR_SIMILARITY = envFloat('AI_MIN_VECTOR_SIMILARITY', 0.15)
export const VECTOR_SIMILARITY_WINDOW = envFloat(
  'AI_VECTOR_SIMILARITY_WINDOW',
  0.18,
)

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
  2_200,
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

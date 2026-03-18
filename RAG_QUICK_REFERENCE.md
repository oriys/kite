# RAG SYSTEM QUICK REFERENCE

## FILE LOCATIONS & LINE NUMBERS

| File | Key Functions/Sections | Lines |
|------|------------------------|----|
| `lib/ai-config.ts` | Config constants, resolveContextLimits | 1-259 |
| `lib/ai-chat.ts` | Full RAG pipeline, semantic search, chat | 1-2232 |
| `lib/schema-ai.ts` | Database schema (document_chunks, aiChatMessages, etc) | 1-311 |
| `lib/embedding-pipeline.ts` | embedDocument, embedWorkspaceDocuments | 1-209 |
| `lib/chunker.ts` | chunkDocument, stripForEmbedding, token estimation | 1-342 |
| `lib/document-chunk-storage.ts` | Batch chunk insertion | 1-26 |
| `lib/ai-chat-prompt.ts` | System prompt building | 1-47 |
| `lib/document-relations.ts` | Reference link resolution | 1-560 |
| `lib/search/semantic-searcher.ts` | Hybrid search, RRF fusion | 1-176 |
| `lib/rag-evals.ts` | Evaluation metrics (Recall@K, MRR) | 1-182 |

---

## FUNCTION SIGNATURES (FREQUENTLY CALLED)

### Main RAG Pipeline
```typescript
// Primary retrieval function
async function retrieveChatContext(input: {
  workspaceId: string
  query: string
  documentId?: string
  visibility?: VisibilityContext
  debug?: boolean
  boostDocumentIds?: Set<string>
  chatModelId?: string
}): Promise<{
  contextText: string
  sources: ChatSource[]
  diagnostics?: RetrievalDiagnostics
}>

// Chat entry point (also handles multi-turn)
export async function streamChatResponse(input: {
  workspaceId: string
  sessionId: string
  userMessage: string
  documentId?: string
  model?: string
  userId?: string
  role?: MemberRole
  mcpPrompt?: {serverId: string; name: string; arguments?: Record<string, string>}
}): Promise<{
  stream: ReadableStream<Uint8Array>
  model: string
  sources: ChatSource[]
  attributionPromise: Promise<ChatMessageAttribution | undefined>
}>
```

### Semantic Search
```typescript
export async function searchSimilarChunks(input: {
  workspaceId: string
  query: string
  documentId?: string
  topK?: number
  visibility?: VisibilityContext
}): Promise<{
  hits: Array<{chunkId, documentId, chunkText, similarity, ...}>
  embeddingModelId: string | null
}>
```

### Document Embedding
```typescript
export async function embedDocument(input: {
  workspaceId: string
  documentId: string
  title: string
  content: string
  force?: boolean
  ragEnabled?: boolean
}): Promise<{
  status: 'updated' | 'unchanged' | 'skipped' | 'no_provider' | 'empty'
  chunkCount: number
}>

export async function embedWorkspaceDocuments(input: {
  workspaceId: string
  force?: boolean
  onProgress?: (completed: number, total: number) => void
}): Promise<{
  status: 'done' | 'rag_disabled' | 'no_provider'
  processed: number
  total: number
}>
```

### Chunking
```typescript
export function chunkDocument(title: string, content: string): DocumentChunk[]

export interface DocumentChunk {
  chunkIndex: number
  chunkText: string
  embeddingText: string
  tokenCount: number
  sectionPath: string | null
  heading: string | null
}

export function estimateTokens(text: string): number
```

### Reference Relations
```typescript
export async function rebuildWorkspaceDocumentRelations(
  workspaceId: string
): Promise<{ documents: number; relations: number }>

export async function listStoredDocumentRelations(input: {
  workspaceId: string
  sourceDocumentIds: string[]
  limit?: number
}): Promise<StoredDocumentRelation[]>
```

---

## CONFIGURATION TUNING

### Most Important Knobs
```
AI_MIN_VECTOR_SIMILARITY=0.28        # Reject low-confidence results
AI_VECTOR_SIMILARITY_WINDOW=0.12     # Allow range around best match
AI_TARGET_CHUNK_TOKENS=500           # Chunk size for embeddings
AI_TOP_K_CHUNKS=15                   # Initial semantic results
AI_MAX_SEMANTIC_CHUNKS=10            # Final semantic chunks
AI_MAX_SEMANTIC_CHUNKS_PER_DOCUMENT=3  # Diversity per doc
AI_MAX_CONTEXT_CHARS=20000           # Total context budget
AI_MAX_CONTEXT_SECTIONS=12           # Max sections to return

# Model-specific thresholds
AI_SIMILARITY_PROFILES_JSON='{"text-embedding-3-small": {"min": 0.28, "window": 0.12}}'

# Multi-turn features
AI_BOOST_RECENT_SOURCE_SCORE=15      # Score boost for prev docs
AI_MAX_HISTORY_TURNS_FOR_REWRITE=4   # Rewrite context window
AI_ENABLE_ITERATIVE_RETRIEVAL=0      # Disabled by default

# External services
AI_DEFAULT_EMBEDDING_MODEL='text-embedding-3-small'
AI_DEFAULT_RERANKER_MODEL='BAAI/bge-reranker-v2-m3'
```

### Per-Workspace Override
Set in `aiWorkspaceSettings.promptSettings`:
```json
{
  "queryExpansionRules": [
    {
      "pattern": "(custom_term)",
      "expansions": ["expansion1", "expansion2"],
      "scoreBoost": 20
    }
  ]
}
```

---

## CRITICAL THRESHOLDS

### Similarity Filtering
```
Model         Min    Window  Range
3-small       0.28   0.12    [0.28, topScore - 0.12]
3-large       0.32   0.10    [0.32, topScore - 0.10]
ada-002       0.22   0.15    [0.22, topScore - 0.15]
```

### Reference Matching
```
Score  Match Type
140    Full URL match
90     Tail path match (/docs/section)
70     Last segment match
60     Label text matches title
18     Search term matches title
6      Search term matches content

Min acceptance: 45
Gap threshold: 20 (score[0] - score[1])
```

### Scoring Bonuses
```
Primary vs Reference: +27 difference
Heading match: +18 (title), +15 (heading)
HTTP method match: +12
Content term match: +10
Code block bonus: +6 or -3
Blockquote: +3
Recent source boost: +15
```

---

## COMMON OPERATIONS

### Force Re-embedding a Document
```typescript
await embedDocument({
  workspaceId: 'ws_123',
  documentId: 'doc_456',
  title: document.title,
  content: document.content,
  force: true  // Skip hash check
})
```

### Retrieve Context (One-shot)
```typescript
const {contextText, sources, diagnostics} = await retrieveChatContext({
  workspaceId: 'ws_123',
  query: 'How to use permissions?',
  chatModelId: 'gpt-4o',  // For dynamic limits
  debug: true  // Get diagnostics
})
```

### Stream Chat Response
```typescript
const {stream, sources, model} = await streamChatResponse({
  workspaceId: 'ws_123',
  sessionId: 'session_456',
  userMessage: 'What is AccessScope?',
  userId: 'user_789',
  role: 'member'  // Visibility filtering
})

// Stream to client
const reader = stream.getReader()
while (true) {
  const {done, value} = await reader.read()
  if (done) break
  // Send value (Uint8Array) to client
}
```

### Rebuild Document Relations
```typescript
const {documents, relations} = await rebuildWorkspaceDocumentRelations('ws_123')
console.log(`Indexed ${documents} docs, found ${relations} references`)
```

### Run RAG Evaluation
```typescript
import {runWorkspaceRagEvals} from '@/lib/rag-evals'

const results = await runWorkspaceRagEvals({
  workspaceId: 'ws_123'
})

console.log(`Passed: ${results.passed}/${results.total}`)
console.log(`Recall@3: ${results.aggregateMetrics.avgRecallAt3}`)
```

---

## DEBUGGING & DIAGNOSTICS

### Enable Debug Mode
```typescript
const {diagnostics} = await retrieveChatContext({
  workspaceId: 'ws_123',
  query: 'test query',
  debug: true
})

console.log(diagnostics.queryVariants)        // Query expansions tried
console.log(diagnostics.timings)              // Performance breakdown
console.log(diagnostics.semanticChunks)       // Top-K chunks with scores
console.log(diagnostics.keywordDocuments)     // Keyword matches
console.log(diagnostics.selectedSections)     // Final sections used
```

### Check Embedding Coverage
```typescript
const status = await getEmbeddingStatus('ws_123')
console.log(`Coverage: ${status.embeddedDocuments}/${status.totalDocuments}`)
console.log(`Total chunks: ${status.totalChunks}`)
```

### Test Query Variants
```typescript
// Internal function (not exported, for testing)
import {buildRetrievalQueries} from '@/lib/ai-chat'
const rules = await loadQueryExpansionRules('ws_123')
const variants = buildRetrievalQueries('metaobject permissions', rules)
console.log(variants)  // ['metaobject permissions', 'metaobject', ...]
```

---

## ERROR HANDLING

### Graceful Fallbacks
```
1. No embedding provider
   → Semantic search skipped
   → Keyword-only results returned

2. Reranker unavailable
   → Heuristic-only ranking used
   → No ML score integration

3. Reference expansion fails
   → Log error, continue
   → Sources incomplete but usable

4. No grounding available
   → Return error message
   → Bilingual (Chinese + English)

5. Query rewrite fails
   → Use original query
   → Proceed with retrieval
```

### Visibility Filtering
```typescript
// When userId + role provided
const context = await retrieveChatContext({
  workspaceId: 'ws_123',
  query: 'test',
  visibility: {
    userId: 'user_123',
    role: 'member'  // See: public + partner + own + granted
  }
})

// Without visibility → all documents visible (admin context)
```

---

## DATABASE OPERATIONS

### Document Chunks Table
```sql
SELECT * FROM document_chunks WHERE document_id = 'doc_123'
  -- chunkIndex, chunkText, embedding, tokenCount, sectionPath, heading

-- Vector search
SELECT ... FROM document_chunks
WHERE embedding <=> '[...]'::vector ORDER BY embedding <=> '[...]'::vector
LIMIT 15

-- Count embeddings by document
SELECT COUNT(DISTINCT document_id) FROM document_chunks WHERE workspace_id = 'ws_123'
```

### Chat Messages Table
```sql
SELECT * FROM ai_chat_messages WHERE session_id = 'session_123'
  -- role, content, sources (JSONB array), attribution

-- Get latest message
SELECT * FROM ai_chat_messages
WHERE session_id = 'session_123'
ORDER BY created_at DESC LIMIT 1

-- Sources are stored as JSONB array:
sources: [
  {documentId: "doc_1", chunkId: "chunk_1", title: "...", preview: "..."},
  {documentId: "doc_2", chunkId: "chunk_2", ...}
]
```

### Document Relations Table
```sql
SELECT * FROM document_relations WHERE source_document_id = 'doc_123'
  -- target_document_id, relation_label, match_score

SELECT * FROM document_relations
WHERE source_document_id IN ('doc_1', 'doc_2')
ORDER BY match_score DESC
```

---

## PERFORMANCE TIPS

1. **Reuse Retrieved Context**
   - Multi-turn queries can SKIP retrieval if context sufficient
   - Saves 1-2 seconds per message

2. **Batch Operations**
   - Use embedWorkspaceDocuments() for bulk (not per-doc)
   - Embeddings batched by 20

3. **Cache Query Expansion Rules**
   - 60-second TTL per workspace
   - Reduce LLM calls for tuning

4. **Leverage Stored Relations**
   - Pre-computed before chat
   - Faster than on-demand search
   - Rebuild if document links change

5. **Monitor Similarity Thresholds**
   - Too high (>0.35) → miss relevant results
   - Too low (<0.25) → hallucinations increase
   - Model-specific: adjust per embedding model

6. **Parallel Operations**
   - Semantic + keyword search run in parallel
   - Provider resolution parallelized
   - Settings/MCP loaded in parallel

---

## TESTING & VALIDATION

### Unit Test Example (Query Expansion)
```typescript
import {buildRetrievalQueries} from '@/lib/ai-chat'

const queries = buildRetrievalQueries('metaobject permissions')
expect(queries.length).toBeGreaterThanOrEqual(1)
expect(queries[0]).toContain('metaobject')
```

### Integration Test (Full Pipeline)
```typescript
const {contextText, sources} = await retrieveChatContext({
  workspaceId: 'ws_test',
  query: 'test query',
  documentId: 'doc_test'
})

expect(contextText).toContain('[1]')  // Formatted context
expect(sources.length).toBeGreaterThan(0)
expect(sources[0]).toHaveProperty('documentId')
expect(sources[0]).toHaveProperty('title')
```

### Evaluation Test
```typescript
import {runWorkspaceRagEvals} from '@/lib/rag-evals'

const result = await runWorkspaceRagEvals({workspaceId: 'ws_test'})
console.log(`Pass rate: ${result.passed}/${result.total}`)
console.log(`MRR: ${result.aggregateMetrics.avgMrr}`)
```


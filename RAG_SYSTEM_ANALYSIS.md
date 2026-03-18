# KITE RAG SYSTEM - EXECUTIVE SUMMARY

## ARCHITECTURE OVERVIEW

The RAG system is a **multi-stage retrieval pipeline** that transforms user queries into grounded documentation context through:

1. **Query Expansion** - Domain-specific rules expand query intent
2. **Parallel Search** - Semantic (vector) + Keyword (FTS) searches run simultaneously  
3. **Merging & Filtering** - Results deduplicated with similarity thresholding
4. **Neighborhood Expansion** - Adjacent chunks loaded for context
5. **Reference Expansion** - Related documents discovered via markdown links
6. **Reranking** - Optional ML reranking combines with heuristic scoring
7. **Context Assembly** - Formatted context string built under character limits
8. **Chat Pipeline** - Multi-turn RAG with query rewriting and retrieval skipping

---

## KEY CONFIGURATION CONSTANTS

| Constant | Value | Purpose |
|----------|-------|---------|
| TARGET_CHUNK_TOKENS | 500 | Ideal chunk size for embeddings |
| TOP_K_CHUNKS | 15 | Initial semantic search results |
| TOP_K_KEYWORD_DOCUMENTS | 4 | Keyword search limit |
| MAX_SEMANTIC_CHUNKS | 10 | Final semantic chunks after filtering |
| MAX_SEMANTIC_CHUNKS_PER_DOCUMENT | 3 | Diversity limit per document |
| MAX_CONTEXT_SECTIONS | 12 | Maximum context sections to return |
| MAX_CONTEXT_CHARS | 20,000 | Total context char budget |
| MAX_SECTION_CHARS | 2,500 | Max chars per section |
| MIN_VECTOR_SIMILARITY | 0.28 | Minimum similarity threshold |
| VECTOR_SIMILARITY_WINDOW | 0.12 | Dynamic range (tolerance) |
| SIMILARITY_PROFILES | {model→min/window} | Per-model thresholds |
| ADJACENT_CHUNK_RADIUS | 1 | Neighborhood expansion radius |
| MAX_QUERY_VARIANTS | 4 | Query expansion count |
| MAX_RELATED_DOCUMENTS | 4 | Related doc expansion limit |
| MAX_HISTORY_TURNS_FOR_REWRITE | 4 | Conversation turns for rewrite |

---

## CORE DATA FLOW: retrieveChatContext()

```
User Query
    ↓ (Line 1585)
Load query expansion rules (60s in-memory cache)
    ↓ (Line 1596-1597)
Build 1-4 query variants:
  • Original + normalized forms
  • HTTP method/path extraction
  • Rule-based expansions
    ↓ (Line 1600-1638)
PARALLEL:
  ├─ Semantic search (all variants)
  │   ├─ Generate embeddings
  │   ├─ Vector similarity search (TOP_K_CHUNKS per variant)
  │   ├─ Merge by chunkId
  │   ├─ Apply similarity floor thresholding
  │   └─ Diversity filter: max chunks per document
  │
  └─ Keyword search
      ├─ Extract query terms
      ├─ CJK: ILIKE patterns
      └─ English: PostgreSQL tsvector + ts_rank
    ↓ (Line 1641-1654)
Load chunk neighborhoods (±radius around semantic chunks)
    ↓ (Line 1656-1670)
Build semantic sections (compress with term highlights)
Add keyword sections (skip if already included)
    ↓ (Line 1672-1703)
Expand references:
  ├─ Try: Stored document relations (pre-computed)
  └─ Fallback: On-demand reference candidate search
    ↓ (Line 1711-1718)
Rerank all sections:
  ├─ Heuristic: heading/title/content matches, primary vs reference boost
  ├─ Optional: ML reranker (BAAI/bge-reranker-v2-m3)
  └─ Diversity: max 2 sections per document
    ↓ (Line 1720-1759)
Build final context string (formatted with [1], [2] labels)
Return: { contextText, sources, diagnostics }
```

---

## SIMILARITY THRESHOLDING (selectRelevantChunks)

Critical algorithm to prevent low-quality results:

```
1. Get model-specific thresholds from SIMILARITY_PROFILES
   • text-embedding-3-small: min=0.28, window=0.12
   • text-embedding-3-large: min=0.32, window=0.10
   • text-embedding-ada-002: min=0.22, window=0.15

2. Check top chunk similarity vs MIN_VECTOR_SIMILARITY
   → If top < threshold, reject ALL chunks

3. Calculate dynamic floor
   floor = MAX(MIN_VECTOR_SIMILARITY, topSimilarity - window)

4. Multi-pass selection:
   Pass 1: Keep top 2 chunks (always)
   Pass 2: Accept chunks with similarity >= floor
   Pass 3: Limit to 1 chunk per document
   Pass 4: Allow up to MAX_SEMANTIC_CHUNKS_PER_DOCUMENT per doc
   Final: Cap at MAX_SEMANTIC_CHUNKS total
```

---

## HEURISTIC RERANKING SCORES

Function: heuristicRerankContextSections() (Lines 649-759)

```
Base Scores:
  • Primary document: +55
  • Reference document: +28
  • Recent conversation doc: +15 (BOOST_RECENT_SOURCE_SCORE)

Term Matching:
  • Heading contains term: +15
  • Title contains term: +18
  • Content contains term: +7

Pattern Matching:
  • HTTP method (GET/POST/etc) in section: +12
  • Schema/type name match: +10
  • Code blocks in "how-to" queries: +5

ML Score Integration (if available):
  • Normalize reranker scores to 0-80 range
  • Add to heuristic score

Selection Strategy:
  • Sort by total score DESC
  • Keep up to MAX_CONTEXT_SECTIONS
  • Limit: 1 per document for references, 2 total per document
```

---

## CONTEXT COMPRESSION (compressContentForTerms)

Aggressive compression while preserving relevance (Lines 583-647):

```
1. Split into logical blocks:
   • By paragraph (double newlines)
   • Respect code fence boundaries
   • Merge headings with content

2. Score each block:
   • Term matches: heading ×18, body ×10, compact ×8
   • Query match: +20
   • Structural: heading +6, table +4, blockquote +3
   • Code blocks: context-dependent ±6
   • Rule expansion matches: +scoreBoost

3. Select top MAX_COMPRESSED_BLOCKS by score
4. Preserve original order
5. Prepend document title heading if available
6. Concatenate until maxChars limit reached
7. Add "…" if truncated
```

---

## DOCUMENT CHUNKING (chunkDocument)

Sophisticated multi-stage chunking (Lines 279-331):

```
1. Split by headings → sections with hierarchy
2. For each section:
   a. If tokens <= TARGET_CHUNK_TOKENS (500):
      → Single chunk with contextual prefix
   b. If tokens > TARGET_CHUNK_TOKENS:
      → splitTextIntoChunks with overlap
3. Chunk boundaries respect:
   • Paragraph breaks (2x newline)
   • Sentence boundaries (.!?。！？)
   • Atomic blocks (tables, ordered lists)
   • Line breaks as fallback
4. Overlap: chunk[i].start = max(1, chunk[i-1].end - OVERLAP_TOKENS)
5. For embedding: prepend document title + section path
6. For storage: preserve raw chunk text + computed tokens
```

**stripForEmbedding() preprocessing:**
- Remove code blocks (keep first 3 lines as summary)
- Remove/unwrap markdown links
- Remove URLs and images
- Normalize whitespace
- Remove emphasis markers

---

## QUERY EXPANSION RULES

Domain-specific patterns trigger semantic expansion (AI_DEFAULT_QUERY_EXPANSION_RULES):

```typescript
Pattern Examples:
  '(权限点|权限|access\\s*scope)' → expand to: ['权限点', 'AccessScope', 'access scope', '授权']
                                    scoreBoost: 18
  '(metaobject|元对象)' → expand to: ['metaobject', '元对象']
                          scoreBoost: 14
  '\\b(auth|authentication)\\b' → expand to: ['authentication', 'authorization', 'API key', 'OAuth', 'token']

Rules are:
  • Compiled into RegExp on first use (error handling)
  • Cached per workspace (60-second TTL)
  • Applied during buildRetrievalQueries()
  • Score boosts applied during content scoring
  • Configurable via promptSettings.queryExpansionRules
```

---

## REFERENCE EXPANSION & DOCUMENT RELATIONS

Two-stage approach:

### Stage 1: Stored Relations (Pre-computed, Preferred)
- Document links extracted during pipeline rebuild
- Stored in `document_relations` table
- Scoring: URL match (140), path (90), segment (70), label (60), terms (18)
- Min score: 45, Gap threshold: 20
- Called via `listStoredDocumentRelations()`

### Stage 2: On-demand Expansion (Fallback)
- Extract markdown links from primary documents
- Search for matching documents by candidate terms
- Score by URL match, title/content keywords
- Cap at MAX_RELATED_DOCUMENTS per search

---

## MULTI-TURN RAG: rewriteQueryOrSkipRetrieval()

Lines 1989-2054 - Smart retrieval decision for follow-ups:

```
Input: User message + recent history

No history?
  → Retrieve with user message unchanged

Has history?
  → Ask LLM: "Is retrieval needed?"
  
LLM outputs "SKIP"?
  → Skip retrieval, reuse previous sources

Otherwise?
  → Retrieve with rewritten query
  → Fallback to original if rewrite fails/too long

Configuration:
  • MAX_HISTORY_TURNS_FOR_REWRITE: 4 (look-back window)
  • TEMPERATURE_QUERY_REWRITE: 0.0 (deterministic)
  • Handles pronouns + contextual references

Example:
  Q1: "What are AccessScope permissions?"
  Q2: "How many are there?" → Rewritten to include "AccessScope"
  Q3: "Can you elaborate?" → Might SKIP (context sufficient)
```

---

## CHAT SESSION & MESSAGE STORAGE

Three core tables in schema-ai.ts:

### aiChatSessions
- workspaceId, userId → session ownership
- documentId (nullable) → optional document scope
- title, createdAt, updatedAt

### aiChatMessages
- sessionId (FK)
- role: 'user' | 'assistant' | 'system'
- content: string
- sources: ChatSource[] (metadata for each source used)
- attribution: ChatMessageAttribution (MCP usage)

### ChatSource interface (from ai-chat-shared.ts)
```
{
  documentId: string
  chunkId: string
  title: string
  preview: string
  relationType: 'primary' | 'reference'
  relationDescription: string
}
```

---

## EMBEDDING PIPELINE (embedDocument)

Complete flow with change detection:

```
1. If ragEnabled === false → delete chunks, skip
2. Compute SHA256 hash of (title + content)
3. Check existing chunks:
   → If hash matches → skip (unchanged)
   → If hash differs → re-embed
4. Resolve embedding provider (error if none)
5. Chunk document (respects structure)
6. Batch embed (EMBEDDING_BATCH_SIZE=20):
   → Call requestAiEmbedding() in loops
   → Validate count matches
7. Build chunk rows with vectors
8. Atomic transaction:
   → Delete old chunks
   → Insert new chunks
9. Return { status, chunkCount }
```

Status values:
- `updated` - Re-embedded
- `unchanged` - Hash match, skipped
- `skipped` - ragEnabled=false
- `no_provider` - Embedding provider unavailable
- `empty` - No chunks produced

---

## VISIBILITY & PERMISSIONS

Function: buildVisibilityFilter() (Lines 81-97)

```
Role-based access (VisibilityContext = userId + role):

Owner/Admin:
  → See all documents

Member/Guest:
  → See: public visibility
  → See: partner visibility
  → See: own created documents
  → See: explicitly granted via document_permissions table

Implemented as SQL filter:
  visibility IN ('public', 'partner')
  OR created_by = userId
  OR EXISTS (document_permissions where user_id = userId)
```

---

## ERROR HANDLING & FALLBACKS

Graceful degradation throughout:

```
1. Embedding provider unavailable
   → Semantic search skipped
   → Keyword search only

2. Reranker unavailable
   → Heuristic-only ranking used

3. Reference expansion fails
   → Log error, continue without references

4. Query rewrite fails
   → Use original query

5. Iterative retrieval fails
   → Use initial results

6. No grounding available
   → Return error message (bilingual)
   → Log diagnostics for debugging
```

---

## DIAGNOSTICS & EVALUATION

### RetrievalDiagnostics (exported when debug=true)

```typescript
{
  queryVariants: string[]
  timings: {
    semanticSearchMs: number
    keywordSearchMs: number
    neighborhoodMs: number
    rerankMs: number
    referenceExpansionMs: number
    totalMs: number
  }
  semanticChunks: [{chunkId, documentId, documentTitle, chunkIndex, similarity}]
  keywordDocuments: [{documentId, title}]
  rerankScores: [{documentId, title, score}]
  selectedSections: [{documentId, title, relationType, contentPreview}]
}
```

### RAG Evaluation Suite (rag-evals.ts)

```
Metrics:
  • Recall@K: Expected sources in top-K results
  • MRR: Mean Reciprocal Rank (1/(rank of first match))
  • Context Coverage: Expected terms found in output

Test cases: 4 queries covering metaobject, permissions, status codes, bulk operations
```

---

## IMPROVEMENTS & EXTENSION POINTS

1. **Custom Query Expansion**
   - Add domain-specific rules via promptSettings.queryExpansionRules
   - Modify AI_DEFAULT_QUERY_EXPANSION_RULES in ai-config

2. **Similarity Tuning**
   - Adjust SIMILARITY_PROFILES for different embedding models
   - Set via AI_SIMILARITY_PROFILES_JSON env var

3. **Reranking**
   - Currently BAAI/bge-reranker-v2-m3
   - Optional: add custom reranker provider

4. **Iterative Retrieval**
   - Disabled by default (ENABLE_ITERATIVE_RETRIEVAL=0)
   - Enable for sparse results: AI_ENABLE_ITERATIVE_RETRIEVAL=1

5. **Context Scaling**
   - Use resolveContextLimits(modelId) for dynamic limits
   - Scales based on model's context window

6. **CJK Language Support**
   - Dual codepath: ILIKE for CJK, tsvector for English
   - Term extraction handles Chinese, Japanese, Korean

---

## IMPORTS & DEPENDENCIES

**ai-chat.ts imports:**
- drizzle-orm: Database queries + SQL helpers
- ai-server: LLM providers, embeddings, reranking
- ai-config: All tunable parameters
- ai-chat-shared: ChatSource, ChatMessageAttribution types
- chunker: chunkDocument()
- embedding-pipeline: embedDocument()
- document-relations: Reference link resolution
- mcp-client: Model Context Protocol integration

**External calls:**
- requestAiEmbedding() - Generate embeddings
- requestAiRerank() - ML reranking
- requestAiTextCompletion() - Query rewrite/iterative retrieval
- requestAiChatCompletionStream() - Main chat response


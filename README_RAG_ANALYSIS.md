# RAG System Deep Dive - Complete Documentation

## WHAT YOU HAVE

You now have **4 comprehensive documentation files** (2,577 lines total) covering every aspect of the Kite RAG system:

### 📘 Documents Created

1. **RAG_SYSTEM_ANALYSIS.md** (14 KB, 466 lines)
   - Primary reference: Architecture + every config constant + all function signatures
   - 10 major sections covering each source file
   - Line number references for code lookup
   - Database schema for all tables
   - Improvement opportunities

2. **RAG_CRITICAL_ALGORITHMS.md** (23 KB, 800+ lines)
   - Deep dive: 8 critical algorithms with pseudocode
   - Step-by-step execution flows with real examples
   - Performance analysis (time/space complexity)
   - Network call patterns and optimization

3. **RAG_QUICK_REFERENCE.md** (12 KB, 350+ lines)
   - Practical cheat sheet for developers
   - File locations + function signatures
   - Copy-paste code examples
   - Configuration tuning guide
   - Common operations + debugging commands

4. **RAG_DOCUMENTATION_INDEX.md** (9 KB)
   - Navigation guide + quick start
   - Common questions answered
   - Key concepts explained
   - File change tracking guidelines

---

## KEY INSIGHTS FROM ANALYSIS

### Architecture (10-Stage Pipeline)
```
User Query
  ↓
[1] Query Expansion (1-4 variants via rules)
  ↓
[2] PARALLEL: Semantic Search (vector) + Keyword Search (FTS)
  ↓
[3] Merge & Filter (similarity thresholding + diversity)
  ↓
[4] Neighborhood Expansion (adjacent chunks)
  ↓
[5] Semantic Sections Assembly
  ↓
[6] Reference Expansion (markdown links)
  ↓
[7] Reranking (heuristic + optional ML)
  ↓
[8] Context Compression (block scoring)
  ↓
[9] Context String Formatting ([1], [2] labels)
  ↓
[10] Return: {contextText, sources, diagnostics}
```

### Critical Thresholds
```
Similarity Filter:
  • MIN: 0.28 (text-embedding-3-small)
  • Window: 0.12 (dynamic range)
  • Floor calculation: MAX(MIN, topScore - window)

Reranking Scores:
  • Primary doc: base 55
  • Reference doc: base 28
  • Recent source boost: +15
  • Term matches: +7 to +18
  • ML score normalized: +0 to +80

Reference Matching:
  • URL match: 140 points
  • Path match: 90 points
  • Min acceptance: 45 points
  • Gap threshold: 20 (score[0] - score[1])
```

### Multi-turn RAG
- Intelligent query rewriting (LLM decides SKIP vs RETRIEVE)
- Previous sources reused when context sufficient
- Recent document IDs boosted (+15 score)
- Conversation context window: 4 turns

### Graceful Fallbacks
- No embedding provider? → Keyword-only search
- Reranker unavailable? → Heuristic-only ranking
- Reference expansion fails? → Continue without references
- Query rewrite fails? → Use original query
- No grounding? → Return error message

---

## IMPORTANT CONFIGURATION CONSTANTS

| Constant | Default | Env Var | Purpose |
|----------|---------|---------|---------|
| TARGET_CHUNK_TOKENS | 500 | AI_TARGET_CHUNK_TOKENS | Ideal chunk size |
| MIN_VECTOR_SIMILARITY | 0.28 | AI_MIN_VECTOR_SIMILARITY | Confidence floor |
| TOP_K_CHUNKS | 15 | AI_TOP_K_CHUNKS | Semantic search limit |
| MAX_SEMANTIC_CHUNKS | 10 | AI_MAX_SEMANTIC_CHUNKS | Final chunks count |
| MAX_CONTEXT_CHARS | 20,000 | AI_MAX_CONTEXT_CHARS | Total context budget |
| BOOST_RECENT_SOURCE_SCORE | 15 | AI_BOOST_RECENT_SOURCE_SCORE | Multi-turn boost |
| ENABLE_ITERATIVE_RETRIEVAL | 0 | AI_ENABLE_ITERATIVE_RETRIEVAL | Sparse result recovery |

**All constants are tunable via environment variables with `AI_` prefix.**

---

## SOURCE FILES ANALYZED

✅ **ai-config.ts** (259 lines)
  - Configuration, defaults, env var parsing

✅ **ai-chat.ts** (2,232 lines) 
  - Complete RAG pipeline, chat session management, multi-turn logic

✅ **schema-ai.ts** (311 lines)
  - Database schema: 6 tables for AI features

✅ **embedding-pipeline.ts** (209 lines)
  - Document embedding orchestration, batching, coverage tracking

✅ **chunker.ts** (342 lines)
  - Text chunking, tokenization, markdown parsing, atomic blocks

✅ **document-chunk-storage.ts** (26 lines)
  - Batch chunk insertion utilities

✅ **ai-chat-prompt.ts** (47 lines)
  - System prompt construction

✅ **document-relations.ts** (560 lines)
  - Reference link extraction, matching, scoring

✅ **search/semantic-searcher.ts** (176 lines)
  - Hybrid search, Reciprocal Rank Fusion (RRF)

✅ **rag-evals.ts** (182 lines)
  - Evaluation metrics: Recall@K, MRR, context coverage

---

## MAJOR ALGORITHMS DOCUMENTED

### 1. Similarity Thresholding
Prevents low-confidence semantic results from contaminating context
- Model-specific thresholds (3-small vs 3-large vs ada-002)
- Two-pass diversity filtering (1 per doc, then up to 3 per doc)

### 2. Query Expansion
Generates 1-4 query variants for parallel semantic search
- Original + normalized forms
- HTTP method/path extraction
- Rule-based expansions (domain-specific)

### 3. Context Compression
Reduces section size while preserving relevance
- Block scoring (headings +18, content +10, etc.)
- Select top blocks, preserve order, truncate with "…"
- Respects character budget

### 4. Heuristic Reranking
Orders sections by relevance combining multiple signals
- Base scores (primary vs reference)
- Term matching bonuses (heading/title/content)
- HTTP method and schema matching
- ML score integration (0-80 scale)

### 5. Semantic Merging
Deduplicates chunks across query variants
- Tracks cross-variant matches (queryMatches count)
- Keeps best similarity score
- Sorts by similarity then cross-variant agreement

### 6. Chunk Splitting
Splits sections into ~500-token chunks with overlap
- Respects paragraph/sentence boundaries
- Preserves atomic blocks (tables, ordered lists)
- Adds contextual prefix for embedding

### 7. Query Rewrite (Multi-turn)
Decides SKIP vs RETRIEVE for follow-up messages
- LLM analyzes conversation context
- Reuses previous sources if appropriate
- Resolves pronouns and contextual references

### 8. Iterative Retrieval
Recovers from sparse initial results
- Asks LLM for 1-2 alternative queries
- Runs follow-up retrievals in parallel
- Merges results by deduplication

---

## USE CASES FOR DOCUMENTATION

### Understanding the System
→ Start with **RAG_SYSTEM_ANALYSIS.md** section 2 ("retrieveChatContext()")

### Debugging Behavior
→ Use **RAG_QUICK_REFERENCE.md** "DEBUGGING & DIAGNOSTICS"
→ Check algorithm details in **RAG_CRITICAL_ALGORITHMS.md**

### Tuning Performance
→ **RAG_QUICK_REFERENCE.md** "CRITICAL THRESHOLDS"
→ **RAG_SYSTEM_ANALYSIS.md** section 1 (CONFIG CONSTANTS)

### Implementing Features
→ **RAG_QUICK_REFERENCE.md** "COMMON OPERATIONS"
→ Reference function signatures there
→ Look up algorithm if needed

### Writing Tests
→ **RAG_QUICK_REFERENCE.md** "TESTING & VALIDATION"
→ Use debug diagnostics for assertions

---

## CRITICAL CODE LOCATIONS

| What | File | Lines |
|------|------|-------|
| Query variants generation | ai-chat.ts | 348-401 |
| Semantic search | ai-chat.ts | 234-304 |
| Similarity thresholding | ai-chat.ts | 436-485 |
| Block scoring | ai-chat.ts | 539-581 |
| Context compression | ai-chat.ts | 583-647 |
| Heuristic reranking | ai-chat.ts | 649-759 |
| ML reranking | ai-chat.ts | 776-814 |
| Reference expansion | ai-chat.ts | 851-1116 |
| Neighborhood loading | ai-chat.ts | 1163-1218 |
| Main retrieval pipeline | ai-chat.ts | 1585-1760 |
| Multi-turn query rewrite | ai-chat.ts | 1989-2054 |
| Chat streaming | ai-chat.ts | 2058-2231 |
| Chunking | chunker.ts | 279-331 |
| Token estimation | chunker.ts | 40-44 |
| Embedding preprocessing | chunker.ts | 46-59 |

---

## DATABASE SCHEMA (10 TABLES)

1. **aiProviderConfigs** - LLM provider configuration
2. **aiWorkspaceSettings** - Workspace AI settings + expansion rules
3. **documentChunks** - Embeddings + metadata (vector search target)
4. **aiChatSessions** - Conversation sessions
5. **aiChatMessages** - Chat messages with sources + attribution
6. **mcpServerConfigs** - Model Context Protocol servers
7. **workspaceCliSkills** - CLI skill installations
8. **documentRelations** - Pre-computed reference links
9. **documents** - (external) Documents being indexed
10. **workspaces** - (external) Workspace scoping

---

## NEXT STEPS FOR YOUR IMPROVEMENTS

1. **Read the docs** (1-2 hours)
   - Focus on **RAG_SYSTEM_ANALYSIS.md** first
   - Deep dive into relevant algorithms in **RAG_CRITICAL_ALGORITHMS.md**

2. **Enable diagnostics** (5 mins)
   - Set `debug: true` in retrieveChatContext()
   - See all intermediate results (queries, chunks, scores, timings)

3. **Run evaluations** (10 mins)
   - Use `runWorkspaceRagEvals()` to measure baseline
   - Get Recall@K, MRR, context coverage

4. **Plan improvements**
   - Use critical thresholds as tuning targets
   - Design A/B tests using diagnostics
   - Track metrics with eval suite

5. **Implement safely**
   - Reference algorithms for correctness
   - Check error handling patterns
   - Update docs as you change code

---

## FILES AT A GLANCE

```
/home/it/kite/
├── RAG_SYSTEM_ANALYSIS.md (PRIMARY REFERENCE)
│   └── Architecture + config + schemas + functions
├── RAG_CRITICAL_ALGORITHMS.md (DEEP DIVE)
│   └── 8 algorithms with pseudocode + examples
├── RAG_QUICK_REFERENCE.md (CHEAT SHEET)
│   └── Function signatures + config + common ops
├── RAG_DOCUMENTATION_INDEX.md (NAVIGATION)
│   └── Quick start + Q&A + file change tracking
└── lib/
    ├── ai-config.ts (tunable constants)
    ├── ai-chat.ts (2232-line RAG pipeline)
    ├── schema-ai.ts (database schema)
    ├── embedding-pipeline.ts (embedding orchestration)
    ├── chunker.ts (text processing)
    ├── document-relations.ts (reference links)
    ├── search/semantic-searcher.ts (hybrid search)
    └── rag-evals.ts (evaluation metrics)
```

---

## SUPPORT FOR IMPLEMENTATION

These docs enable you to:

✅ Understand the complete RAG architecture
✅ Locate specific code by function/line number
✅ Reference algorithm pseudocode for implementation
✅ Tune configuration constants with confidence
✅ Debug issues with diagnostic output
✅ Implement new features without breaking existing ones
✅ Write tests with example patterns
✅ Measure improvements with eval suite

---

**You're ready to implement major improvements. Good luck! 🚀**


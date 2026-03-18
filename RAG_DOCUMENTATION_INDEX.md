# RAG SYSTEM DOCUMENTATION INDEX

This directory contains comprehensive documentation of the Kite RAG (Retrieval Augmented Generation) system. Use these files to understand the architecture, implementation details, and how to extend it.

## DOCUMENTATION FILES

### 1. RAG_SYSTEM_ANALYSIS.md (PRIMARY REFERENCE)
**Size:** ~466 lines | **Scope:** Comprehensive system overview

**Contains:**
- Architecture overview of the multi-stage retrieval pipeline
- All configuration constants (with env var overrides)
- Complete data structures and interfaces
- Database schema for all 10 tables
- Full function signatures for all exported APIs
- Line number references for easy code lookup
- Critical algorithms summary
- Improvement opportunities

**When to use:**
- Getting started with the codebase
- Understanding system components
- Implementing major features
- Reviewing breaking changes

**Key sections:**
1. AI CONFIG - All tunable parameters
2. AI CHAT - Main RAG pipeline + chat system
3. SCHEMA AI - Database design
4. EMBEDDING PIPELINE - Document embedding
5. CHUNKER - Text chunking and tokenization
6. DOCUMENT CHUNK STORAGE - Batch operations
7. AI CHAT PROMPT - System prompt construction
8. DOCUMENT RELATIONS - Reference link resolution
9. SEMANTIC SEARCHER - Hybrid search
10. RAG EVALS - Evaluation metrics

---

### 2. RAG_CRITICAL_ALGORITHMS.md (DEEP DIVE)
**Size:** ~800+ lines | **Scope:** Algorithm pseudocode and examples

**Contains:**
- 8 critical algorithms with detailed pseudocode
- Step-by-step flow descriptions
- Real-world execution examples
- Performance analysis (time/space complexity)
- Network call patterns

**Algorithms covered:**
1. Similarity Thresholding (selectRelevantChunks) - Confidence filtering
2. Query Expansion (buildRetrievalQueries) - Query variants generation
3. Context Compression (compressContentForTerms) - Aggressive size reduction
4. Heuristic Reranking (heuristicRerankContextSections) - Relevance scoring
5. Merge Semantic Chunks (mergeSemanticChunkResults) - Deduplication
6. Document Chunk Splitting (splitTextIntoChunks) - Boundary-aware chunking
7. Multi-turn Query Rewrite (rewriteQueryOrSkipRetrieval) - Context reuse logic
8. Iterative Retrieval (maybeIterativeRetrieval) - Sparse result recovery

**When to use:**
- Debugging unexpected behavior
- Tuning scoring/thresholding
- Optimizing performance
- Implementing similar algorithms
- Writing unit tests

---

### 3. RAG_QUICK_REFERENCE.md (PRACTICAL GUIDE)
**Size:** ~350+ lines | **Scope:** Developer cheat sheet

**Contains:**
- File locations + line numbers (quick lookup table)
- Function signatures (copy-paste ready)
- Configuration tuning guide
- Critical thresholds and scoring
- Common operations with code examples
- Debugging and diagnostics commands
- Database queries (SQL examples)
- Performance optimization tips
- Testing patterns

**When to use:**
- Implementing a new feature
- Fixing a bug quickly
- Adding a new configuration
- Running diagnostics
- Writing tests
- Operating the system

**Sections:**
- File/Function mapping
- Config tuning guide
- Scoring thresholds
- Code examples (embed, retrieve, chat)
- Error handling patterns
- SQL queries
- Performance tips
- Testing examples

---

## QUICK START: USING THESE DOCS

### For Understanding Architecture
1. Read **RAG_SYSTEM_ANALYSIS.md** sections 1-3 (Config + AI Chat overview)
2. Review **retrieveChatContext()** flow diagram in section 2
3. Check the database schema in section 3

### For Implementing Features
1. Find the relevant function in **RAG_QUICK_REFERENCE.md** (FILE LOCATIONS)
2. Read the full function signature there
3. Look up the algorithm in **RAG_CRITICAL_ALGORITHMS.md** if needed
4. Check error handling patterns in **RAG_QUICK_REFERENCE.md**

### For Debugging
1. Enable debug mode in **RAG_QUICK_REFERENCE.md** (DEBUGGING section)
2. Use the diagnostics output to locate the issue
3. Reference the algorithm in **RAG_CRITICAL_ALGORITHMS.md**
4. Check the relevant section in **RAG_SYSTEM_ANALYSIS.md**

### For Tuning Performance
1. See **RAG_SYSTEM_ANALYSIS.md** section 1 (CONFIG CONSTANTS)
2. Reference thresholds in **RAG_QUICK_REFERENCE.md** (CRITICAL THRESHOLDS)
3. Check performance tips in **RAG_QUICK_REFERENCE.md**
4. Review algorithm complexity in **RAG_CRITICAL_ALGORITHMS.md** (PERFORMANCE CHARACTERISTICS)

---

## KEY CONCEPTS TO UNDERSTAND

### 1. The RAG Pipeline (retrieveChatContext)
```
Query → Expand → Semantic Search (parallel) + Keyword Search (parallel)
  → Merge & Filter → Neighborhood Expansion → Reference Expansion
  → Rerank → Format → Context String
```
Reference: **RAG_SYSTEM_ANALYSIS.md** section 2

### 2. Similarity Thresholding
Why: Prevent low-confidence semantic results from contaminating context
How: Model-specific min/window thresholds applied to top-K
Config: MIN_VECTOR_SIMILARITY, VECTOR_SIMILARITY_WINDOW, SIMILARITY_PROFILES
Reference: **RAG_CRITICAL_ALGORITHMS.md** algorithm 1

### 3. Context Compression
Why: Fit high-quality sections within character budget
How: Score blocks, select top, concatenate, truncate with "…"
Config: MAX_CONTEXT_CHARS, MAX_SECTION_CHARS, MAX_COMPRESSED_BLOCKS
Reference: **RAG_CRITICAL_ALGORITHMS.md** algorithm 3

### 4. Multi-turn RAG
Why: Reuse context when appropriate, avoid redundant retrievals
How: LLM decides SKIP vs RETRIEVE based on conversation
Config: MAX_HISTORY_TURNS_FOR_REWRITE, BOOST_RECENT_SOURCE_SCORE
Reference: **RAG_CRITICAL_ALGORITHMS.md** algorithm 7

### 5. Document Chunking
Why: Create embeddings that fit ~500 tokens with semantic boundaries
How: Split by headings, then intelligently chunk while respecting tables/lists
Config: TARGET_CHUNK_TOKENS, OVERLAP_TOKENS
Reference: **RAG_CRITICAL_ALGORITHMS.md** algorithm 6, **RAG_SYSTEM_ANALYSIS.md** section 5

---

## COMMON QUESTIONS ANSWERED

**Q: How do I improve retrieval quality?**
A: See **RAG_QUICK_REFERENCE.md** "CRITICAL THRESHOLDS" section. Typically:
- Tune MIN_VECTOR_SIMILARITY and VECTOR_SIMILARITY_WINDOW
- Add query expansion rules
- Run evaluation suite (RAG_EVALS) to measure impact

**Q: What's the difference between semantic and keyword search?**
A: Semantic uses vector similarity (understand intent), keyword uses FTS (exact term matching).
Both run in parallel and results are merged with RRF (Reciprocal Rank Fusion).
Reference: **RAG_SYSTEM_ANALYSIS.md** sections 2 and 9

**Q: How does multi-turn chat work?**
A: Previous assistant messages' sources are collected and boosted in scoring.
If appropriate, retrieval is skipped entirely (SKIP action).
Reference: **RAG_CRITICAL_ALGORITHMS.md** algorithm 7

**Q: What if no embedding provider is configured?**
A: Graceful fallback: semantic search skipped, keyword-only results returned.
Reference: **RAG_QUICK_REFERENCE.md** "ERROR HANDLING"

**Q: How are markdown links resolved?**
A: Extracted from primary documents, scored by URL match, then search results confirmed.
Reference: **RAG_SYSTEM_ANALYSIS.md** section 8

**Q: Can I customize query expansion rules per workspace?**
A: Yes, set in `aiWorkspaceSettings.promptSettings.queryExpansionRules`.
Reference: **RAG_QUICK_REFERENCE.md** "CONFIGURATION TUNING"

---

## FILE CHANGE TRACKING

When making changes to RAG code, update these docs in this order:
1. **RAG_CRITICAL_ALGORITHMS.md** - If algorithm logic changes
2. **RAG_SYSTEM_ANALYSIS.md** - If signatures/config changes
3. **RAG_QUICK_REFERENCE.md** - If common usage patterns change

---

## RELATED FILES IN PROJECT

```
/lib/
  ai-config.ts              # All configuration constants
  ai-chat.ts                # Main RAG pipeline (2232 lines)
  schema-ai.ts              # Database schema
  embedding-pipeline.ts     # Document embedding orchestration
  chunker.ts                # Text chunking + tokenization
  document-chunk-storage.ts # Batch chunk insertion
  ai-chat-prompt.ts         # System prompt building
  document-relations.ts     # Reference link resolution + scoring
  /search/
    semantic-searcher.ts    # Hybrid search + RRF fusion
  rag-evals.ts              # Evaluation suite (Recall@K, MRR)

/queries/
  ai.ts                     # Database queries for AI settings

/ai-server.ts              # LLM provider abstraction
  └─ requestAiEmbedding()
  └─ requestAiRerank()
  └─ requestAiTextCompletion()
  └─ requestAiChatCompletionStream()
```

---

## VERSION NOTES

**These docs are current as of:**
- ai-config.ts: Lines 1-259 (all constants + resolveContextLimits)
- ai-chat.ts: Lines 1-2232 (complete)
- schema-ai.ts: Lines 1-311 (all tables)
- All other files: Complete

**Last updated:** [CURRENT]

**Known limitations:**
- MCP (Model Context Protocol) integration documented at high level
- Custom provider API not fully documented (see ai-server.ts)
- Internal helper functions not exhaustively documented

---

## USAGE RIGHTS

These documentation files are for internal development use. They document the existing Kite RAG system implementation. Keep them in sync with code changes.


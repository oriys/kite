# RAG CRITICAL ALGORITHMS & IMPLEMENTATION DETAILS

## 1. SIMILARITY THRESHOLDING (selectRelevantChunks)
**Location:** ai-chat.ts Lines 436-485  
**Purpose:** Filter semantic chunks by relevance while maintaining diversity

### Algorithm
```
Input: chunks (sorted by similarity DESC), embeddingModelId

// Get thresholds
profile = SIMILARITY_PROFILES[embeddingModelId] || defaults
minSimilarity = profile.min (e.g., 0.28 for 3-small)
similarityWindow = profile.window (e.g., 0.12)

// Check top result
topSimilarity = chunks[0].similarity
if topSimilarity < minSimilarity:
  return []  // Reject all

// Dynamic floor
similarityFloor = MAX(minSimilarity, topSimilarity - similarityWindow)

// Filter 1: Similarity threshold
filtered = chunks.filter((chunk, index) =>
  index < 2 || chunk.similarity >= similarityFloor
)

// Filter 2: Document diversity (pass 1)
selected = []
perDocumentCounts = new Map()
for chunk in filtered:
  if selected.length >= MAX_SEMANTIC_CHUNKS: break
  if perDocumentCounts[chunk.documentId] > 0: continue  // Already have one
  selected.push(chunk)
  perDocumentCounts[chunk.documentId] = 1

// Filter 3: Allow more per document (pass 2)
for chunk in filtered:
  if selected.length >= MAX_SEMANTIC_CHUNKS: break
  count = perDocumentCounts[chunk.documentId] ?? 0
  if count >= MAX_SEMANTIC_CHUNKS_PER_DOCUMENT: continue
  if selected.includes(chunk): continue
  selected.push(chunk)
  perDocumentCounts[chunk.documentId] = count + 1

return selected
```

### Example with text-embedding-3-small
```
MIN = 0.28, WINDOW = 0.12
MAX_SEMANTIC_CHUNKS = 10
MAX_CHUNKS_PER_DOC = 3

Results: [
  {chunkId: 'c1', docId: 'd1', similarity: 0.65},  // Top
  {chunkId: 'c2', docId: 'd2', similarity: 0.58},
  {chunkId: 'c3', docId: 'd1', similarity: 0.55},
  {chunkId: 'c4', docId: 'd3', similarity: 0.48},
  {chunkId: 'c5', docId: 'd1', similarity: 0.45},  // Border (0.65 - 0.12 = 0.53)
  {chunkId: 'c6', docId: 'd2', similarity: 0.44},  // Below floor
  ...
]

TopSimilarity = 0.65
Floor = MAX(0.28, 0.65 - 0.12) = 0.53

Pass 1 (< 0.53 excluded except first 2):
[c1(0.65), c2(0.58), c3(0.55), c4(0.48→reject)]

Pass 2 (one per doc):
[c1(d1), c2(d2)]

Pass 3 (allow up to 3 per doc):
[c1(d1), c2(d2), c3(d1)]

Output: 3 chunks, one extra from d1
```

---

## 2. QUERY EXPANSION (buildRetrievalQueries)
**Location:** ai-chat.ts Lines 348-401  
**Purpose:** Generate 1-4 query variants to improve semantic recall

### Algorithm
```
Input: query, rules (CompiledExpansionRule[])
Output: string[] (1-4 variants, sorted by importance)

queries = []
seen = new Set()

addQuery(value):
  trimmed = value.trim().replace(/\s+/g, ' ')
  if !trimmed: return
  key = trimmed.toLowerCase()
  if seen.has(key): return
  seen.add(key)
  queries.push(trimmed)

// Phase 1: Normalize original query
addQuery(query)
addQuery(query.replace(/[_-]+/g, ' '))  // underscores to spaces
addQuery(query.replace(/[\s_-]+/g, ''))  // remove all separators

// Phase 2: Extract English tokens
englishTerms = extractQueryTerms(query).filter(term => /[A-Za-z]/.test(term))
if englishTerms.length > 0:
  addQuery(englishTerms.join(' '))

// Phase 3: HTTP method + path
httpMethodMatch = query.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i)
pathMatch = query.match(/\/[a-z][a-z0-9/_-]*/i)
if httpMethodMatch && pathMatch:
  addQuery(`${httpMethodMatch[1].toUpperCase()} ${pathMatch[0]}`)
else if pathMatch:
  addQuery(pathMatch[0])

// Phase 4: Endpoint pattern
endpointMatch = query.match(/\b(\w+)\s+endpoints?\b/i)
if endpointMatch:
  addQuery(`/${endpointMatch[1].toLowerCase()}`)

// Phase 5: Rule-based expansions
expandedTerms = new Set()
for rule in rules:
  if !rule.regex.test(query): continue
  for expansion in rule.expansions:
    expandedTerms.add(expansion)
    addQuery(expansion)

// Phase 6: Combined expansion query
if expandedTerms.size > 0:
  addQuery([query, ...expandedTerms].join(' '))

return queries.slice(0, MAX_QUERY_VARIANTS)  // 1-4 queries
```

### Example
```
Input: "GET /orders endpoints"
Rules include:
  Pattern: /\b(auth|authentication)\b/i → skip
  Pattern: /\b(pagina)\b/i → expand to ['pagination', 'cursor', 'page', 'offset', 'limit']

Phase 1:
  → "GET /orders endpoints"

Phase 3 (HTTP + path):
  httpMatch = "GET"
  pathMatch = "/orders"
  → "GET /orders"

Phase 4 (endpoint):
  match = "orders"
  → "/orders"

Phase 5 (rules):
  No rules match

Output (first 4):
["GET /orders endpoints", "GET /orders", "/orders", "get /orders endpoints"]
```

---

## 3. CONTEXT COMPRESSION (compressContentForTerms)
**Location:** ai-chat.ts Lines 583-647  
**Purpose:** Reduce section size while preserving relevance

### Algorithm
```
Input:
  content: string
  terms: string[] (query terms)
  maxChars: number
  maxBlocks: number (default 4)
  rules: CompiledExpansionRule[]

Output: compressed string (≤ maxChars)

normalized = content.replace(/\r\n?/g, '\n').trim()
if !normalized: return ''
if normalized.length <= maxChars: return normalized

// Step 1: Split into blocks
blocks = splitIntoContextBlocks(normalized)
if blocks.length === 0:
  return normalized.slice(0, maxChars).trim()

// Step 2: Score blocks
scoredBlocks = blocks.map((block, index) => ({
  block,
  index,
  score: scoreContextBlock(block, terms, query, rules)
}))

// Step 3: Select top blocks (preserve order)
selected = scoredBlocks
  .sort((a, b) => b.score - a.score || a.index - b.index)
  .slice(0, maxBlocks)
  .sort((a, b) => a.index - b.index)

// Step 4: Prepend title if available
if selected[0].index !== 0 && blocks[0] is heading && blocks[0].length < maxChars * 0.25:
  selected.unshift({block: blocks[0], index: 0, score: 1})

// Step 5: Concatenate until limit
text = ''
for item in selected:
  nextText = text ? `${text}\n\n${item.block}` : item.block
  if nextText.length > maxChars: break
  text = nextText

// Step 6: Add ellipsis if truncated
if !text:
  text = selected[0].block.slice(0, maxChars).trim()
if text.length < normalized.length && !text.endsWith('…'):
  text = `${text}…`

return text
```

### Block Scoring (scoreContextBlock)
```
Input: block (string), terms (array), query (string), rules

score = 0

for term in terms.sort((a, b) => b.length - a.length):
  normalizedTerm = term.toLowerCase()
  compactTerm = normalizedTerm.replace(/[\s_-]+/g, '')
  
  if block.includes(normalizedTerm):
    score += block is heading ? 18 : 10
  else if compactTerm && block.compact.includes(compactTerm):
    score += 8

// Query match
if block.includes(query.toLowerCase()):
  score += 20

// Structure bonuses
if block is heading: score += 6
if block has tables: score += 4
if block has code: score += (query has code lang ? 6 : -3)
if block is blockquote: score += 3

// Rule expansions
for rule in rules:
  if !rule.regex.test(query): continue
  for expansion in rule.expansions:
    if block.includes(expansion.toLowerCase()):
      score += rule.scoreBoost
      break

// API pattern bonus
if query matches "接口|api|endpoint" && block matches "请求|响应|参数":
  score += 8

return score
```

### Example
```
Content chunks:
[
  "## Error Codes",
  "The following error codes...",
  "| Code | Message |",
  "| 429 | Rate Limit |",
  "Use 429 for rate limiting.",
]

Terms: ["error", "429"]
Query: "What are error codes?"
MaxChars: 500
MaxBlocks: 2

Scores:
  "## Error Codes" → 6 (heading) + 18 (contains "error") = 24
  "The following..." → 10 (contains "error") = 10
  "| Code |..." → 4 (table) = 4
  "| 429 |..." → 10 (contains "429") = 10
  "Use 429 for..." → 10 (contains "429") = 10

Top 2: "## Error Codes" (24), "| 429 |..." (10)

Output (preserved order):
"## Error Codes

| Code | Message |
| 429 | Rate Limit |"
```

---

## 4. HEURISTIC RERANKING (heuristicRerankContextSections)
**Location:** ai-chat.ts Lines 649-759  
**Purpose:** Order sections by relevance; optionally combine with ML scores

### Algorithm
```
Input:
  query: string
  sections: RetrievedContextSection[]
  rerankScores?: Map<index, mlScore>
  boostDocumentIds?: Set<string>

Output: RetrievedContextSection[] (max MAX_CONTEXT_SECTIONS)

queryTerms = extractQueryTerms(query)
queryUpper = query.toUpperCase()

scored = sections.map((section, index) => {
  title = section.title.toLowerCase()
  content = section.content.toLowerCase()
  heading = extract first h1-h6 from content
  
  let score = section.relationType === 'primary' ? 55 : 28
  let modelScore = rerankScores?.get(index) ?? null
  
  // Recent source boost
  if boostDocumentIds?.has(section.documentId):
    score += BOOST_RECENT_SOURCE_SCORE (15)
  
  // ML score integration (0-80 scale)
  if modelScore !== null:
    values = [...rerankScores.values()]
    mlMin = Math.min(...values)
    mlRange = Math.max(...values) - mlMin || 1
    normalizedScore = (modelScore - mlMin) / mlRange
    score += normalizedScore * 80
  
  // Term matching
  for term in queryTerms:
    normalizedTerm = term.toLowerCase()
    compactTerm = normalizedTerm.replace(/[\s_-]+/g, '')
    
    if heading?.includes(normalizedTerm) || heading?.compact.includes(compactTerm):
      score += 15  // Heading match — strong signal
    
    if title.includes(normalizedTerm) || title.compact.includes(compactTerm):
      score += 18  // Title match
    
    if content.includes(normalizedTerm):
      score += 7   // Content match
  
  // HTTP method match
  httpMethodMatch = queryUpper.match(/\b(GET|POST|PUT|PATCH|DELETE)\b/)
  if httpMethodMatch:
    method = httpMethodMatch[1]
    if section.content.toUpperCase().includes(method) && 
       (heading.toUpperCase().includes(method) || title.toUpperCase().includes(method)):
      score += 12
  
  // Schema name match
  typeNameMatch = query.match(/\b([A-Z][a-zA-Z]+(?:Type|Input|Object|Enum|Schema)?)\b/)
  if typeNameMatch:
    typeName = typeNameMatch[1].toLowerCase()
    if heading.includes(typeName) || title.includes(typeName):
      score += 10
  
  // Code blocks in "how-to" queries
  if /\bhow\s+to\b/i.test(query) && /```/.test(section.content):
    score += 5
  
  return {section, index, score, modelScore}
})

// Sort and select (two passes)
scored.sort((a, b) =>
  b.score - a.score ||
  (b.modelScore ?? -1) - (a.modelScore ?? -1) ||
  a.index - b.index
)

selected = []
perDocumentCount = new Map()

// Pass 1: Prefer primary, max 1 reference per document
for item in scored:
  if selected.length >= MAX_CONTEXT_SECTIONS: break
  count = perDocumentCount.get(item.section.documentId) ?? 0
  if count > 0 && item.section.relationType === 'reference': continue
  if count >= 2: continue
  selected.push(item.section)
  perDocumentCount.set(item.section.documentId, count + 1)

// Pass 2: Allow up to 2 per document
for item in scored:
  if selected.length >= MAX_CONTEXT_SECTIONS: break
  if selected.includes(item.section): continue
  count = perDocumentCount.get(item.section.documentId) ?? 0
  if count >= 2: continue
  selected.push(item.section)
  perDocumentCount.set(item.section.documentId, count + 1)

return selected
```

### Scoring Example
```
Query: "How to implement OAuth authentication?"
Sections:
  1. Title: "OAuth Overview"
     Content: "## Authentication Flow\nOAuth 2.0 is..."
     Type: primary
     
  2. Title: "API Security"
     Content: "Use OAuth or API keys"
     Type: reference
     boostDocumentIds: {docId}

Scoring Section 1:
  Base: 55 (primary)
  Term "oauth" in title: +18
  Term "oauth" in heading: +15
  Term "authentication" in heading: +15
  Term "implement" not found: 0
  → Total: 55 + 18 + 15 + 15 = 103

Scoring Section 2:
  Base: 28 (reference)
  Recent boost: +15
  Term "oauth" in content: +7
  Term "authentication" not found: 0
  → Total: 28 + 15 + 7 = 50

Order: Section 1 (103), Section 2 (50)
```

---

## 5. MERGE SEMANTIC CHUNKS (mergeSemanticChunkResults)
**Location:** ai-chat.ts Lines 403-434  
**Purpose:** Deduplicate chunks from multiple query variants; track cross-variant matches

### Algorithm
```
Input: queryResults (array of array of chunks, one array per query variant)
Output: Array<chunk with queryMatches count>

merged = Map<chunkId, {chunk, queryMatches}>

for queryChunks in queryResults:
  for chunk in queryChunks:
    existing = merged.get(chunk.chunkId)
    
    if !existing:
      merged.set(chunk.chunkId, {
        ...chunk,
        queryMatches: 1
      })
    else:
      existing.queryMatches += 1
      // Keep best similarity
      if chunk.similarity > existing.similarity:
        existing.similarity = chunk.similarity
        existing.chunkText = chunk.chunkText
        existing.chunkIndex = chunk.chunkIndex
        existing.documentTitle = chunk.documentTitle

return [...merged.values()]
  .sort((a, b) =>
    b.similarity - a.similarity ||
    b.queryMatches - a.queryMatches
  )
```

### Example
```
Query Variant 1: "permission access scope"
Results: [c1(sim=0.68), c2(sim=0.55), c3(sim=0.44)]

Query Variant 2: "权限点"
Results: [c1(sim=0.71), c4(sim=0.58)]

Query Variant 3: "AccessScope"
Results: [c1(sim=0.69), c2(sim=0.61), c5(sim=0.47)]

Merged:
  c1: similarity=0.71 (max of 0.68, 0.71, 0.69), queryMatches=3 ← Top
  c2: similarity=0.61 (max of 0.55, 0.61), queryMatches=2
  c4: similarity=0.58, queryMatches=1
  c3: similarity=0.44, queryMatches=1
  c5: similarity=0.47, queryMatches=1

Sorted: [c1(0.71, 3), c2(0.61, 2), c4(0.58, 1), c5(0.47, 1), c3(0.44, 1)]

selectRelevantChunks() would then apply thresholds
```

---

## 6. DOCUMENT CHUNK SPLITTING (splitTextIntoChunks)
**Location:** chunker.ts Lines 192-273  
**Purpose:** Split section into ~500-token chunks with 50-token overlap, respecting boundaries

### Algorithm
```
Input:
  text: string
  targetTokens: number (default 500)
  overlapTokens: number (default 50)

Output: string[] (array of chunks)

charsPerToken = containsCjk(text) ? 2 : 4
targetChars = targetTokens * charsPerToken
overlapChars = overlapTokens * charsPerToken
maxAtomicChars = floor(targetChars * 1.5)

if text.length <= targetChars:
  return text.trim() ? [text.trim()] : []

atomicBlocks = findAtomicBoundaries(text)

chunks = []
start = 0

while start < text.length:
  end = start + targetChars
  
  if end < text.length:
    slice = text.slice(start, end + 100)  // Lookahead
    
    // Try paragraph break
    paragraphBreak = slice.lastIndexOf('\n\n')
    if paragraphBreak > targetChars * 0.5:
      end = start + paragraphBreak + 2
    else:
      // Try sentence break
      sentenceBreak = slice.search(/[.!?。！？]\s/)
      if sentenceBreak > targetChars * 0.5:
        end = start + sentenceBreak + 2
    
    // Adjust for atomic blocks
    end = adjustForAtomicBoundary(start, end)
  else:
    end = text.length
  
  // Validate end > start
  if end <= start:
    end = Math.min(text.length, start + targetChars)
    if end <= start: break
  
  chunk = text.slice(start, end).trim()
  if chunk: chunks.push(chunk)
  
  // Advance with overlap
  nextStart = Math.max(start + 1, end - overlapChars)
  start = nextStart
  if start >= text.length: break

return chunks
```

### Atomic Block Adjustment
```
adjustForAtomicBoundary(start, end):
  for block in atomicBlocks:
    if end > block.start && end < block.end:  // end inside atomic block
      
      if block.end - start <= maxAtomicChars:
        return block.end  // Extend to include entire block
      else:
        if block.start > start:
          return block.start  // Retreat to block start
        else:
          // Super-large block; break at line boundary
          lineBreak = text.lastIndexOf('\n', end)
          if lineBreak > start:
            return lineBreak + 1
  
  return end
```

### Example
```
Text:
  "## Implementation\nHere's how to set up..."  (100 chars)
  "### Step 1\n..."  (50 chars)
  "| Field | Type |"  (50 chars - table/atomic)
  "| id    | int  |"
  "### Step 2\n..."  (150 chars)

targetChars = 500 * 4 = 2000 (no chunking needed if < 2000 chars)

If text = 3000 chars:
  end = 0 + 2000 = 2000
  Look for paragraph break around char 2000
  Adjust if inside table (atomic block)
  end = lineBreak after table = 2050
  
  chunk1 = text[0:2050]
  start = max(1, 2050 - 200) = 1850  // overlap 50 chars
  chunk2 = text[1850:]
```

---

## 7. MULTI-TURN QUERY REWRITE (rewriteQueryOrSkipRetrieval)
**Location:** ai-chat.ts Lines 1989-2054  
**Purpose:** Decide: skip retrieval (reuse sources) OR rewrite query for new retrieval

### Algorithm
```
Input:
  userMessage: string
  recentHistory: HistoryMessageWithSources[]
  provider: {provider, modelId}

Output: {action, query, previousSources}

// No history → always retrieve
if recentHistory.length === 0:
  return {action: 'retrieve', query: userMessage, previousSources: []}

// Extract last assistant message's sources
previousSources = []
for i from recentHistory.length - 1 downto 0:
  msg = recentHistory[i]
  if msg.role === 'assistant' && msg.sources?.length > 0:
    previousSources = msg.sources
    break

// Prepare context for rewrite
historySlice = recentHistory.slice(-MAX_HISTORY_TURNS_FOR_REWRITE * 2)
conversationSnippet = historySlice
  .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 400)}`)
  .join('\n')

// Ask LLM
systemPrompt = '''
You are a search query rewriter for a documentation RAG system.
Given the conversation history and latest user message, decide:
- If follow-up does NOT need new retrieval (e.g., "thanks", "explain more", 
  "再详细说说", or can be answered from provided context), output: SKIP
- Otherwise, output a single standalone search query that resolves pronouns 
  and references from conversation. No explanation, no quotes, just the query.
'''

userPrompt = `Conversation:\n${conversationSnippet}\n\nLatest message: ${userMessage}`

result = await requestAiTextCompletion({
  provider, model: modelId,
  temperature: 0.0,
  systemPrompt,
  userPrompt
})

trimmed = result.trim()

if trimmed.toUpperCase() === 'SKIP':
  return {action: 'skip', query: userMessage, previousSources}

// Sanity checks
if !trimmed || trimmed.length > 500:
  return {action: 'retrieve', query: userMessage, previousSources}

return {action: 'retrieve', query: trimmed, previousSources}
```

### Decision Examples
```
Conversation:
  User: "What are AccessScope permissions?"
  Assistant: [Context about permissions]
  User: "Thanks!"

Decision: SKIP (user satisfied)
Output: {action: 'skip', query: 'Thanks!', previousSources: [...]}

---

Conversation:
  User: "What are AccessScope permissions?"
  Assistant: [Lists 10 permissions]
  User: "Can I use write_products for inventory?"

Decision: RETRIEVE
Rewritten: "Can write_products permission be used for inventory?"
Output: {action: 'retrieve', query: '...', previousSources: [...]}

---

Conversation:
  User: "What's in the API reference?"
  Assistant: [Long list]
  User: "Tell me more about the ones relevant to orders"

Decision: RETRIEVE (needs new context)
Rewritten: "API reference for orders endpoints"
Output: {action: 'retrieve', query: '...', previousSources: [...]}
```

---

## 8. ITERATIVE RETRIEVAL (maybeIterativeRetrieval)
**Location:** ai-chat.ts Lines 1772-1850  
**Purpose:** When initial retrieval sparse, ask LLM for follow-up queries

### Trigger
```
if ENABLE_ITERATIVE_RETRIEVAL === 0: return firstResult
if firstResult.sources.length >= MIN_CONTEXT_SECTIONS_FOR_SKIP (2):
  return firstResult  // Sufficient context
```

### Algorithm
```
Input:
  originalQuery: string
  firstResult: {contextText, sources}
  provider, workspaceId, etc.

Output: {contextText, sources} (merged)

// Summarize what was found
if firstResult.sources.length > 0:
  foundSummary = `Found ${count} section(s): ${titles.join(', ')}`
else:
  foundSummary = 'No relevant sections found.'

// Ask LLM for alternatives
systemPrompt = '''
You are a search query generator for a documentation RAG system.
Initial search returned insufficient results. Generate 1-2 alternative 
search queries that might find relevant documentation. Output one query 
per line, nothing else.
'''

userPrompt = `Original query: ${originalQuery}\n${foundSummary}\n\nSuggest alternative queries:`

result = await requestAiTextCompletion({...})

// Parse follow-up queries
followUpQueries = result
  .split('\n')
  .map(line => line.replace(/^\d+[.)]\s*/, '').trim())
  .filter(line => line.length > 0 && line.length <= 300)
  .slice(0, MAX_ITERATIVE_FOLLOWUP_QUERIES)

if followUpQueries.length === 0:
  return firstResult

// Retrieve in parallel
followUpResults = await Promise.all(
  followUpQueries.map(query =>
    retrieveChatContext({workspaceId, query, ...})
  )
)

// Merge results
seenChunkIds = new Set(firstResult.sources.map(s => s.chunkId))
mergedSources = [...firstResult.sources]
contextParts = [firstResult.contextText]

for followUp in followUpResults:
  for source in followUp.sources:
    if seenChunkIds.has(source.chunkId): continue
    seenChunkIds.add(source.chunkId)
    mergedSources.push(source)
  
  if followUp.contextText:
    contextParts.push(followUp.contextText)

return {
  contextText: contextParts.filter(Boolean).join('\n\n---\n\n'),
  sources: mergedSources
}
```

### Example
```
Original: "metaobject permissions"
FirstResult: sources.length = 1 (sparse)

LLM generates:
  "AccessScope metaobject"
  "元对象权限点"

FollowUp 1 retrieves: 2 new sources
FollowUp 2 retrieves: 1 new source

Final: 4 sources total (1 + 2 + 1)
```

---

## PERFORMANCE CHARACTERISTICS

### Time Complexity (per retrieveChatContext call)
```
Query variants: O(MAX_QUERY_VARIANTS) = O(4)
Semantic search: O(queries × TOP_K_CHUNKS) = O(4 × 15) = O(60)
Keyword search: O(TOP_K_KEYWORD_DOCUMENTS) = O(4)
Neighborhood loading: O(chunks × radius × 2×radius) = O(10 × 3) = O(30)
Block scoring: O(sections × blocks × terms) = O(12 × 4 × 8) = O(384)
Reranking: O(sections × terms) = O(12 × 8) = O(96)
Reference expansion: O(primary_docs × candidates × search_results)
                    = O(4 × 12 × 8) = O(384)

Total: Dominated by reference expansion and block scoring = O(~800)
(But most operations parallelized in AI backend)
```

### Space Complexity
```
Query variants: O(MAX_QUERY_VARIANTS) = O(4)
Semantic results: O(TOP_K_CHUNKS * queries) = O(60)
Merged chunks: O(MAX_SEMANTIC_CHUNKS) = O(10)
Sections: O(MAX_CONTEXT_SECTIONS) = O(12)
Context text: O(MAX_CONTEXT_CHARS) = O(20,000)

Total: O(20,000) — essentially bounded by context limit
```

### Network Calls (Parallelized)
```
PARALLEL BLOCK 1:
  - Resolve embedding provider (1)
  - Generate embeddings (query_variants calls)
  - Resolve settings (1)
  - Resolve providers (1)

SEQUENTIAL BLOCK 2:
  - Query similarity search (query_variants calls)
  - Keyword search (1)

SEQUENTIAL BLOCK 3:
  - Load neighborhoods (1)
  - Load stored relations OR reference search (1-many)

SEQUENTIAL BLOCK 4:
  - Reranker call (optional, 1)

Total: ~15-20 API calls for full pipeline (many parallelized)
```


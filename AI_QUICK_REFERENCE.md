# AI Chat System — Quick Reference Guide

## Core Entry Point

```typescript
// lib/ai-chat.ts line 2273
streamChatResponse(input: {
  workspaceId: string
  sessionId: string
  userMessage: string
  documentId?: string
  model?: string
  userId?: string
  role?: MemberRole
  ragMode?: 'hybrid' | 'mix' | 'global' | 'local' | 'naive'
  mcpPrompt?: { serverId: string; name: string; arguments?: Record<string, string> }
}): Promise<{
  stream: ReadableStream<Uint8Array>
  model: string
  sources: ChatSource[]
  attributionPromise: Promise<ChatMessageAttribution | undefined>
}>
```

**Usage from API** (app/api/ai/chat/route.ts):
```typescript
const { stream, sources, attributionPromise } = await streamChatResponse({
  workspaceId: result.ctx.workspaceId,
  sessionId: activeSessionId,
  userMessage: message,
  documentId,
  model,
  userId: result.ctx.userId,
  role: result.ctx.role,
  ragMode,
  mcpPrompt
})
```

---

## 8-Step Chat Pipeline

### Step 1: Load History
- `getChatHistory(sessionId)` → Array<{role, content, sources, attribution}>
- Limited to `MAX_HISTORY_MESSAGES` (default: 20)
- Preserves source metadata for boost scoring

### Step 2: Resolve Providers & Settings (Parallel)
- `resolveWorkspaceAiProviders(workspaceId)` → Provider[]
- `getAiWorkspaceSettings(workspaceId)` → Settings
- `resolveWorkspaceMcpToolSet(workspaceId)` → ToolSet | undefined
- `resolveMcpPromptMessages(workspaceId, mcpPrompt)` → Messages[] | undefined

### Step 3: Pick Model
- `resolveAiModelSelection()` → {provider, modelId}
- Respects: user request → workspace default → any enabled
- Throws if none configured

### Step 4: Query Rewrite or Skip
- `rewriteQueryOrSkipRetrieval()` → {action: 'retrieve'|'skip', query, previousSources}
- Asks LLM: "Does follow-up need new retrieval?"
- Skip for: "thanks", "explain more", context-only questions

### Step 5: Boost Document IDs
- Extract document IDs from recent assistant messages' sources
- Use in reranking stage (bias recent documents)

### Step 6: Retrieve Context (10-Stage Sub-Pipeline)

#### 6a. Query Variant Generation
```
Original: "how to authenticate?"
Variants:
  - "how to authenticate" (normalized)
  - "howtauthenticate" (compact)
  - Applied rules (e.g., "API endpoint" → "/endpoint")
```
Limit: `MAX_QUERY_VARIANTS` (4)

#### 6b. Parallel Semantic Search (per variant)
- `searchSimilarChunks()` → {hits, embeddingModelId}
- Vector similarity in `document_chunks` table
- Filters by visibility (owner/admin → all; member → public+partner+own+explicit)
- Deduplicates by chunkId, keeps highest similarity
- Similarity floor: max(topSimilarity - WINDOW, MIN_SIMILARITY) OR top 2
- Returns: `MAX_SEMANTIC_CHUNKS` (10), `MAX_SEMANTIC_CHUNKS_PER_DOCUMENT` (3)

#### 6c. Parallel Keyword Search
- `searchKeywordDocuments()` → RetrievedContextSection[]
- CJK: ILIKE pattern matching
- English: PostgreSQL full-text search
- Snippets: `MAX_KEYWORD_SNIPPET_CHARS` (1,600)

#### 6d. Neighborhood Expansion
- Load adjacent chunks: ± `ADJACENT_CHUNK_RADIUS` (1)
- Merge into unified context
- Compress via `compressContentForTerms()`

#### 6e. Knowledge Graph Retrieval (Parallel)
- `retrieveKgContext()` → {entityContext, relationContext, counts}
- Mode-dependent: 'hybrid'→entities; 'mix'/'global'→relations
- Token-budgeted: `maxEntityTokens`, `maxRelationTokens`

#### 6f. Build Semantic Sections
- Chunks + neighborhoods → RetrievedContextSection[]
- Each: {source: ChatSource, content: string}
- Apply term-based compression

#### 6g. Merge Keyword Documents
- Add keyword-only snippets (if not in semantic results)

#### 6h. Reference Expansion
- If mode === 'hybrid': expand related documents
- Extract from primary docs: Markdown links, inline URLs
- Search by URL + title/content match
- Limit: `MAX_RELATED_DOCUMENTS` (5)

#### 6i. Reranking
- **Heuristic**: Primary vs ref boost, term match, HTTP methods, code blocks, recency
- **Model** (optional): Call reranker endpoint if configured
- Combine scores; enforce: `MAX_CONTEXT_SECTIONS` (12), max 2 per doc

#### 6j. Final Assembly
- KG context → sections (labeled [1], [2], etc.)
- Enforce: `MAX_CONTEXT_CHARS` (20K), `MAX_CONTEXT_TOKENS` (120K model-tuned)
- Binary search for token cutoff
- Return: {contextText, sources: ChatSource[]}

#### 6k. Caching & Optional Diagnostics
- Cache with TTL: `RAG_QUERY_CONTEXT_CACHE_TTL_SECONDS` (300)
- If debug: return detailed timings + selections

### Step 7: Grounding Check
- Verify at least ONE of:
  - Documentation context retrieved
  - MCP tools available
  - MCP prompt messages provided
- If none AND not skip-with-previous: return "no context" error

### Step 8: Stream Response with Tool Calling
- `requestAiChatCompletionStream()` → {stream, model, attributionPromise}
- System prompt = base + (documentation context if available)
- Messages = MCP prompts + history + current message
- **Tools**: Pass ToolSet if MCP tools available
- **maxSteps**: `MAX_MCP_TOOL_STEPS` (10) — enables multi-step tool calling
- Collects tool names via `collectMcpToolNamesFromSteps()`
- Tee stream: browser copy + background persistence copy
- Attribution: {usedMcp: bool, mcpToolNames: string[]}

---

## Key Data Structures

### ChatSource (per context section)
```typescript
{
  documentId: string              // For dedup + boost
  documentSlug?: string
  chunkId: string                 // Unique; for dedup
  title: string                   // Section title
  preview: string                 // First 150 chars
  relationType?: 'primary' | 'reference'
  relationDescription?: string    // "Referenced by X via Y"
}
```

### ChatMessageAttribution
```typescript
{
  usedMcp: boolean
  mcpToolNames: string[]          // Exact tools called
}
```

### ContextLimits (model-dependent)
```typescript
{
  maxContextChars: number
  maxContextTokens: number        // 120K for GPT-4, varies by model
  maxSectionChars: number
  maxSectionTokens: number
  maxEntityTokens: number
  maxRelationTokens: number
  adjacentChunkRadius: number
}
```

---

## Session & Message Management

### Create Session
```typescript
createChatSession({
  workspaceId: string
  userId: string
  documentId?: string
  title?: string
})
```

### Get History
```typescript
getChatHistory(sessionId: string)
// → Array<{id, role, content, sources?, attribution?, createdAt}>
```

### Save Message
```typescript
saveChatMessage({
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: ChatSource[]
  attribution?: ChatMessageAttribution
})
```

---

## MCP Tool Integration

### Tool Discovery
```typescript
resolveWorkspaceMcpToolSet(workspaceId)
// → ToolSet | undefined (Vercel AI SDK format)

// Each tool:
// {
//   prefix__toolName: {
//     description: string
//     inputSchema: JSONSchema
//     execute: async (args) => result
//   }
// }
```

### Tool Execution
- Automatic via Vercel AI SDK when tools + maxSteps provided
- LLM calls tools, receives results, calls more tools
- Loop runs up to `maxSteps` (default: 10)

### Tool Limits
- `MAX_MCP_TOOLS_PER_REQUEST`: 50
- `MAX_MCP_TOOL_STEPS`: 10

---

## Configuration Tuning

### Context Limits
```
TOP_K_CHUNKS = 15                        // Initial fetch
MAX_SEMANTIC_CHUNKS = 10                 // Final selection
MAX_SEMANTIC_CHUNKS_PER_DOCUMENT = 3     // Per-doc cap
MAX_CONTEXT_SECTIONS = 12                // Numbered sections
MAX_CONTEXT_CHARS = 20,000
MAX_SECTION_CHARS = 2,500
ADJACENT_CHUNK_RADIUS = 1                // ±1 chunks
```

### Similarity
```
MIN_VECTOR_SIMILARITY = 0.5 (Anthropic) / 0.6 (others)
VECTOR_SIMILARITY_WINDOW = 0.25
BOOST_RECENT_SOURCE_SCORE = 20           // P2 optimization
```

### Conversation
```
MAX_HISTORY_MESSAGES = 20                // Turns to retain
MAX_HISTORY_TURNS_FOR_REWRITE = 5        // For query rewriting
```

### RAG Modes
```
'hybrid'    → semantic + KG entities + reference expansion + rerank
'mix'       → semantic + KG relations + rerank
'global'    → semantic + KG relations
'local'     → semantic + KG entities
'naive'     → semantic only (no KG)
```

### Caching
```
RAG_QUERY_CONTEXT_CACHE_TTL_SECONDS = 300        // 5 min
RAG_KEYWORD_CACHE_TTL_SECONDS = 86,400           // 24 hr
MCP connection cache: 5 min TTL, max 50 entries
```

### Temperatures
```
TEMPERATURE_CHAT = 0.7
TEMPERATURE_QUERY_REWRITE = 0.3
TEMPERATURE_DOC_GEN = 0.5
```

---

## API Endpoint

### POST /api/ai/chat

**Request**:
```json
{
  "message": "How do I authenticate?",
  "sessionId": "sess-123",
  "documentId": "doc-456",
  "model": "gpt-4",
  "ragMode": "hybrid",
  "mcpPrompt": {
    "serverId": "mcp-1",
    "name": "current_status"
  }
}
```

**Response (Streaming)**:
```
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
x-ai-chat-session: sess-123
x-ai-chat-sources: W3siZG9jdW1...

[streaming text content]
```

**Sources Header** (base64-decoded):
```json
[
  {
    "documentId": "doc-456",
    "chunkId": "chunk-789",
    "title": "Authentication",
    "preview": "Bearer token authentication...",
    "relationType": "primary"
  }
]
```

---

## Error Handling

### No Context
- If no RAG context AND no MCP tools AND no MCP prompts
- Returns: "I could not find enough information..." (CJK or English)

### Model Not Configured
- Throws: "No AI model configured."

### API Key Missing
- Throws: "This AI provider is missing an API key." (503)

### Provider Error
- Throws: AiCompletionError with status 502

---

## Performance Notes

### Parallel Operations
- Semantic + keyword + KG extraction (all parallel)
- All MCP server connections (parallel)
- Provider/settings resolution (parallel)

### Caching
- Query context cache: 5 min (configurable)
- MCP connection cache: 5 min
- Query expansion rules: 60 sec in-memory

### Background Persistence
- Stream teeing: immediate response + background save
- No blocking on message persistence

---

## Example: Custom Agent Layer

To build a multi-step agent:

```typescript
// 1. Wrap streamChatResponse
const chatResponse = await streamChatResponse({...})

// 2. Collect stream with step tracking
const steps = []
for await (const chunk of chatResponse.stream) {
  steps.push(chunk)
}

// 3. Check attribution for tool usage
const attribution = await chatResponse.attributionPromise
if (attribution?.usedMcp) {
  // Tools were called — could trigger follow-up retrieval
}

// 4. Save step-by-step breakdown
await saveAgentSteps({
  sessionId,
  steps: attribution?.mcpToolNames || [],
  finalText: concatenate(steps)
})
```

---

## File Locations

| Purpose | File | Key Functions |
|---------|------|---------------|
| Core engine | lib/ai-chat.ts | `streamChatResponse()`, `retrieveChatContext()` |
| System prompts | lib/ai-chat-prompt.ts | `buildChatSystemPrompt()` |
| AI requests | lib/ai-server-sdk.ts | `requestAiChatCompletionStream()`, `requestAiRerank()` |
| API endpoint | app/api/ai/chat/route.ts | POST handler |
| MCP tools | lib/mcp-tools.ts | `resolveWorkspaceMcpToolSet()` |
| MCP client | lib/mcp-client.ts | `executeMcpToolCall()`, `getMcpPrompt()` |
| Config | lib/ai-config.ts | All constants |
| Database | lib/schema-ai.ts | Tables: aiChatSessions, aiChatMessages, documentChunks |


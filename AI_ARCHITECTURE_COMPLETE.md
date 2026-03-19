# Kite AI Chat System Architecture — Complete Deep Dive

## Executive Summary

Kite has a **sophisticated, production-grade AI chat system** built on top of the **Vercel AI SDK** with:

- **Advanced RAG** (Retrieval-Augmented Generation) with multi-modal retrieval: semantic (embedding-based) + keyword + knowledge graph
- **MCP Tool Integration** (Model Context Protocol) for external tool calling
- **Multi-turn conversation** with query rewriting and iterative retrieval
- **Streaming responses** with source attribution
- **Session persistence** with conversation history
- **Multi-provider support** (OpenAI-compatible, Anthropic, Gemini)
- **Partial agent capabilities** through MCP tool calling (maxSteps configurable, currently supports multi-step tool use)

---

## 1. lib/ai-chat.ts — Core RAG Chat Engine (2,450 lines)

### Main Entry Point

**Function: `streamChatResponse(input)`**
- **Location**: Lines 2273–2450
- **Signature**:
```typescript
export async function streamChatResponse(input: {
  workspaceId: string
  sessionId: string
  userMessage: string
  documentId?: string
  model?: string
  userId?: string
  role?: MemberRole
  ragMode?: RagQueryMode
  mcpPrompt?: { serverId: string; name: string; arguments?: Record<string, string> }
}): Promise<{
  stream: ReadableStream<Uint8Array>
  model: string
  sources: ChatSource[]
  attributionPromise: Promise<ChatMessageAttribution | undefined>
}>
```

### Core Pipeline (8-Step Process)

1. **Load Chat History** (Line 2288)
   - Retrieves full conversation for context
   - Preserves `sources` metadata on each message for P1/P2 boost
   - Limits to `MAX_HISTORY_MESSAGES` (default: 20)

2. **Resolve Providers, Settings & MCP** (Lines 2310–2317) — *Parallel*
   - `resolveWorkspaceAiProviders()`: Gets all enabled AI providers
   - `getAiWorkspaceSettings()`: Workspace AI config (default model, enabled models, embedding model, etc.)
   - `resolveWorkspaceMcpToolSet()`: Connects to all enabled MCP servers, lists tools/resources
   - `resolveMcpPromptMessages()`: If MCP prompt provided, retrieves pre-crafted prompt messages

3. **Resolve Model Selection** (Lines 2320–2334)
   - Uses `resolveAiModelSelection()` to pick chat model (user requested → default → any enabled)
   - Throws if no model configured

4. **Query Rewrite or Retrieval Skip** (Lines 2336–2341)
   - Calls `rewriteQueryOrSkipRetrieval()` (Lines 2204–2269)
   - **Logic**:
     - If no history: retrieve with original query
     - If history exists, ask LLM: "Does the follow-up need NEW retrieval?"
     - Returns `{ action: 'retrieve' | 'skip', query: string, previousSources: ChatSource[] }`
     - Examples of skip: "thanks", "explain more", greetings — can be answered from prior context

5. **Collect Boost Document IDs** (Lines 2343–2351)
   - Scans recent assistant messages for `sources`
   - Adds their document IDs to a boost set (used for reranking in next retrieval)
   - **P2 optimization**: Recent sources get scoring boost in reranking

6. **Branch: Skip or Retrieve** (Lines 2353–2387)
   - **Skip path**: Reuse previous sources, no new retrieval
   - **Retrieve path**:
     - Calls `retrieveChatContext()` (Lines 1649–1960) for first retrieval
     - Optionally calls `maybeIterativeRetrieval()` (Lines 1984–2065) if enabled:
       - Checks if first result has enough sections
       - If sparse: asks LLM for follow-up queries
       - Runs follow-up retrievals in parallel
       - Merges results (deduplicates by chunkId)

7. **Grounding Check** (Lines 2389–2414)
   - Verifies system has at least one grounding source:
     - Documentation context (RAG retrieved)
     - MCP tools available
     - MCP prompt messages provided
   - If NO grounding AND not in skip-with-previous-sources: return "no context" error message

8. **Stream Response with MCP Tool Calling** (Lines 2416–2450)
   - Calls `requestAiChatCompletionStream()` via AI SDK
   - Passes:
     - System prompt (built dynamically with documentation context)
     - Message history + current user message
     - MCP tools (if available)
     - `maxSteps: mcpTools ? MAX_MCP_TOOL_STEPS : undefined`
   - **Returns**: ReadableStream<Uint8Array> + attribution promise
   - Attribution tracks MCP tool names used (via `collectMcpToolNamesFromSteps`)
   - **Persist in background**: stream is teeed; one copy sent to browser, one collected + saved

### RAG Context Retrieval: `retrieveChatContext()` (Lines 1649–1960)

**Comprehensive multi-stage retrieval**:

#### Stage 1: Setup & Caching (Lines 1659–1714)
- Resolve context limits (model-aware token budgets)
- Load query expansion rules (workspace-specific, cached 60s)
- Resolve RAG query mode (hybrid/mix/global/local/naive)
- Check **RAG query context cache** (5-minute TTL by default)
- Return cached result if hit

#### Stage 2: Parallel Semantic + Keyword Search (Lines 1725–1776)
- **Query variant generation** (Lines 365–418):
  - Original query
  - Variants with separators normalized: `foo-bar` → `foo bar` → `foobar`
  - English token extraction (for API queries: extract `GET /users`)
  - Applied rules: e.g., "API endpoint" → search for `/endpoint`
  - Limited to `MAX_QUERY_VARIANTS` (default: 4)
  
- **Semantic search** (Lines 1737–1753):
  - For each query variant: call `searchSimilarChunks()` (Lines 251–321)
    - Gets embeddings for query
    - Vector similarity search in `document_chunks` table
    - Filters by visibility (admins see all; members see public + partner + own + explicit perms)
    - Merges results, deduplicates by chunkId, keeps highest similarity
    - Applies similarity floor: `similarity >= (topSimilarity - VECTOR_SIMILARITY_WINDOW)` OR in top 2
    - Limits: `MAX_SEMANTIC_CHUNKS` (default: 10), `MAX_SEMANTIC_CHUNKS_PER_DOCUMENT` (default: 3)

- **Keyword search** (Lines 1762–1774):
  - Uses `searchKeywordDocuments()` (Lines 1457–1561)
  - For CJK queries: ILIKE pattern matching
  - For English: PostgreSQL full-text search (`plainto_tsquery`)
  - Returns snippets compressed to `MAX_KEYWORD_SNIPPET_CHARS` (default: 1,600)

- **KG keyword extraction** (Lines 1726–1734):
  - Runs in parallel with retrieval (promise-based)
  - Extracts high-level and low-level keywords for knowledge graph retrieval

#### Stage 3: Neighborhood Expansion (Lines 1809–1822)
- For each semantic chunk, loads adjacent chunks (`ADJACENT_CHUNK_RADIUS`, default: 1)
- Creates unified context with neighboring chunks
- Compression applied: `compressContentForTerms()` (Lines 600–664)

#### Stage 4: Semantic Sections Build (Lines 1824–1829)
- Combines chunks + neighborhoods into `RetrievedContextSection[]`
- Each has `source: ChatSource` + `content: string`
- Applies content compression to term-based relevance

#### Stage 5: Keyword Documents Merge (Lines 1835–1838)
- Adds keyword-only document snippets (if not already in semantic results)

#### Stage 6: Knowledge Graph Retrieval (Lines 1779–1807)
- Calls `retrieveKgContext()` (from kg-retrieval module)
- Extracts entity and relation context (token-budgeted)
- Mode-dependent: 'hybrid' includes entities; 'mix'/'global' includes relations

#### Stage 7: Reference Expansion (Lines 1840–1876)
- If mode === 'hybrid': expands related documents
- Extracts reference candidates from primary documents:
  - Markdown links: `[label](url)`
  - Inline URLs matching shopline domain
- Searches for referenced documents by:
  - URL matching (normalized)
  - Title/content matching on extracted terms
- Limits: `MAX_RELATED_DOCUMENTS` (default: 5)

#### Stage 8: Reranking (Lines 1884–1893)
- **Heuristic + Optional Model Reranking**:
  - Heuristic scoring (Lines 556–598, 666–776):
    - Primary vs. reference source score boost
    - Query term matching (title, content, headings)
    - HTTP method / schema name extraction
    - Code block scoring (higher for "how to" queries)
    - Document recency boost
  - If reranker configured: calls `requestAiRerank()` via reranker endpoint
  - Combines heuristic + ML scores
  - Enforces limits: `MAX_CONTEXT_SECTIONS` (default: 12), max 2 per document

#### Stage 9: Final Context Assembly (Lines 1895–1898)
- Calls `buildContextFromSections()` (Lines 1563–1647):
  - KG context prepended (entities, then relations)
  - Sections built into labeled blocks: `[1] Primary document`, `[2] Related document`
  - Enforces `MAX_CONTEXT_CHARS` (20,000) and `MAX_CONTEXT_TOKENS`
  - Binary search for section cutoff when token limit exceeded
  - Returns `{ contextText: string, sources: ChatSource[] }`

#### Stage 10: Caching & Diagnostics (Lines 1901–1959)
- Caches result with TTL (5 min default)
- If debug=true: returns detailed diagnostics:
  - Query variants tried
  - Semantic/keyword/KG timing
  - Entity/relation counts
  - Rerank scores
  - Selected sections

### Multi-Turn RAG Features

#### Query Rewrite: `rewriteQueryOrSkipRetrieval()` (Lines 2204–2269)
- **Purpose**: Resolve pronouns, avoid redundant retrieval
- **Prompt to LLM**:
  - Recent conversation history (last N turns, each truncated to 400 chars)
  - Latest user message
  - "Do you need new retrieval or can you answer from context?"
- **Output**: `SKIP` or standalone rewritten query
- **Fallback**: If LLM fails or returns empty, fall back to original query

#### Iterative Retrieval: `maybeIterativeRetrieval()` (Lines 1984–2065)
- **Trigger**: First retrieval returns < `MIN_CONTEXT_SECTIONS_FOR_SKIP` sections AND `ENABLE_ITERATIVE_RETRIEVAL` > 0
- **Process**:
  1. Ask LLM: "First search found N results. Suggest 1-2 alternative queries."
  2. Run follow-up retrievals in parallel
  3. Merge: deduplicate by chunkId, concatenate context
- **Disabled by default** (`ENABLE_ITERATIVE_RETRIEVAL = 0`)

### Session & Message Persistence

**Chat Sessions** (Lines 2079–2120):
```typescript
export async function createChatSession(input: {
  workspaceId: string
  userId: string
  documentId?: string
  title?: string
}): Promise<ChatSession>

export async function listChatSessions(input: {
  workspaceId: string
  userId: string
  limit?: number
}): Promise<ChatSession[]>
```

**Chat History** (Lines 2122–2140):
```typescript
export async function getChatHistory(sessionId: string): Promise<Array<{
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: ChatSource[]
  attribution?: ChatMessageAttribution
  createdAt: Date
}>>
```

**Save Message** (Lines 2142–2167):
```typescript
export async function saveChatMessage(input: {
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: ChatSource[]
  attribution?: ChatMessageAttribution
}): Promise<void>
```

### Key Data Structures

#### ChatSource
```typescript
interface ChatSource {
  documentId: string
  documentSlug?: string | null
  chunkId: string                           // Unique chunk ID for dedup
  title: string
  preview: string                           // First 150 chars
  relationType?: 'primary' | 'reference'
  relationDescription?: string              // e.g., "Referenced by X via link Y"
}
```

#### ChatMessageAttribution
```typescript
interface ChatMessageAttribution {
  usedMcp: boolean
  mcpToolNames: string[]                    // Exact tool names called during response
}
```

#### RetrievalDiagnostics
- Query variants tried
- Timings (semantic/keyword/neighborhood/rerank/reference/kg in ms)
- KG results (entity/relation counts, keywords)
- Semantic chunks details
- Keyword documents matched
- Rerank scores
- Final selected sections
- Cache hit flag

### Configuration Constants (ai-config.ts excerpt)

```
Top-K:
  TOP_K_CHUNKS = 15
  TOP_K_KEYWORD_DOCUMENTS = 4
  MAX_QUERY_VARIANTS = 4

Context Limits:
  MAX_CONTEXT_CHARS = 20,000
  MAX_CONTEXT_SECTIONS = 12
  MAX_SECTION_CHARS = 2,500
  MAX_COMPRESSED_BLOCKS = 4
  MAX_CONTEXT_TOKENS = 120,000 (model-dependent)

Semantic Chunks:
  MAX_SEMANTIC_CHUNKS = 10
  MAX_SEMANTIC_CHUNKS_PER_DOCUMENT = 3
  ADJACENT_CHUNK_RADIUS = 1

Similarity:
  MIN_VECTOR_SIMILARITY = 0.5 (Anthropic) / 0.6 (others)
  VECTOR_SIMILARITY_WINDOW = 0.25
  BOOST_RECENT_SOURCE_SCORE = 20

Conversation:
  MAX_HISTORY_MESSAGES = 20
  MAX_HISTORY_TURNS_FOR_REWRITE = 5

Query Rewriting:
  TEMPERATURE_QUERY_REWRITE = 0.3

MCP:
  MAX_MCP_TOOL_STEPS = 10
  MAX_MCP_TOOLS_PER_REQUEST = 50
```

---

## 2. lib/ai-chat-prompt.ts — System Prompts & Context Injection (47 lines)

### Main Prompt

**CHAT_SYSTEM_PROMPT** (Lines 1–14):
```
"You are a knowledgeable assistant for an API documentation workspace.
Use the workspace documentation context and any enabled MCP tools or 
MCP-provided context in the conversation as your only sources of truth.
When documentation context is provided, cite documentation facts using [1], 
[2], etc. notation matching the context labels.
Some context sections are primary matches, while others are explicitly 
related documents referenced by those primary matches.
Use primary matches as the main evidence, and use related documents as supporting context.
If a related document conflicts with a primary match, call out the conflict and cite both sources.
When MCP tools are available, use them to retrieve current, operational, or missing 
details that are not fully covered by the documentation context.
Combine documentation context and MCP results when both are relevant, and 
call out any mismatch between them.
If neither the documentation context nor MCP results contain enough information to answer, 
say so clearly rather than guessing.
Do not fill gaps with general knowledge or unsupported assumptions.
Be concise and direct. Use markdown formatting for code, lists, and emphasis.
Use the same language as the user's question."
```

### Prompt Builder

**`buildChatSystemPrompt(input)`** (Lines 28–46):
- Takes `{ documentationContext?: string, hasMcpTools: boolean, hasMcpPromptMessages: boolean }`
- **If** `documentationContext` provided: appends it under "---\nDocumentation context:\n\n{contextText}"
- **Else if** MCP tools/prompts available: adds disclaimer "No workspace documentation context. Use any enabled MCP tools..."
- Returns final system prompt

### Grounding Check

**`hasChatGrounding(input)`** (Lines 16–26):
- Returns true if ANY of:
  - `hasDocumentationContext` (RAG retrieved something)
  - `hasMcpTools` (MCP server connected)
  - `hasMcpPromptMessages` (MCP prompt available)
- Used to reject responses without grounding

---

## 3. lib/ai-server-sdk.ts — AI Provider Layer (396 lines)

### Language Model Creation

**`createLanguageModel(provider, modelId)`** (Lines 26–55):
- Supports:
  - OpenAI-compatible (baseURL + apiKey)
  - Anthropic
  - Gemini (normalizes model ID)
- Creates instance via `@ai-sdk/[provider]`
- Returns Vercel AI SDK `LanguageModel`

### Core Request Functions

#### `requestAiTextCompletion(input)` (Lines 86–119)
```typescript
input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  userPrompt: string
  model: string
  temperature?: number
}
returns: { result: string; model: string }
```
- Single-shot text completion (not streaming)
- Used for query rewriting, alternative query generation

#### `requestAiTextCompletionStream(input)` (Lines 121–165)
- Streaming variant (returns ReadableStream<Uint8Array>)
- Used for documentation generation

#### `requestAiEmbedding(input)` (Lines 167–195)
```typescript
input: {
  provider: ResolvedAiProviderConfig
  texts: string[]
  model: string
  abortSignal?: AbortSignal
}
returns: { embeddings: number[][] }
```
- Batch embedding for chunks
- Supports OpenAI-compatible, Gemini
- **Anthropic NOT supported** for embeddings

#### `requestAiRerank(input)` (Lines 197–281)
```typescript
input: {
  provider: ResolvedAiProviderConfig
  model: string
  query: string
  documents: string[]
  topN?: number
}
returns: { results: Array<{ index: number; relevanceScore: number }> }
```
- Calls `{baseUrl}/rerank` endpoint (OpenAI-compatible only)
- Handles both `/results` and `/data` response formats
- Returns relevance scores for document ranking

#### `requestAiChatCompletionStream(input)` (Lines 283–377)
```typescript
input: {
  provider: ResolvedAiProviderConfig
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  model: string
  temperature?: number
  tools?: ToolSet                    // Vercel AI SDK ToolSet
  maxSteps?: number                  // Multi-step tool use
}
returns: {
  stream: ReadableStream<Uint8Array>
  model: string
  attributionPromise: Promise<ChatMessageAttribution | undefined>
}
```
- **Streaming chat with optional tool calling**
- Collects tool names from `onStepFinish` and `onFinish` callbacks
- Returns attribution tracking MCP tool usage
- **Tool-aware**: Can call multiple tools in sequence (maxSteps)

---

## 4. app/api/ai/chat/route.ts — Chat API Endpoint (155 lines)

### Request Format

**POST /api/ai/chat**
```typescript
{
  message: string              // User message (required if not resume)
  resume?: boolean             // Continue previous reply (alt to message)
  sessionId?: string          // Existing session (optional; creates if missing)
  documentId?: string         // Scoped to doc (optional)
  model?: string              // Override default model (optional)
  ragMode?: RagQueryMode      // 'hybrid' | 'mix' | 'global' | 'local' | 'naive'
  mcpPrompt?: {               // MCP prompt to inject (optional)
    serverId: string
    name: string
    arguments?: Record<string, string>
  }
}
```

### Response Format

**200 OK**: Streaming response
- **Headers**:
  - `content-type: text/plain; charset=utf-8`
  - `x-ai-chat-session: {sessionId}`  (new or provided)
  - `x-ai-chat-sources: {base64-encoded JSON of ChatSource[]}`
- **Body**: Plain text stream (UTF-8)

**Error Responses**:
- `400`: Invalid request (missing message, message too long, invalid JSON)
- `502`/`503`: AI provider error

### Processing Steps (Lines 18–136)

1. Parse & validate request
2. Validate message length ≤ 4,000 chars
3. Create or reuse session
4. Save user message (if not resume)
5. Call `streamChatResponse()` to get stream
6. Tee stream (one copy to browser, one to persist)
7. Start background task:
   - Collect full stream text
   - Wait for attribution promise
   - Save assistant message + sources + attribution
8. Return streaming response

### Background Persistence

- Doesn't block response
- Errors logged but not returned to client
- Full message text collected before saving (via `collectStreamText()`)

---

## 5. lib/mcp-tools.ts — MCP Tool Integration (173 lines)

### MCP Tool Discovery & Setup

**`resolveWorkspaceMcpToolSet(workspaceId)`** (Lines 125–172):
1. List all enabled MCP server configs
2. For each config, connect (with 5-min connection cache)
3. Call `listMcpServerTools()` and `listMcpServerResources()` in parallel
4. Build `ToolSet` (Vercel AI SDK format):
   - Each tool namespaced: `{prefix}__tool_name`
   - Tool name sanitized (alphanumeric + underscores)
5. Add resource-browsing synthetic tools:
   - `{prefix}__list_resources`: Returns list of available resource URIs
   - `{prefix}__read_resource`: Takes URI, returns content
6. Enforce `MAX_MCP_TOOLS_PER_REQUEST` (50) limit
7. Return combined `ToolSet` or `undefined` if no tools

### Tool Execution

**`createMcpToolEntry(config, mcpTool)`** (Lines 28–47):
- Creates Vercel AI SDK tool object:
  - `description`: From MCP tool definition
  - `inputSchema`: Zod schema from MCP tool's JSON schema
  - `execute`: Async function that calls `executeMcpToolCall()`
- Error handling: Returns `[Tool error] {error}` string if execution fails

### Resource Browsing

- Resources exposed as synthetic tools so AI can choose when to read
- Avoids bloating every request with resource data
- Supports text resources (binary rejected)
- Enforces `MAX_MCP_RESOURCE_SIZE_BYTES` size limit

### Connection Management (Lines 20–79)

- Cache with 5-minute TTL
- Max 50 cached connections (FIFO eviction)
- Updates config version in cache key (invalidates on config change)

---

## 6. lib/mcp-client.ts — MCP Protocol Client (400 lines)

### Connection & Transport

**Supported Transports**:
1. **stdio**: Local process (command + args)
2. **SSE**: Server-Sent Events HTTP
3. **Streamable HTTP**: Long-polling HTTP

**`connectToServer(config)`** (Lines 129–151):
- Lazy connection with caching
- Timeout: `MCP_CONNECTION_TIMEOUT_MS` (default: 5000)
- Reuses cached connection for same config

### Tool Execution

**`listMcpServerTools(config)`** (Lines 163–183):
- Calls `client.listTools()`
- Timeout: `MCP_TOOL_CALL_TIMEOUT_MS` (default: 10000)
- Returns: `Array<{ name, description, inputSchema }>`

**`executeMcpToolCall(config, toolName, args)`** (Lines 185–206):
- Calls `client.callTool()`
- Timeout: `MCP_TOOL_CALL_TIMEOUT_MS`
- Returns: `{ content: unknown; isError: boolean }`

### Prompt Support

**`getMcpPrompt(config, name, args?)`** (Lines 306–335):
- Calls `client.getPrompt(name, arguments)`
- Converts various content formats to plain text
- Returns: `{ description, messages: Array<{ role, content }> }`

### Resource Support

**`listMcpServerResources(config)`** (Lines 348–364):
- Returns: `Array<{ uri, name, description, mimeType }>`

**`readMcpResource(config, uri)`** (Lines 366–399):
- Retrieves resource content
- Text-only (rejects binary)
- Size limit: `MAX_MCP_RESOURCE_SIZE_BYTES` (default: 10 MB)

---

## 7. lib/ai-doc-generator.ts — Documentation Generation (250 lines)

### Single Endpoint Generation

**`generateEndpointDoc(input)`** (Lines 42–82):
```typescript
input: {
  workspaceId: string
  endpoint: ParsedEndpoint
  apiTitle?: string
  apiVersion?: string | null
  servers?: ParsedServer[]
  securitySchemes?: Record<string, ParsedSecurityScheme>
  model?: string
}
returns: GenerateEndpointDocResult {
  title: string
  content: string
  model: string
}
```

- Single-shot LLM call via `requestAiTextCompletion()`
- Resolves doc generation model (via `resolveDocGenerationSelection()`)
- System prompt: Expert API documentation writer
- Temperature: `TEMPERATURE_DOC_GEN` (0.5)

### Batch Generation

**`generateEndpointDocs(input)`** (Lines 188–249):
- Processes endpoints sequentially (not parallel)
- Calls `generateEndpointDoc()` for each
- Progress callback for UI updates
- Returns: `{ total, completed, current, results: Array<{ endpointId, status, title?, content?, error? }>` }`

### Document Generation

**`generateOpenApiDocument(input)`** (Lines 114–171):
- Similar to single endpoint but for multiple endpoints
- Can inject template context + user prompt
- Handles supplemental material deduplication
- Single-shot (no iterative refinement)

### System Prompt

```
"You are an expert API documentation writer.
Generate clear, comprehensive, developer-friendly documentation 
from OpenAPI metadata, templates, and user instructions.
Write in clean Markdown format.
Be concise but thorough — cover endpoint surface, auth model, 
request/response behavior, failure modes, usage examples, integration risks.
When multiple endpoints provided, combine into one coherent document 
instead of unrelated fragments.
Never invent undocumented fields, headers, status codes, auth scopes, or rate limits.
If metadata missing or ambiguous, say so plainly.
If supplemental context provided, treat as secondary; resolve conflicts 
in favor of explicit OpenAPI metadata.
Use the same language as existing summary/description.
If metadata in English or no text, write in English."
```

---

## 8. Existing Agent-like Capabilities

### Multi-Step Tool Calling

**Partial Agent Behavior: ENABLED via Vercel AI SDK**

- **Location**: `requestAiChatCompletionStream()` (Line 320)
- **Configuration**:
  ```typescript
  ...(input.tools ? { tools: input.tools, maxSteps: input.maxSteps ?? 1 } : {})
  ```
- **Default**: `MAX_MCP_TOOL_STEPS = 10` (configurable)
- **Behavior**:
  - If tools provided, Vercel AI SDK enters tool-calling loop
  - LLM can call tools, receive results, call more tools
  - Loop runs up to `maxSteps` iterations
  - Stops when LLM generates final text response or exhausts steps
- **Attribution**: Tracks all tool names used across ALL steps via `collectMcpToolNamesFromSteps()`

### NOT Full Agentic Framework

- **No explicit state machine**: AI SDK handles loop internally
- **No complex reasoning**: Just tool-call → result → next turn
- **No long-horizon planning**: Limited by context window + maxSteps
- **No memory beyond current session**: Sessions persist but no goal tracking
- **No tool composition layer**: Tools are individual, not composed

### Future Agent Possibilities

The architecture supports:
1. **Extending maxSteps** for more complex workflows
2. **Adding specialized tools** (code execution, API calls, file ops)
3. **Conversation persistence** (sessions already support this)
4. **Structured prompting** (can inject reasoning frameworks into system prompt)
5. **Multi-turn planning** (iterative retrieval already in place)

---

## 9. Key Data Models

### In Database (schema-ai.ts)

**aiProviderConfigs** (AI Providers)
- id, workspaceId, name, providerType, baseUrl, apiKey, defaultModelId, enabled, createdAt, updatedAt

**aiWorkspaceSettings** (Workspace Config)
- workspaceId, defaultModelId, enabledModelIds[], promptSettings{}, embeddingModelId, rerankerModelId, ragEnabled

**documentChunks** (RAG Vector Store)
- id, documentId, workspaceId, chunkIndex, chunkText, sectionPath, heading, knowledgeSourceId, embedding(1536), embeddingModelId, tokenCount, contentHash, createdAt, updatedAt

**aiChatSessions** (Conversation Sessions)
- id, workspaceId, userId, title, documentId, createdAt, updatedAt

**aiChatMessages** (Conversation History)
- id, sessionId, role ('user'|'assistant'|'system'), content, sources[], attribution{}, createdAt

### In Memory / Runtime

**ResolvedAiProviderConfig** (from ai-server-types.ts)
- id, providerType, apiKey, baseUrl

**ContextLimits** (Context Token Budgeting)
- maxContextChars, maxContextTokens, maxSectionChars, maxSectionTokens, maxEntityTokens, maxRelationTokens, adjacentChunkRadius

---

## 10. Message & Response Format

### Chat Request
```json
{
  "message": "How do I authenticate with the API?",
  "sessionId": "uuid",
  "documentId": "doc-123",
  "model": "gpt-4",
  "ragMode": "hybrid",
  "mcpPrompt": {
    "serverId": "mcp-1",
    "name": "current_api_status"
  }
}
```

### Chat Response (Streaming)
```
[Streaming plain text response...]

Headers:
  x-ai-chat-session: uuid
  x-ai-chat-sources: [base64-encoded JSON]
```

**Sources JSON** (from x-ai-chat-sources header):
```json
[
  {
    "documentId": "doc-123",
    "documentSlug": "api-auth",
    "chunkId": "chunk-456",
    "title": "Authentication",
    "preview": "Bearer token authentication...",
    "relationType": "primary",
    "relationDescription": "Direct retrieval match for the user question."
  },
  {
    "documentId": "doc-789",
    "documentSlug": "oauth2-guide",
    "chunkId": "doc-789:reference",
    "title": "OAuth2 Guide",
    "preview": "OAuth2 is a delegated authorization...",
    "relationType": "reference",
    "relationDescription": "Referenced by \"Authentication\" via link \"OAuth2\"."
  }
]
```

### Message Stored in DB
```
{
  id: "msg-uuid",
  sessionId: "session-uuid",
  role: "assistant",
  content: "Bearer token authentication...",
  sources: [...] (same as above),
  attribution: {
    usedMcp: true,
    mcpToolNames: ["github__list_issues", "github__get_commit"]
  },
  createdAt: "2024-01-15T10:30:00Z"
}
```

---

## 11. Configuration Tuning Reference

### RAG Parameters (lib/ai-config.ts)

```typescript
// Retrieval
TOP_K_CHUNKS = 15                           // Initial semantic hits to fetch
TOP_K_KEYWORD_DOCUMENTS = 4                 // Keyword-only documents
MAX_QUERY_VARIANTS = 4                      // Query rewrites to try

// Selection
MAX_SEMANTIC_CHUNKS = 10                    // Max chunks in final context
MAX_SEMANTIC_CHUNKS_PER_DOCUMENT = 3        // Per-document limit
ADJACENT_CHUNK_RADIUS = 1                   // Neighborhood size (±N chunks)
MAX_RELATED_DOCUMENTS = 5                   // Reference expansion limit
MAX_PRIMARY_DOCUMENTS = 8                   // Primary context for relations

// Context Assembly
MAX_CONTEXT_CHARS = 20,000                  // Total context length
MAX_CONTEXT_SECTIONS = 12                   // Max numbered sections
MAX_SECTION_CHARS = 2,500                   // Per-section limit
MAX_COMPRESSED_BLOCKS = 4                   // Blocks kept during compression
MAX_CONTEXT_TOKENS = 120,000 (model-tuned)  // Token budget
MAX_SECTION_TOKENS = 8,000                  // Per-section token limit

// Similarity Thresholds
MIN_VECTOR_SIMILARITY = 0.5 (Anthropic) / 0.6 (others)
VECTOR_SIMILARITY_WINDOW = 0.25             // Keep within this range of top

// Conversation
MAX_HISTORY_MESSAGES = 20                   // Turns to keep
MAX_HISTORY_TURNS_FOR_REWRITE = 5           // Turns for query rewrite

// Temperature
TEMPERATURE_CHAT = 0.7
TEMPERATURE_QUERY_REWRITE = 0.3             // More deterministic
TEMPERATURE_DOC_GEN = 0.5

// MCP
MAX_MCP_TOOL_STEPS = 10                     // Tool-calling loop iterations
MAX_MCP_TOOLS_PER_REQUEST = 50

// Caching
RAG_QUERY_CONTEXT_CACHE_TTL_SECONDS = 300   // 5 minutes
RAG_KEYWORD_CACHE_TTL_SECONDS = 86400       // 24 hours
```

---

## 12. Streaming & Concurrency

### Stream Architecture

**Tee Pattern** (app/api/ai/chat/route.ts, Line 92):
```typescript
const [browserStream, persistStream] = stream.tee()

// Browser gets immediate stream
Response(browserStream, { headers: {...} })

// Background task collects + saves
collectStreamText(persistStream).then(text => saveChatMessage(...))
```

**Benefits**:
- Non-blocking: Response returned immediately
- No buffering: Streaming starts while saving is pending
- Error resilience: Saves don't block user

### Background Task Pattern

```typescript
void Promise.all([
  collectStreamText(persistStream),
  attributionPromise.catch(...),
])
  .then(([fullText, attribution]) => saveChatMessage(...))
  .catch(error => logServerError(...))
```

- Promise chaining (no `await`)
- Errors logged, not thrown
- Fire-and-forget semantics

---

## 13. Summary: Architecture for Agent Building

### What's Already Built

✅ **Conversation persistence**: Sessions + history with sources
✅ **Multi-turn handling**: Query rewriting, iterative retrieval, context boosting
✅ **Tool calling infrastructure**: MCP integration + multi-step support (maxSteps)
✅ **Streaming**: Full streaming pipeline with background persistence
✅ **Attribution**: Tracks which tools/MCP used in each response
✅ **Complex RAG**: Semantic + keyword + KG + reference expansion + reranking
✅ **Multi-provider**: OpenAI, Anthropic, Gemini support
✅ **Caching**: Query context cache + MCP connection cache
✅ **Grounding**: Verification that response has source context

### What's Missing for Full Agent Framework

❌ **Explicit agent loop**: Currently LLM handles via Vercel AI SDK
❌ **State machine**: No explicit state tracking between tool calls
❌ **Long-horizon planning**: No goal decomposition or task memory
❌ **Custom tool framework**: MCP tools only; no arbitrary action layer
❌ **Reflection/retry logic**: No built-in recovery for tool failures
❌ **Step-by-step logging**: Limited introspection into tool-calling process

### Immediate Next Steps

1. **Wrap Vercel SDK**: Create agent orchestrator that logs each step
2. **Tool registry**: Catalog internal actions (create doc, search, etc.)
3. **Agentic prompt**: System prompt with explicit reasoning + planning sections
4. **Step tracking**: Persist tool calls + results to DB for audit trail
5. **Conditional logic**: Custom tool branching based on previous results

---

## File Reference Map

| File | Lines | Purpose |
|------|-------|---------|
| `lib/ai-chat.ts` | 2,450 | Core RAG chat engine, session mgmt, context assembly |
| `lib/ai-chat-prompt.ts` | 47 | System prompts and context injection |
| `lib/ai-server-sdk.ts` | 396 | AI provider requests (completion, embedding, rerank) |
| `lib/ai-server-types.ts` | ~50 | Type definitions (not fully read) |
| `lib/ai-server-providers.ts` | ~100 | Provider resolution and validation |
| `lib/mcp-tools.ts` | 173 | MCP tool discovery and ToolSet building |
| `lib/mcp-client.ts` | 400 | MCP protocol client (tools, resources, prompts) |
| `lib/ai-config.ts` | 300+ | Configuration constants and tuning |
| `lib/schema-ai.ts` | 150+ | Database schemas for AI data |
| `app/api/ai/chat/route.ts` | 155 | HTTP endpoint for chat API |
| `lib/ai-doc-generator.ts` | 250 | Single-shot doc generation (not agentic) |

---

## Conclusion

The Kite AI system is **well-architected for production use** with:
- Sophisticated multi-stage retrieval and reranking
- Stream-based response with background persistence
- Multi-provider and multi-transport (MCP) support
- Conversation memory and session management
- **Partial agent capabilities** through MCP tool calling

To build a full-fledged agent system, the next layer would wrap this foundation with explicit state tracking, tool composition, and agentic reasoning patterns.

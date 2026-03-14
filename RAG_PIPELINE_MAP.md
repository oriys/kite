# Kite AI QA/RAG Pipeline Architecture Map

## HIGH-LEVEL FLOW
```
User Query (Chat Panel)
    ↓
[POST /api/ai/chat] (Entrypoint)
    ↓
[lib/ai-chat.ts: streamChatResponse()]
    ├→ searchSimilarChunks() [Vector search]
    ├→ buildContextFromChunks() [RAG context]
    ├→ resolveAiModelSelection() [Model resolution]
    └→ requestAiChatCompletionStream() [LLM inference]
    ↓
Response streamed back to client
```

---

## ENTRYPOINTS & USER-FACING COMPONENTS

### Chat Panel (Client)
- **File**: `/components/ai-chat-panel.tsx`
- **Hook**: `/hooks/use-ai-chat.ts`
- **Flow**:
  - User types message → `sendMessage()`
  - POST to `/api/ai/chat` with `message`, `sessionId`, `documentId`, `model`
  - Captures `x-ai-chat-session` and `x-ai-chat-sources` headers
  - Streams response text incrementally

### API Route (Server)
- **File**: `/app/api/ai/chat/route.ts`
- **Method**: POST
- **Auth**: Requires workspace member role
- **Input validation**: 
  - `message` (required, max 4000 chars)
  - `sessionId` (optional, creates new if not provided)
  - `documentId` (optional, scopes search)
  - `model` (optional, defaults to workspace default)
- **Output**: Text stream with headers:
  - `x-ai-chat-session`: Session UUID
  - `x-ai-chat-sources`: JSON array of source chunks

---

## CORE RAG LOGIC

### 1. Vector Search (Retrieval)
**File**: `/lib/ai-chat.ts::searchSimilarChunks()`
```typescript
Input:
  - workspaceId (required)
  - query (user message)
  - documentId (optional filter)
  - topK (default: 8)

Process:
  1. Resolve embedding config:
     - Query enabled AI providers (OpenAI-compatible or Gemini only)
     - Get workspace embeddingModelId (default: text-embedding-3-small)
  2. Generate query embedding via requestAiEmbedding()
  3. Vector search in PostgreSQL:
     - SELECT from document_chunks table
     - WHERE embedding IS NOT NULL
     - ORDER BY cosine distance (<=>)
     - JOIN with documents (filter deleted_at IS NULL)
  4. Return top K chunks with similarity scores

MAX_CONTEXT_CHARS: 12,000 chars total
TOP_K_CHUNKS: 8 (hardcoded)
```

### 2. Context Building
**File**: `/lib/ai-chat.ts::buildContextFromChunks()`
```typescript
Input: Array of chunks with similarity scores

Process:
  1. Iterate chunks, truncate at MAX_CONTEXT_CHARS limit
  2. Format each as: "[N] From "<doc_title>":\n<chunk_text>"
  3. Build sources array: {documentId, chunkId, title, preview}
  4. Join chunks with "\n\n---\n\n" separator

Output:
  - contextText: formatted string for system prompt
  - sources: Array of {documentId, chunkId, title, preview}
```

### 3. System Prompt Assembly
**File**: `/lib/ai-chat.ts::CHAT_SYSTEM_PROMPT`
```
Base prompt:
  "You are a knowledgeable assistant for an API documentation workspace.
   Answer questions accurately based on the documentation context provided below.
   When referencing information from the documentation, cite the source using [1], [2], etc.
   If the context does not contain enough information to answer, say so clearly.
   Be concise and direct. Use markdown formatting.
   Use the same language as the user's question."

Final system message:
  If chunks found:
    base + "\n\n---\n\nDocumentation context:\n\n" + contextText
  If NO chunks found:
    base + "\nNo documentation context was found for this query. Answer based on general knowledge..."

⚠️ CRITICAL ISSUE: The "no context" fallback answers with general knowledge instead of
   requiring documentation. This is likely causing off-topic answers.
```

### 4. Model Selection
**File**: `/lib/ai-server.ts::resolveAiModelSelection()`
```typescript
Priority order:
  1. requestedModelId (from client, if provided)
  2. defaultModelId (workspace setting)
  3. enabledModelIds (workspace setting array)
  4. Provider's defaultModelId (fallback)

Returns: {provider, modelId, modelRef}
Throws if no model available
```

### 5. LLM Inference
**File**: `/lib/ai-server.ts::requestAiChatCompletionStream()`
```typescript
Input:
  - provider (ResolvedAiProviderConfig)
  - systemPrompt (built from context)
  - messages (history + current query)
  - model (modelId)
  - temperature (default: 0.3)

Process:
  1. Create language model via Vercel AI SDK:
     - OpenAI-compatible: createOpenAI()
     - Anthropic: createAnthropic()
     - Gemini: createGoogleGenerativeAI()
  2. Call streamText() with system prompt + message context
  3. Convert text stream to ReadableStream<Uint8Array>
  4. Return stream + modelRef

Provider selection logic:
  - Checks provider.enabled and provider.apiKey.trim()
  - No fallback provider used in chat (unlike transform actions)
```

---

## DOCUMENT INDEXING & EMBEDDING

### Indexing Pipeline
**File**: `/lib/embedding-pipeline.ts`

**Entry point**: `embedDocument()`
```typescript
Input:
  - workspaceId
  - documentId
  - title
  - content
  - force (skip hash check)

Process:
  1. Compute SHA256 hash of title+content
  2. Check if already indexed (skip if unchanged)
  3. Resolve embedding provider (same as chat: OpenAI-compatible or Gemini)
  4. Chunk document via chunkDocument()
  5. Generate embeddings in batches (batch size: 20)
  6. Atomically replace chunks in database
     - DELETE old chunks for documentId
     - INSERT new chunks with embeddings

Returns: {status, chunkCount}
Status: 'unchanged' | 'no_provider' | 'empty' | 'updated'
```

**Entry point**: `embedWorkspaceDocuments()`
- Batch processes all non-deleted docs in workspace
- Fires-and-forgets failures (logs only)

### Chunking Strategy
**File**: `/lib/chunker.ts`
```typescript
Algorithm:
  1. Split markdown by headings (### ## #)
  2. For each section:
     - If tokens ≤ 500: keep as single chunk
     - If tokens > 500: split via splitTextIntoChunks()
  3. Try to break at paragraph (\\n\\n) or sentence boundary
  4. Apply 50-token overlap between chunks
  5. Strip for embedding: remove code blocks, markdown, URLs, emphasis

Token estimation:
  - English: ~4 chars per token
  - CJK: ~2 chars per token

Chunk structure:
  - chunkText: full markdown text
  - embeddingText: stripped text for embedding
  - chunkIndex: sequential number
  - tokenCount: estimated tokens
```

**Embedding Model Config**:
- Default: `text-embedding-3-small`
- Configurable per workspace: `aiWorkspaceSettings.embeddingModelId`
- Only OpenAI-compatible and Gemini providers support embeddings

---

## DATABASE SCHEMA

### Document Chunks (Vector Store)
```sql
document_chunks:
  - id (text, PK)
  - documentId (FK → documents.id)
  - workspaceId (FK → workspaces.id)
  - chunkIndex (integer)
  - chunkText (text, markdown content)
  - embedding (vector(1536), pgvector)
  - tokenCount (integer)
  - contentHash (text, for change detection)
  - createdAt, updatedAt
```

### Chat Sessions
```sql
ai_chat_sessions:
  - id (text, PK)
  - workspaceId (FK → workspaces.id)
  - userId (FK → users.id)
  - documentId (FK → documents.id, nullable, scopes search)
  - title (text)
  - createdAt, updatedAt
```

### Chat Messages
```sql
ai_chat_messages:
  - id (text, PK)
  - sessionId (FK → ai_chat_sessions.id, CASCADE)
  - role ('user' | 'assistant' | 'system')
  - content (text)
  - sources (jsonb, array of ChatSource)
  - createdAt
```

### Workspace Settings
```sql
ai_workspace_settings:
  - workspaceId (text, PK/FK)
  - defaultModelId (text, nullable)
  - enabledModelIds (text[], array of model IDs)
  - embeddingModelId (text, nullable)
  - promptSettings (jsonb, custom prompts)
  - createdAt, updatedAt
```

### Provider Configs
```sql
ai_provider_configs:
  - id (text, PK)
  - workspaceId (FK → workspaces.id)
  - name (text)
  - providerType ('openai_compatible' | 'anthropic' | 'gemini')
  - baseUrl (text, nullable, uses default if null)
  - apiKey (text, encrypted/secrets)
  - defaultModelId (text, nullable)
  - enabled (boolean)
  - source ('database' | 'env')
  - createdAt, updatedAt, deletedAt (soft delete)
```

---

## ALTERNATIVE SEARCH (Not Used in Chat)

### Hybrid Search
**File**: `/lib/search/semantic-searcher.ts`
```
Combines:
  1. Keyword FTS (PostgreSQL tsvector)
  2. Semantic vector search
  3. Reciprocal Rank Fusion (RRF) merging

Mode: 'keyword' | 'semantic' | 'hybrid' (default)
Limit: 20 results

Used by:
  - /api/search (global search UI)
  - NOT used by /api/ai/chat (chat uses dedicated searchSimilarChunks)

⚠️ Chat pipeline does NOT use this hybrid approach
```

### Keyword Search
**File**: `/lib/search/searcher.ts`
```
PostgreSQL full-text search:
  - Uses plainto_tsquery (phrase queries)
  - Ranks by ts_rank()
  - Extracts headlines via ts_headline()
  - Fallback: ILIKE on title+content if tsvector unavailable

Not used in chat RAG
```

---

## USER-FACING SETTINGS & CONTROLS

### Workspace Model Settings
**Route**: `PUT /api/ai/settings/models`
**File**: `/app/api/ai/settings/models/route.ts`
```json
Input:
{
  "defaultModelId": "provider-id::model-id",
  "enabledModelIds": ["provider-id::model-id", ...]
}
```
- Stored in `aiWorkspaceSettings`
- Affects default model for all chat + transform actions
- Per-action overrides in promptSettings not exposed in chat UI

### Provider Management
**Route**: `/app/api/ai/providers/*`
**Files**:
- POST `/api/ai/providers` - Create provider config
- GET `/api/ai/providers` - List workspace providers
- PUT `/api/ai/providers/[id]` - Update (name, baseUrl, apiKey, enabled)
- DELETE `/api/ai/providers/[id]` - Soft delete

**Validation**:
- Base URL normalized (trailing slash removed)
- API key trimmed, encrypted at rest
- Enabled flag controls provider visibility in model selection
- Requires member role

### Model Catalog
**Route**: `GET /api/ai/models`
**File**: `/app/api/ai/models/route.ts`
```json
Response:
{
  "configured": boolean,
  "defaultModelId": "...",
  "enabledModelIds": [...],
  "providers": [
    {
      "id": "provider-id",
      "name": "Provider Name",
      "providerType": "openai_compatible|anthropic|gemini",
      "enabled": true,
      "modelCount": N,
      "error": "optional error message"
    }
  ],
  "models": [
    {
      "id": "provider-id::model-id",
      "modelId": "gpt-4o",
      "label": "GPT-4o",
      "provider": "Provider Name",
      "capabilities": ["Vision", "Reasoning"],
      "contextWindow": 128000
    }
  ]
}
```

**Model discovery**:
- OpenAI-compatible: GET /v1/models (lists live models)
- Anthropic: GET /v1/models (with API key auth)
- Gemini: GET /v1beta/models (with API key auth)
- Fallback: Provider's defaultModelId if discovery fails

### Provider Priority
1. **Database providers** (workspace-specific, if any exist)
2. **Environment fallback** (AIHUBMIX_* or OPENAI_*)
   - AIHUBMIX_API_KEY, AIHUBMIX_BASE_URL, AIHUBMIX_MODEL
   - Falls back to OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
   - Default: AIHubMix (aihubmix.com/v1), model: gpt-4o-mini

---

## FAILURE POINTS & LIKELY ISSUES

### 🔴 PRIMARY ISSUE: Off-Topic Answers (Matching User Report)

**Root Cause 1**: No documentation found fallback
- **Location**: `/lib/ai-chat.ts` line 250-252
- **Problem**: When `searchSimilarChunks()` returns empty (no embeddings or no match)
  ```
  system prompt includes:
    "No documentation context was found... Answer based on your general knowledge..."
  ```
- **Impact**: Model answers from general training data, not API docs
- **Why it happens**:
  1. Embeddings not generated for workspace (no embedding provider configured)
  2. Query doesn't match any chunks semantically (bad similarity threshold)
  3. Document chunks not indexed yet (embedDocument never called)

**Root Cause 2**: Silent embedding failures
- **Location**: `/lib/ai-chat.ts` line 29-45 (resolveEmbeddingConfig)
- **Problem**: If NO enabled OpenAI-compatible or Gemini provider exists, returns `null`
  - searchSimilarChunks() then returns [] silently
  - Chat continues with "no context" prompt
- **No visibility**: No error message shown to user, just silent degradation

**Root Cause 3**: Query-chunk similarity threshold not enforced
- **Location**: `/lib/ai-chat.ts` line 71-86
- **Problem**: Query embedding ranked by distance (cosine similarity), but NO similarity threshold
  - Even very low-similarity chunks included (topK=8 always)
  - If metaobject is in documentation but chunk is about permissions and query is about scopes:
    - Low similarity score but still included
    - Model sees irrelevant context → off-topic answer

### 🟡 SECONDARY ISSUES

**Issue 2**: Chunking loss
- **Location**: `/lib/chunker.ts`
- **Problem**: Chunks separated by "---" boundary, context about related sections lost
- **Example**: "Permissions" section split from "Scopes" section
  - Query about "permissions scopes for metaobject" matches both chunks separately
  - Relationship between them lost
  - Model sees "permission scopes" in isolation

**Issue 3**: Embedding model mismatch
- **Default**: text-embedding-3-small (1536 dims)
- **Problem**: If workspace uses different embedding model than query model
  - Different vector space → low similarity scores
  - Re-embedding with different model after initial indexing
  - No re-chunking of old documents

**Issue 4**: Chat history context pollution
- **Location**: `/lib/ai-chat.ts` line 231-238
- **Problem**: Includes up to last 10 chat messages in context
  - Previous off-topic exchanges pollute system context
  - Model biased toward previous incorrect answers

**Issue 5**: Document visibility not checked
- **Location**: `/lib/ai-chat.ts::searchSimilarChunks()`
- **Problem**: No permission check on returned documents
  - Vector search doesn't filter by document visibility/permissions
  - Could expose restricted docs if user has workspace access

---

## CONFIGURATION & ENVIRONMENT

### Environment Variables
```bash
# Fallback provider (if no database providers exist)
AIHUBMIX_API_KEY=...
AIHUBMIX_BASE_URL=https://aihubmix.com/v1 (default)
AIHUBMIX_MODEL=gpt-4o-mini (default)

# Or fallback to OpenAI
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1 (default)
OPENAI_MODEL=... (no default, required)
```

### Database Requirements
```sql
-- Vector extension (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- Full-text search (built-in PostgreSQL)
-- Auto-populated via trigger on documents table

-- Migration: Create embedding indices
CREATE INDEX idx_document_chunks_embedding 
  ON document_chunks 
  USING hnsw(embedding vector_cosine_ops);
```

---

## HOOKS & UTILITIES

### Client Hooks
- `/hooks/use-ai-chat.ts` - Chat session management, message streaming
- `/hooks/use-ai-prompts.ts` - Custom prompt settings per workspace
- `/hooks/use-ai-models.ts` - Model catalog fetching
- `/hooks/use-ai-providers.ts` - Provider config management
- `/hooks/use-ai-preferences.ts` - User's active model selection

### Server Utilities
- `/lib/ai.ts` - Constants, types, model formatting
- `/lib/ai-server.ts` - Provider resolution, embedding/chat completion, model discovery
- `/lib/ai-chat.ts` - Chat RAG pipeline (primary orchestration)
- `/lib/embedding-pipeline.ts` - Document indexing
- `/lib/queries/ai.ts` - Database queries for AI settings/providers

---

## TESTING POINTS FOR METAOBJECT PERMISSIONS/SCOPES

### 1. Verify embeddings are generated
```bash
SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL;
-- Should be > 0 for the workspace
```

### 2. Check if query matches any chunks
```sql
-- Manually embed a test query: "permissions scopes for metaobject"
-- Then vector search in document_chunks
SELECT similarity FROM document_chunks 
  WHERE workspace_id = '...'
  ORDER BY embedding <=> '[vector]'
  LIMIT 10;
-- Examine similarity scores (should be > 0.5 for good matches)
```

### 3. Verify provider is enabled
- Check `aiProviderConfigs` where `enabled = true`
- Check `providerType` is 'openai_compatible' or 'gemini'
- Verify API key is set

### 4. Check which documents are being retrieved
- Add logging to `searchSimilarChunks()` output
- Examine returned chunks: are they actually about metaobject permissions?
- Check if similarity scores are suspiciously low

### 5. Verify system prompt is used
- Model should include base system prompt + context
- If no chunks found, model will fall back to general knowledge

---

## REMEDIATION RECOMMENDATIONS

1. **Add similarity threshold** (minimum 0.5 or configurable)
   - File: `/lib/ai-chat.ts::searchSimilarChunks()`
   - Filter results where similarity < threshold

2. **Log missing embeddings**
   - File: `/lib/ai-chat.ts::resolveEmbeddingConfig()`
   - Return error instead of silent null

3. **Enforce documentation-only mode**
   - Add workspace setting: `requireDocumentationContext` (boolean)
   - If true + no chunks found: throw error instead of fallback prompt

4. **Add chunk relationships**
   - Store related section IDs in chunks
   - Expand context to include adjacent chunks

5. **Implement re-embedding triggers**
   - When embedding model changes, flag docs for re-embedding
   - Prevent model/embedding mismatch

6. **Add debugging endpoint**
   - POST `/api/ai/debug/search` with query
   - Returns chunks found + similarity scores + system prompt used

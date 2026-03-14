import { eq, and, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  aiChatSessions,
  aiChatMessages,
} from '@/lib/schema'
import {
  requestAiEmbedding,
  requestAiChatCompletionStream,
  resolveAiModelSelection,
  resolveWorkspaceAiProviders,
} from '@/lib/ai-server'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
const TOP_K_CHUNKS = 8
const MAX_CONTEXT_CHARS = 12_000
const MAX_HISTORY_MESSAGES = 10

export interface ChatSource {
  documentId: string
  chunkId: string
  title: string
  preview: string
}

// ─── Vector search ──────────────────────────────────────────────

async function resolveEmbeddingConfig(workspaceId: string) {
  const [providers, settings] = await Promise.all([
    resolveWorkspaceAiProviders(workspaceId),
    getAiWorkspaceSettings(workspaceId),
  ])

  const embeddingProviders = providers.filter(
    (p) => p.enabled && (p.providerType === 'openai_compatible' || p.providerType === 'gemini'),
  )

  if (embeddingProviders.length === 0) return null

  return {
    provider: embeddingProviders[0],
    modelId: settings?.embeddingModelId?.trim() || DEFAULT_EMBEDDING_MODEL,
  }
}

export async function searchSimilarChunks(input: {
  workspaceId: string
  query: string
  documentId?: string
  topK?: number
}) {
  const config = await resolveEmbeddingConfig(input.workspaceId)
  if (!config) return []

  const { embeddings } = await requestAiEmbedding({
    provider: config.provider,
    texts: [input.query],
    model: config.modelId,
  })

  if (embeddings.length === 0) return []

  const queryVector = `[${embeddings[0].join(',')}]`
  const topK = input.topK ?? TOP_K_CHUNKS

  const documentFilter = input.documentId
    ? sql`AND dc.document_id = ${input.documentId}`
    : sql``

  const results = await db.execute(sql`
    SELECT
      dc.id AS chunk_id,
      dc.document_id,
      dc.chunk_text,
      dc.chunk_index,
      d.title AS document_title,
      1 - (dc.embedding <=> ${queryVector}::vector) AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id AND d.deleted_at IS NULL
    WHERE dc.workspace_id = ${input.workspaceId}
      AND dc.embedding IS NOT NULL
      ${documentFilter}
    ORDER BY dc.embedding <=> ${queryVector}::vector
    LIMIT ${topK}
  `)

  return (results as unknown as Array<Record<string, unknown>>).map((row) => ({
    chunkId: row.chunk_id as string,
    documentId: row.document_id as string,
    chunkText: row.chunk_text as string,
    chunkIndex: row.chunk_index as number,
    documentTitle: row.document_title as string,
    similarity: Number(row.similarity ?? 0),
  }))
}

// ─── RAG context builder ────────────────────────────────────────

function buildContextFromChunks(
  chunks: Awaited<ReturnType<typeof searchSimilarChunks>>,
) {
  const sources: ChatSource[] = []
  const contextParts: string[] = []
  let totalChars = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    if (totalChars + chunk.chunkText.length > MAX_CONTEXT_CHARS) break

    const label = `[${i + 1}]`
    contextParts.push(
      `${label} From "${chunk.documentTitle}":\n${chunk.chunkText}`,
    )
    totalChars += chunk.chunkText.length

    sources.push({
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      title: chunk.documentTitle,
      preview: chunk.chunkText.slice(0, 150),
    })
  }

  return { contextText: contextParts.join('\n\n---\n\n'), sources }
}

const CHAT_SYSTEM_PROMPT = [
  'You are a knowledgeable assistant for an API documentation workspace.',
  'Answer questions accurately based on the documentation context provided below.',
  'When referencing information from the documentation, cite the source using [1], [2], etc. notation matching the context labels.',
  'If the context does not contain enough information to answer, say so clearly rather than guessing.',
  'Be concise and direct. Use markdown formatting for code, lists, and emphasis.',
  'Use the same language as the user\'s question.',
].join(' ')

// ─── Chat session management ────────────────────────────────────

export async function createChatSession(input: {
  workspaceId: string
  userId: string
  documentId?: string
  title?: string
}) {
  const [session] = await db
    .insert(aiChatSessions)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      documentId: input.documentId ?? null,
      title: input.title ?? 'New conversation',
    })
    .returning()

  return session
}

export async function listChatSessions(input: {
  workspaceId: string
  userId: string
  limit?: number
}) {
  return db
    .select({
      id: aiChatSessions.id,
      title: aiChatSessions.title,
      documentId: aiChatSessions.documentId,
      createdAt: aiChatSessions.createdAt,
      updatedAt: aiChatSessions.updatedAt,
    })
    .from(aiChatSessions)
    .where(
      and(
        eq(aiChatSessions.workspaceId, input.workspaceId),
        eq(aiChatSessions.userId, input.userId),
      ),
    )
    .orderBy(desc(aiChatSessions.updatedAt))
    .limit(input.limit ?? 20)
}

export async function getChatHistory(sessionId: string) {
  return db
    .select({
      id: aiChatMessages.id,
      role: aiChatMessages.role,
      content: aiChatMessages.content,
      sources: aiChatMessages.sources,
      createdAt: aiChatMessages.createdAt,
    })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, sessionId))
    .orderBy(aiChatMessages.createdAt)
}

export async function saveChatMessage(input: {
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: ChatSource[]
}) {
  const [message] = await db
    .insert(aiChatMessages)
    .values({
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      sources: input.sources ?? [],
    })
    .returning()

  // Update session timestamp
  await db
    .update(aiChatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(aiChatSessions.id, input.sessionId))

  return message
}

// ─── RAG chat pipeline ──────────────────────────────────────────

export async function streamChatResponse(input: {
  workspaceId: string
  sessionId: string
  userMessage: string
  documentId?: string
  model?: string
}) {
  // 1. Get chat history for context
  const history = await getChatHistory(input.sessionId)
  const recentHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  // 2. Search for relevant documentation chunks
  const chunks = await searchSimilarChunks({
    workspaceId: input.workspaceId,
    query: input.userMessage,
    documentId: input.documentId,
  })

  const { contextText, sources } = buildContextFromChunks(chunks)

  // 3. Build system prompt with RAG context
  const systemPrompt = contextText
    ? `${CHAT_SYSTEM_PROMPT}\n\n---\n\nDocumentation context:\n\n${contextText}`
    : `${CHAT_SYSTEM_PROMPT}\n\nNo documentation context was found for this query. Answer based on your general knowledge and note that you don't have specific workspace documentation available.`

  // 4. Resolve AI model
  const [providers, settings] = await Promise.all([
    resolveWorkspaceAiProviders(input.workspaceId),
    getAiWorkspaceSettings(input.workspaceId),
  ])

  const selection = resolveAiModelSelection({
    requestedModelId: input.model,
    defaultModelId: settings?.defaultModelId ?? null,
    enabledModelIds: Array.isArray(settings?.enabledModelIds)
      ? settings.enabledModelIds.filter(
          (v): v is string => typeof v === 'string',
        )
      : [],
    providers,
  })

  if (!selection) {
    throw new Error('No AI model configured.')
  }

  // 5. Stream response with full conversation context
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...recentHistory,
    { role: 'user' as const, content: input.userMessage },
  ]

  const result = await requestAiChatCompletionStream({
    provider: selection.provider,
    model: selection.modelId,
    systemPrompt,
    messages,
    temperature: 0.3,
  })

  return {
    stream: result.stream,
    model: result.model,
    sources,
  }
}

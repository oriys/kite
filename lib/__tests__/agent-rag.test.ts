import { beforeEach, describe, expect, it, vi } from 'vitest'

const { retrieveWorkspaceRagContextMock } = vi.hoisted(() => ({
  retrieveWorkspaceRagContextMock: vi.fn(),
}))

vi.mock('@/lib/ai-chat', () => ({
  retrieveWorkspaceRagContext: retrieveWorkspaceRagContextMock,
}))

vi.mock('@/lib/db', () => ({
  db: {},
}))

describe('agent knowledge-base RAG', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes knowledge-base context in the system prompt', async () => {
    const { buildAgentSystemPrompt } = await import('@/lib/agent/prompts')

    const prompt = buildAgentSystemPrompt({
      documentContext: 'Working on: **Auth**',
      knowledgeContext: '[1] Knowledge source\nTitle: "Authentication Guide"\n\nUse API keys.',
    })

    expect(prompt).toContain('## Current Document Context')
    expect(prompt).toContain('## Knowledge Base Context')
    expect(prompt).toContain('Authentication Guide')
    expect(prompt).toContain('Use the knowledge base.')
  })

  it('queries workspace knowledge with the RAG tool', async () => {
    retrieveWorkspaceRagContextMock.mockResolvedValue({
      contextText: '[1] Knowledge source\nTitle: "Webhook Guide"\n\nVerify signatures.',
      sources: [
        {
          documentId: 'source_1',
          chunkId: 'chunk_1',
          title: 'Webhook Guide',
          preview: 'Verify signatures.',
          sourceType: 'knowledge_source',
          relationType: 'primary',
        },
      ],
    })

    const { createAgentTools } = await import('@/lib/agent/tools')
    const tools = createAgentTools({
      workspaceId: 'ws_123',
      userId: 'user_123',
      documentId: 'doc_123',
    })
    const searchKnowledgeBaseTool = tools.search_knowledge_base as unknown as {
      execute: (input: { query: string }) => Promise<unknown>
    }

    const result = await searchKnowledgeBaseTool.execute({
      query: 'How do webhooks authenticate?',
    })

    expect(retrieveWorkspaceRagContextMock).toHaveBeenCalledWith({
      workspaceId: 'ws_123',
      query: 'How do webhooks authenticate?',
      documentId: 'doc_123',
      debug: false,
    })
    expect(result).toEqual({
      query: 'How do webhooks authenticate?',
      sourceCount: 1,
      sources: [
        {
          documentId: 'source_1',
          chunkId: 'chunk_1',
          title: 'Webhook Guide',
          preview: 'Verify signatures.',
          sourceType: 'knowledge_source',
          relationType: 'primary',
        },
      ],
      contextText: '[1] Knowledge source\nTitle: "Webhook Guide"\n\nVerify signatures.',
    })
  })
})

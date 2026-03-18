import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db and AI modules before imports
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue([
      { total: 100, stale: 5, missing: 2 },
    ]),
  },
}))

vi.mock('@/lib/ai-server', () => ({
  resolveEmbeddingProvider: vi.fn(),
}))

vi.mock('@/lib/schema', () => ({
  documentChunks: {
    workspaceId: 'workspace_id',
    embeddingModelId: 'embedding_model_id',
    embedding: 'embedding',
  },
}))

vi.mock('@/lib/schema-kg', () => ({
  kgEntities: {
    workspaceId: 'workspace_id',
    embeddingModelId: 'embedding_model_id',
    embedding: 'embedding',
  },
  kgRelations: {
    workspaceId: 'workspace_id',
    embeddingModelId: 'embedding_model_id',
    embedding: 'embedding',
  },
}))

import { resolveEmbeddingProvider } from '@/lib/ai-server'

describe('embedding-health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no embedding provider is configured', async () => {
    vi.mocked(resolveEmbeddingProvider).mockResolvedValue(null)
    const { checkEmbeddingHealth } = await import('@/lib/kg/embedding-health')
    const result = await checkEmbeddingHealth('ws-1')
    expect(result).toBeNull()
  })

  it('reports currentModelId from resolved provider', async () => {
    vi.mocked(resolveEmbeddingProvider).mockResolvedValue({
      provider: {} as never,
      modelId: 'text-embedding-3-small',
    })
    const { checkEmbeddingHealth } = await import('@/lib/kg/embedding-health')
    const result = await checkEmbeddingHealth('ws-1')
    expect(result).not.toBeNull()
    expect(result!.currentModelId).toBe('text-embedding-3-small')
  })
})

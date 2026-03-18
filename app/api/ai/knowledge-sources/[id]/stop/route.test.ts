import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  withWorkspaceAuthMock,
  abortKnowledgeSourceProcessingMock,
  selectMock,
  fromMock,
  whereMock,
  limitMock,
  updateMock,
  setMock,
  updateWhereMock,
} = vi.hoisted(() => ({
  withWorkspaceAuthMock: vi.fn(),
  abortKnowledgeSourceProcessingMock: vi.fn(),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  whereMock: vi.fn(),
  limitMock: vi.fn(),
  updateMock: vi.fn(),
  setMock: vi.fn(),
  updateWhereMock: vi.fn(),
}))

vi.mock('@/lib/api-utils', () => ({
  withWorkspaceAuth: withWorkspaceAuthMock,
  notFound: () => NextResponse.json({ error: 'Not found' }, { status: 404 }),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: selectMock,
    update: updateMock,
  },
}))

vi.mock('@/lib/knowledge-processing-runtime', () => ({
  abortKnowledgeSourceProcessing: abortKnowledgeSourceProcessingMock,
}))

vi.mock('@/lib/schema', () => ({
  knowledgeSources: {
    id: 'id',
    status: 'status',
    stopRequestedAt: 'stop_requested_at',
    workspaceId: 'workspace_id',
    deletedAt: 'deleted_at',
  },
}))

describe('POST /api/ai/knowledge-sources/[id]/stop', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    withWorkspaceAuthMock.mockResolvedValue({
      ctx: {
        workspaceId: 'ws_123',
        userId: 'user_123',
        role: 'admin',
      },
    })

    selectMock.mockReturnValue({ from: fromMock })
    fromMock.mockReturnValue({ where: whereMock })
    whereMock.mockReturnValue({ limit: limitMock })

    updateMock.mockReturnValue({ set: setMock })
    setMock.mockReturnValue({ where: updateWhereMock })
  })

  it('marks a processing source as stopping', async () => {
    limitMock.mockResolvedValue([
      {
        id: 'source_123',
        status: 'processing',
        stopRequestedAt: null,
      },
    ])

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/ai/knowledge-sources/source_123/stop', {
        method: 'POST',
      }) as never,
      { params: Promise.resolve({ id: 'source_123' }) },
    )

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stopRequestedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    )
    expect(abortKnowledgeSourceProcessingMock).toHaveBeenCalledWith(
      'source_123',
      'Processing stopped by user',
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'stopping' })
  })

  it('returns conflict when the source is not processing', async () => {
    limitMock.mockResolvedValue([
      {
        id: 'source_123',
        status: 'ready',
        stopRequestedAt: null,
      },
    ])

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/ai/knowledge-sources/source_123/stop', {
        method: 'POST',
      }) as never,
      { params: Promise.resolve({ id: 'source_123' }) },
    )

    expect(updateMock).not.toHaveBeenCalled()
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Knowledge source is not processing',
    })
  })
})

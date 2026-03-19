import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  withWorkspaceAuthMock,
  abortKnowledgeSourceProcessingMock,
  hasActiveKnowledgeSourceProcessingMock,
  selectMock,
  fromMock,
  whereMock,
  limitMock,
  updateMock,
  setMock,
  updateWhereMock,
  deleteMock,
  deleteWhereMock,
} = vi.hoisted(() => ({
  withWorkspaceAuthMock: vi.fn(),
  abortKnowledgeSourceProcessingMock: vi.fn(),
  hasActiveKnowledgeSourceProcessingMock: vi.fn(),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  whereMock: vi.fn(),
  limitMock: vi.fn(),
  updateMock: vi.fn(),
  setMock: vi.fn(),
  updateWhereMock: vi.fn(),
  deleteMock: vi.fn(),
  deleteWhereMock: vi.fn(),
}))

vi.mock('@/lib/api-utils', () => ({
  badRequest: (message: string) =>
    NextResponse.json({ error: message }, { status: 400 }),
  notFound: () => NextResponse.json({ error: 'Not found' }, { status: 404 }),
  withWorkspaceAuth: withWorkspaceAuthMock,
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: selectMock,
    update: updateMock,
    delete: deleteMock,
  },
}))

vi.mock('@/lib/knowledge-processing-runtime', () => ({
  abortKnowledgeSourceProcessing: abortKnowledgeSourceProcessingMock,
  hasActiveKnowledgeSourceProcessing: hasActiveKnowledgeSourceProcessingMock,
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

describe('/api/ai/knowledge-sources/[id] route', () => {
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
    updateWhereMock.mockResolvedValue(undefined)

    deleteMock.mockReturnValue({ where: deleteWhereMock })
    deleteWhereMock.mockResolvedValue(undefined)

    hasActiveKnowledgeSourceProcessingMock.mockReturnValue(false)
  })

  it('hard deletes a ready knowledge source', async () => {
    limitMock.mockResolvedValue([
      {
        id: 'source_123',
        status: 'ready',
        stopRequestedAt: null,
      },
    ])

    const { DELETE } = await import('./route')
    const response = await DELETE(
      new Request('http://localhost/api/ai/knowledge-sources/source_123', {
        method: 'DELETE',
      }) as never,
      { params: Promise.resolve({ id: 'source_123' }) },
    )

    expect(updateMock).not.toHaveBeenCalled()
    expect(abortKnowledgeSourceProcessingMock).not.toHaveBeenCalled()
    expect(deleteMock).toHaveBeenCalledTimes(1)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('force stops and deletes a processing knowledge source', async () => {
    limitMock.mockResolvedValue([
      {
        id: 'source_123',
        status: 'processing',
        stopRequestedAt: null,
      },
    ])

    const { DELETE } = await import('./route')
    const response = await DELETE(
      new Request('http://localhost/api/ai/knowledge-sources/source_123', {
        method: 'DELETE',
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
      'Processing stopped because the knowledge source was deleted',
    )
    expect(deleteMock).toHaveBeenCalledTimes(1)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })
})

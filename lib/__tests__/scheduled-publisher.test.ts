import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted — they can't reference module-scoped variables.
// Use simple inline mocks instead.

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(),
    select: vi.fn(),
    query: {
      approvalRequests: { findFirst: vi.fn() },
    },
  },
}))

vi.mock('@/lib/schema', () => ({
  scheduledPublications: {
    id: 'id', documentId: 'document_id', workspaceId: 'workspace_id',
    createdBy: 'created_by', status: 'status', scheduledAt: 'scheduled_at',
    updatedAt: 'updated_at',
  },
  documents: {
    id: 'id', status: 'status', workspaceId: 'workspace_id', deletedAt: 'deleted_at',
  },
  approvalRequests: {
    id: 'id', documentId: 'document_id', workspaceId: 'workspace_id', status: 'status',
  },
}))

vi.mock('@/lib/queries/documents', () => ({
  transitionDocument: vi.fn(),
}))

vi.mock('@/lib/queries/approvals', () => ({
  getApprovedApprovalForDocument: vi.fn(() => null),
}))

import { db } from '@/lib/db'
import { processScheduledPublications } from '../scheduled-publisher'
import { getApprovedApprovalForDocument } from '../queries/approvals'
import { transitionDocument } from '../queries/documents'

function mockClaimReturning(items: unknown[]) {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => items),
      })),
    })),
  } as never)
}

function mockBatchDocSelect(docs: unknown[]) {
  vi.mocked(db.select).mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn(() => docs),
    })),
  } as never)
}

function mockStatusUpdate() {
  vi.mocked(db.update).mockReturnValueOnce({
    set: vi.fn(() => ({
      where: vi.fn(() => ({})),
    })),
  } as never)
}

describe('processScheduledPublications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty results when no publications are claimed', async () => {
    mockClaimReturning([])
    const results = await processScheduledPublications()
    expect(results).toEqual([])
  })

  it('skips when document is not in review state', async () => {
    mockClaimReturning([
      { id: 'sp-1', documentId: 'doc-1', workspaceId: 'ws-1', createdBy: 'user-1' },
    ])
    mockBatchDocSelect([{ id: 'doc-1', status: 'draft' }])
    mockStatusUpdate()

    const results = await processScheduledPublications()
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(false)
    expect(results[0].error).toBe('Document not in publishable state')
  })

  it('skips when document not found (deleted)', async () => {
    mockClaimReturning([
      { id: 'sp-1', documentId: 'doc-1', workspaceId: 'ws-1', createdBy: 'user-1' },
    ])
    mockBatchDocSelect([]) // doc not in results
    mockStatusUpdate()

    const results = await processScheduledPublications()
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(false)
    expect(results[0].error).toBe('Document not in publishable state')
  })

  it('skips when no approval exists', async () => {
    mockClaimReturning([
      { id: 'sp-1', documentId: 'doc-1', workspaceId: 'ws-1', createdBy: 'user-1' },
    ])
    mockBatchDocSelect([{ id: 'doc-1', status: 'review' }])
    vi.mocked(getApprovedApprovalForDocument).mockResolvedValueOnce(undefined as never)
    mockStatusUpdate()

    const results = await processScheduledPublications()
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(false)
    expect(results[0].error).toBe('No approved approval request')
    expect(getApprovedApprovalForDocument).toHaveBeenCalledWith('doc-1', 'ws-1')
  })

  it('publishes successfully when doc is in review with approval', async () => {
    mockClaimReturning([
      { id: 'sp-1', documentId: 'doc-1', workspaceId: 'ws-1', createdBy: 'user-1' },
    ])
    mockBatchDocSelect([{ id: 'doc-1', status: 'review' }])
    vi.mocked(getApprovedApprovalForDocument).mockResolvedValueOnce({ id: 'apr-1' } as never)
    vi.mocked(transitionDocument).mockResolvedValueOnce({} as never)
    mockStatusUpdate()

    const results = await processScheduledPublications()
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(true)
    expect(transitionDocument).toHaveBeenCalledWith('doc-1', 'ws-1', 'published', 'user-1')
  })

  it('handles transition errors gracefully', async () => {
    mockClaimReturning([
      { id: 'sp-1', documentId: 'doc-1', workspaceId: 'ws-1', createdBy: 'user-1' },
    ])
    mockBatchDocSelect([{ id: 'doc-1', status: 'review' }])
    vi.mocked(getApprovedApprovalForDocument).mockResolvedValueOnce({ id: 'apr-1' } as never)
    vi.mocked(transitionDocument).mockRejectedValueOnce(new Error('DB connection lost'))
    mockStatusUpdate()

    const results = await processScheduledPublications()
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(false)
    expect(results[0].error).toBe('DB connection lost')
  })
})

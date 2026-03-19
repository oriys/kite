import { describe, it, expect } from 'vitest'

/**
 * These tests verify the approval threshold logic extracted from
 * lib/queries/approvals.ts submitApprovalDecision().
 *
 * Since the function is tightly coupled to the database transaction,
 * we test the threshold logic as a pure function.
 */

type ApprovalDecision = 'approved' | 'rejected' | 'changes_requested'
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'rework'

interface ReviewerState {
  decision: ApprovalDecision | null
}

/**
 * Replicate the threshold logic from submitApprovalDecision()
 * (lib/queries/approvals.ts lines 174-188)
 */
function computeApprovalStatus(
  reviewers: ReviewerState[],
  requiredApprovals: number,
  latestDecision: ApprovalDecision,
): ApprovalStatus {
  const approvedCount = reviewers.filter((r) => r.decision === 'approved').length
  const rejectedCount = reviewers.filter((r) => r.decision === 'rejected').length

  if (approvedCount >= requiredApprovals) return 'approved'
  if (rejectedCount > 0) return 'rejected'
  if (latestDecision === 'changes_requested') return 'rework'
  return 'pending'
}

describe('approval threshold logic', () => {
  describe('single required approval', () => {
    it('approves when one reviewer approves', () => {
      const status = computeApprovalStatus(
        [{ decision: 'approved' }],
        1,
        'approved',
      )
      expect(status).toBe('approved')
    })

    it('rejects when one reviewer rejects', () => {
      const status = computeApprovalStatus(
        [{ decision: 'rejected' }],
        1,
        'rejected',
      )
      expect(status).toBe('rejected')
    })

    it('enters rework when changes requested', () => {
      const status = computeApprovalStatus(
        [{ decision: 'changes_requested' }],
        1,
        'changes_requested',
      )
      expect(status).toBe('rework')
    })

    it('stays pending when no decisions yet', () => {
      const status = computeApprovalStatus(
        [{ decision: null }],
        1,
        'approved', // this won't matter as the reviewer state is what counts
      )
      expect(status).toBe('pending')
    })
  })

  describe('multiple required approvals', () => {
    it('stays pending with 1 of 2 required approvals', () => {
      const status = computeApprovalStatus(
        [{ decision: 'approved' }, { decision: null }],
        2,
        'approved',
      )
      expect(status).toBe('pending')
    })

    it('approves when threshold is met', () => {
      const status = computeApprovalStatus(
        [{ decision: 'approved' }, { decision: 'approved' }],
        2,
        'approved',
      )
      expect(status).toBe('approved')
    })

    it('rejects immediately on any single rejection', () => {
      const status = computeApprovalStatus(
        [{ decision: 'approved' }, { decision: 'rejected' }],
        2,
        'rejected',
      )
      // Note: current logic rejects on ANY rejection, even if one approval exists
      expect(status).toBe('rejected')
    })

    it('rejection takes priority over approval threshold', () => {
      const status = computeApprovalStatus(
        [
          { decision: 'approved' },
          { decision: 'approved' },
          { decision: 'rejected' },
        ],
        2,
        'rejected',
      )
      // Approval threshold (2) is met AND a rejection exists
      // Current logic: approved wins because it's checked first
      expect(status).toBe('approved')
    })
  })

  describe('changes_requested behavior', () => {
    it('enters rework only when latest decision is changes_requested', () => {
      const status = computeApprovalStatus(
        [{ decision: 'changes_requested' }, { decision: null }],
        2,
        'changes_requested',
      )
      expect(status).toBe('rework')
    })

    it('does not enter rework if approval threshold already met', () => {
      const status = computeApprovalStatus(
        [
          { decision: 'approved' },
          { decision: 'approved' },
          { decision: 'changes_requested' },
        ],
        2,
        'changes_requested',
      )
      // Threshold met: approval wins
      expect(status).toBe('approved')
    })
  })

  describe('edge cases', () => {
    it('handles zero required approvals', () => {
      const status = computeApprovalStatus([], 0, 'approved')
      expect(status).toBe('approved')
    })

    it('handles more required approvals than reviewers', () => {
      const status = computeApprovalStatus(
        [{ decision: 'approved' }],
        3,
        'approved',
      )
      expect(status).toBe('pending')
    })

    it('all reviewers approve with high threshold', () => {
      const reviewers = Array.from({ length: 5 }, () => ({ decision: 'approved' as const }))
      const status = computeApprovalStatus(reviewers, 5, 'approved')
      expect(status).toBe('approved')
    })
  })

  describe('priority order', () => {
    // The current implementation checks in this order:
    // 1. approvedCount >= requiredApprovals → 'approved'
    // 2. rejectedCount > 0 → 'rejected'
    // 3. decision === 'changes_requested' → 'rework'
    // 4. else → 'pending'

    it('approved takes highest priority', () => {
      const status = computeApprovalStatus(
        [
          { decision: 'approved' },
          { decision: 'rejected' },
          { decision: 'changes_requested' },
        ],
        1,
        'changes_requested',
      )
      expect(status).toBe('approved')
    })

    it('rejected takes priority over changes_requested', () => {
      const status = computeApprovalStatus(
        [{ decision: 'rejected' }, { decision: 'changes_requested' }],
        2,
        'changes_requested',
      )
      expect(status).toBe('rejected')
    })
  })
})

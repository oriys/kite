import { desc, eq, and, inArray, type SQL } from 'drizzle-orm'
import { db } from '../db'
import {
  approvalRequests,
  approvalReviewers,
} from '../schema'

type ApprovalStatus = (typeof approvalRequests.$inferInsert)['status']
type ApprovalDecision = NonNullable<
  (typeof approvalReviewers.$inferInsert)['decision']
>

export async function createApprovalRequest(
  workspaceId: string,
  documentId: string,
  requesterId: string,
  title: string,
  reviewerIds: string[],
  options: {
    description?: string
    requiredApprovals?: number
    deadline?: Date
  } = {},
) {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .insert(approvalRequests)
      .values({
        workspaceId,
        documentId,
        requesterId,
        title,
        description: options.description ?? '',
        requiredApprovals: options.requiredApprovals ?? 1,
        deadline: options.deadline ?? null,
      })
      .returning()

    if (reviewerIds.length > 0) {
      await tx.insert(approvalReviewers).values(
        reviewerIds.map((reviewerId) => ({
          requestId: request.id,
          reviewerId,
        })),
      )
    }

    return request
  })
}

export async function listApprovalRequests(
  workspaceId: string,
  options: {
    status?: ApprovalStatus
    reviewerId?: string
    documentId?: string
    limit?: number
    offset?: number
  } = {},
) {
  const { status, reviewerId, documentId, limit = 30, offset = 0 } = options
  const conditions: SQL<unknown>[] = [eq(approvalRequests.workspaceId, workspaceId)]
  if (status) conditions.push(eq(approvalRequests.status, status))
  if (documentId) conditions.push(eq(approvalRequests.documentId, documentId))
  if (reviewerId) {
    const reviewerRequestIds = db
      .select({ requestId: approvalReviewers.requestId })
      .from(approvalReviewers)
      .where(eq(approvalReviewers.reviewerId, reviewerId))

    conditions.push(inArray(approvalRequests.id, reviewerRequestIds))
  }

  const query = db.query.approvalRequests.findMany({
    where: and(...conditions),
    orderBy: [desc(approvalRequests.createdAt)],
    limit,
    offset,
    columns: {
      id: true,
      documentId: true,
      status: true,
      title: true,
      description: true,
      requiredApprovals: true,
      deadline: true,
      createdAt: true,
    },
    with: {
      document: {
        columns: {
          id: true,
          title: true,
        },
      },
      requester: {
        columns: {
          id: true,
          name: true,
          image: true,
        },
      },
      reviewers: {
        columns: {
          id: true,
          reviewerId: true,
          decision: true,
        },
        with: {
          reviewer: {
            columns: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
  })

  return query
}

export async function getApprovalRequest(id: string) {
  return (
    (await db.query.approvalRequests.findFirst({
      where: eq(approvalRequests.id, id),
      with: {
        document: true,
        requester: true,
        reviewers: {
          with: { reviewer: true },
        },
      },
    })) ?? null
  )
}

export async function submitApprovalDecision(
  requestId: string,
  reviewerId: string,
  decision: ApprovalDecision,
  comment?: string,
) {
  return db.transaction(async (tx) => {
    const [reviewer] = await tx
      .update(approvalReviewers)
      .set({ decision, comment: comment ?? null, decidedAt: new Date() })
      .where(
        and(
          eq(approvalReviewers.requestId, requestId),
          eq(approvalReviewers.reviewerId, reviewerId),
        ),
      )
      .returning()

    if (!reviewer) return null

    // Check if approval threshold is met
    const allReviewers = await tx.query.approvalReviewers.findMany({
      where: eq(approvalReviewers.requestId, requestId),
    })

    const request = await tx.query.approvalRequests.findFirst({
      where: eq(approvalRequests.id, requestId),
    })

    if (!request) return null

    const approvedCount = allReviewers.filter(
      (r) => r.decision === 'approved',
    ).length
    const rejectedCount = allReviewers.filter(
      (r) => r.decision === 'rejected',
    ).length

    let newStatus: ApprovalStatus = 'pending'
    if (approvedCount >= request.requiredApprovals) {
      newStatus = 'approved'
    } else if (rejectedCount > 0) {
      newStatus = 'rejected'
    }

    if (newStatus !== 'pending') {
      await tx
        .update(approvalRequests)
        .set({
          status: newStatus,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(approvalRequests.id, requestId))
    }

    return { reviewer, requestStatus: newStatus }
  })
}

export async function cancelApprovalRequest(id: string) {
  const [request] = await db
    .update(approvalRequests)
    .set({ status: 'cancelled', resolvedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(approvalRequests.id, id),
        eq(approvalRequests.status, 'pending'),
      ),
    )
    .returning()
  return request ?? null
}

export async function getPendingApprovalsForDocument(documentId: string) {
  return db.query.approvalRequests.findFirst({
    where: and(
      eq(approvalRequests.documentId, documentId),
      eq(approvalRequests.status, 'pending'),
    ),
    with: {
      reviewers: {
        with: { reviewer: true },
      },
      requester: true,
    },
  })
}

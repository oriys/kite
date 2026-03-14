import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import type { DocPermissionLevel } from '../documents'
import { db } from '../db'
import {
  approvalRequests,
  approvalReviewers,
  documentPermissions,
  documents,
  users,
  workspaceMembers,
} from '../schema'
import { emitAuditEvent } from './audit-logs'

type MemberRole = 'owner' | 'admin' | 'member' | 'guest'
type MemberStatus = 'active' | 'disabled'
type VisibilityLevel = 'public' | 'partner' | 'private'
type DocumentStatus = 'draft' | 'review' | 'published' | 'archived'

interface AccessDocumentShape {
  id: string
  status?: DocumentStatus
  visibility: VisibilityLevel
  createdBy: string | null
}

interface PendingReviewAccess {
  reviewerIds: Set<string>
}

export interface DocumentAccess {
  accessLevel: DocPermissionLevel | null
  hasCustomPermissions: boolean
  canView: boolean
  canEdit: boolean
  canManagePermissions: boolean
  canDelete: boolean
  canDuplicate: boolean
  canTransition: boolean
}

export interface DocumentAccessPayload {
  accessLevel: DocPermissionLevel | null
  hasCustomPermissions: boolean
  canEdit: boolean
  canManagePermissions: boolean
  canDelete: boolean
  canDuplicate: boolean
  canTransition: boolean
}

export interface DocumentPermissionAssignment {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: MemberRole
  status: MemberStatus
  level: DocPermissionLevel
  grantedBy: string | null
  createdAt: Date
  updatedAt: Date
}

const LEGACY_ACCESS_BY_ROLE: Record<MemberRole, DocPermissionLevel> = {
  guest: 'view',
  member: 'edit',
  admin: 'manage',
  owner: 'manage',
}

function isPrivilegedRole(role: MemberRole) {
  return role === 'owner' || role === 'admin'
}

function resolveDocumentAccess(
  document: AccessDocumentShape,
  userId: string,
  role: MemberRole,
  explicitLevel: DocPermissionLevel | null,
  hasCustomPermissions: boolean,
): DocumentAccess {
  const privileged = isPrivilegedRole(role)
  const creator = document.createdBy === userId
  const canView =
    document.visibility === 'private'
      ? !hasCustomPermissions || privileged || creator || explicitLevel !== null
      : true

  let accessLevel: DocPermissionLevel | null = null

  if (!canView) {
    accessLevel = null
  } else if (privileged || creator) {
    accessLevel = 'manage'
  } else if (hasCustomPermissions) {
    accessLevel = explicitLevel ?? 'view'
  } else {
    accessLevel = LEGACY_ACCESS_BY_ROLE[role]
  }

  const canEdit = accessLevel === 'edit' || accessLevel === 'manage'
  const canManagePermissions = privileged || creator || explicitLevel === 'manage'

  return {
    accessLevel,
    hasCustomPermissions,
    canView,
    canEdit,
    canManagePermissions,
    canDelete: hasCustomPermissions ? canManagePermissions : canEdit,
    canDuplicate: canEdit,
    canTransition: canEdit,
  }
}

export function attachDocumentAccess<T extends AccessDocumentShape>(
  document: T,
  access: DocumentAccess,
): T & DocumentAccessPayload {
  return {
    ...document,
    accessLevel: access.accessLevel,
    hasCustomPermissions: access.hasCustomPermissions,
    canEdit: access.canEdit,
    canManagePermissions: access.canManagePermissions,
    canDelete: access.canDelete,
    canDuplicate: access.canDuplicate,
    canTransition: access.canTransition,
  }
}

export async function buildDocumentAccessMap<T extends AccessDocumentShape>(
  docs: T[],
  userId: string,
  role: MemberRole,
): Promise<Map<string, DocumentAccess>> {
  if (docs.length === 0) return new Map()

  const documentIds = docs.map((doc) => doc.id)
  const reviewDocumentIds = docs
    .filter((doc) => doc.status === 'review')
    .map((doc) => doc.id)

  const [permissionRows, permissionCountRows, pendingApprovalRows] = await Promise.all([
    db
      .select({
        documentId: documentPermissions.documentId,
        level: documentPermissions.level,
      })
      .from(documentPermissions)
      .where(
        and(
          inArray(documentPermissions.documentId, documentIds),
          eq(documentPermissions.userId, userId),
        ),
      ),
    db
      .select({
        documentId: documentPermissions.documentId,
        count: sql<number>`count(*)`,
      })
      .from(documentPermissions)
      .where(inArray(documentPermissions.documentId, documentIds))
      .groupBy(documentPermissions.documentId),
    reviewDocumentIds.length > 0
      ? db
          .select({
            documentId: approvalRequests.documentId,
            reviewerId: approvalReviewers.reviewerId,
          })
          .from(approvalRequests)
          .innerJoin(
            approvalReviewers,
            eq(approvalReviewers.requestId, approvalRequests.id),
          )
          .where(
            and(
              inArray(approvalRequests.documentId, reviewDocumentIds),
              eq(approvalRequests.status, 'pending'),
            ),
          )
      : Promise.resolve([]),
  ])

  const explicitByDocumentId = new Map(
    permissionRows.map((row) => [row.documentId, row.level]),
  )
  const documentsWithCustomPermissions = new Set(
    permissionCountRows.map((row) => row.documentId),
  )
  const pendingReviewAccessByDocumentId = new Map<string, PendingReviewAccess>()

  for (const row of pendingApprovalRows) {
    const existing = pendingReviewAccessByDocumentId.get(row.documentId)
    if (existing) {
      existing.reviewerIds.add(row.reviewerId)
      continue
    }

    pendingReviewAccessByDocumentId.set(row.documentId, {
      reviewerIds: new Set([row.reviewerId]),
    })
  }

  return new Map(
    docs.map((doc) => [
      doc.id,
      (() => {
        const access = resolveDocumentAccess(
          doc,
          userId,
          role,
          explicitByDocumentId.get(doc.id) ?? null,
          documentsWithCustomPermissions.has(doc.id),
        )
        const pendingReview = pendingReviewAccessByDocumentId.get(doc.id)

        if (!pendingReview || pendingReview.reviewerIds.has(userId)) {
          return access
        }

        return {
          ...access,
          canEdit: false,
          canManagePermissions: false,
          canDelete: false,
          canDuplicate: false,
          canTransition: false,
        }
      })(),
    ]),
  )
}

export async function listDocumentPermissions(
  documentId: string,
  workspaceId: string,
): Promise<DocumentPermissionAssignment[]> {
  const rows = await db
    .select({
      userId: documentPermissions.userId,
      name: users.name,
      email: users.email,
      image: users.image,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      level: documentPermissions.level,
      grantedBy: documentPermissions.grantedBy,
      createdAt: documentPermissions.createdAt,
      updatedAt: documentPermissions.updatedAt,
    })
    .from(documentPermissions)
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.userId, documentPermissions.userId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    )
    .innerJoin(users, eq(users.id, documentPermissions.userId))
    .where(eq(documentPermissions.documentId, documentId))
    .orderBy(asc(users.name), asc(users.email))

  return rows as DocumentPermissionAssignment[]
}

async function ensureDocumentPermissionTarget(
  documentId: string,
  workspaceId: string,
  userId: string,
) {
  const [target] = await db
    .select({
      userId: workspaceMembers.userId,
      status: workspaceMembers.status,
    })
    .from(workspaceMembers)
    .innerJoin(
      documents,
      and(
        eq(documents.id, documentId),
        eq(documents.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )

  if (!target) throw new Error('Member not found in this workspace')
  if (target.status !== 'active') {
    throw new Error('Only active members can receive document permissions')
  }
}

export async function setDocumentPermission(input: {
  documentId: string
  workspaceId: string
  userId: string
  level: DocPermissionLevel
  actorId: string
}) {
  await ensureDocumentPermissionTarget(
    input.documentId,
    input.workspaceId,
    input.userId,
  )

  const now = new Date()

  const [permission] = await db
    .insert(documentPermissions)
    .values({
      documentId: input.documentId,
      userId: input.userId,
      level: input.level,
      grantedBy: input.actorId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [documentPermissions.documentId, documentPermissions.userId],
      set: {
        level: input.level,
        grantedBy: input.actorId,
        updatedAt: now,
      },
    })
    .returning()

  await emitAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: 'update',
    resourceType: 'document_permission',
    resourceId: `${input.documentId}:${input.userId}`,
    metadata: {
      documentId: input.documentId,
      targetUserId: input.userId,
      level: input.level,
    },
  })

  return permission
}

export async function clearDocumentPermission(input: {
  documentId: string
  workspaceId: string
  userId: string
  actorId: string
}) {
  const [permission] = await db
    .delete(documentPermissions)
    .where(
      and(
        eq(documentPermissions.documentId, input.documentId),
        eq(documentPermissions.userId, input.userId),
      ),
    )
    .returning()

  if (permission) {
    await emitAuditEvent({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: 'delete',
      resourceType: 'document_permission',
      resourceId: `${input.documentId}:${input.userId}`,
      metadata: {
        documentId: input.documentId,
        targetUserId: input.userId,
      },
    })
  }

  return permission
}

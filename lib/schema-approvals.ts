import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './schema-auth'
import { workspaces } from './schema-workspace'
import { documents } from './schema-documents'
import { approvalPolicies } from './schema-approval-policies'

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'rework',
])

export const approvalDecisionEnum = pgEnum('approval_decision', [
  'approved',
  'rejected',
  'changes_requested',
])

export const approvalRequests = pgTable(
  'approval_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: approvalStatusEnum('status').notNull().default('pending'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    requiredApprovals: integer('required_approvals').notNull().default(1),
    deadline: timestamp('deadline', { mode: 'date' }),
    policyId: text('policy_id').references(() => approvalPolicies.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('approval_requests_workspace_id_idx').on(t.workspaceId),
    index('approval_requests_document_id_idx').on(t.documentId),
    index('approval_requests_requester_id_idx').on(t.requesterId),
    index('approval_requests_status_idx').on(t.status),
    index('approval_requests_policy_id_idx').on(t.policyId),
  ],
)

export const approvalReviewers = pgTable(
  'approval_reviewers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text('request_id')
      .notNull()
      .references(() => approvalRequests.id, { onDelete: 'cascade' }),
    reviewerId: text('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    decision: approvalDecisionEnum('decision'),
    comment: text('comment'),
    decidedAt: timestamp('decided_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('approval_reviewers_request_id_idx').on(t.requestId),
    index('approval_reviewers_reviewer_id_idx').on(t.reviewerId),
    index('approval_reviewers_reviewer_request_idx').on(t.reviewerId, t.requestId),
    uniqueIndex('approval_reviewers_request_reviewer_idx').on(
      t.requestId,
      t.reviewerId,
    ),
  ],
)

export const approvalRequestsRelations = relations(
  approvalRequests,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [approvalRequests.workspaceId],
      references: [workspaces.id],
    }),
    document: one(documents, {
      fields: [approvalRequests.documentId],
      references: [documents.id],
    }),
    requester: one(users, {
      fields: [approvalRequests.requesterId],
      references: [users.id],
    }),
    reviewers: many(approvalReviewers),
  }),
)

export const approvalReviewersRelations = relations(
  approvalReviewers,
  ({ one }) => ({
    request: one(approvalRequests, {
      fields: [approvalReviewers.requestId],
      references: [approvalRequests.id],
    }),
    reviewer: one(users, {
      fields: [approvalReviewers.reviewerId],
      references: [users.id],
    }),
  }),
)

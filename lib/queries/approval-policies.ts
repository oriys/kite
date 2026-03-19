import { desc, eq, and } from 'drizzle-orm'
import { db } from '../db'
import { approvalPolicies } from '../schema'

export async function createApprovalPolicy(
  workspaceId: string,
  name: string,
  policyType: string,
  config: Record<string, unknown>,
  isDefault = false,
) {
  const [policy] = await db
    .insert(approvalPolicies)
    .values({ workspaceId, name, policyType, config, isDefault })
    .returning()
  return policy
}

export async function listApprovalPolicies(workspaceId: string) {
  return db
    .select()
    .from(approvalPolicies)
    .where(eq(approvalPolicies.workspaceId, workspaceId))
    .orderBy(desc(approvalPolicies.createdAt))
}

export async function getApprovalPolicy(id: string, workspaceId: string) {
  return (await db.query.approvalPolicies.findFirst({
    where: and(eq(approvalPolicies.id, id), eq(approvalPolicies.workspaceId, workspaceId)),
  })) ?? null
}

export async function updateApprovalPolicy(
  id: string,
  workspaceId: string,
  data: Partial<{ name: string; policyType: string; config: Record<string, unknown>; isDefault: boolean }>,
) {
  const [policy] = await db
    .update(approvalPolicies)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(approvalPolicies.id, id), eq(approvalPolicies.workspaceId, workspaceId)))
    .returning()
  return policy ?? null
}

export async function deleteApprovalPolicy(id: string, workspaceId: string) {
  const [policy] = await db
    .delete(approvalPolicies)
    .where(and(eq(approvalPolicies.id, id), eq(approvalPolicies.workspaceId, workspaceId)))
    .returning()
  return !!policy
}

export async function getDefaultApprovalPolicy(workspaceId: string) {
  return (await db.query.approvalPolicies.findFirst({
    where: and(
      eq(approvalPolicies.workspaceId, workspaceId),
      eq(approvalPolicies.isDefault, true),
    ),
  })) ?? null
}

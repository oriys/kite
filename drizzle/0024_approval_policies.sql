-- Approval policies table
CREATE TABLE IF NOT EXISTS "approval_policies" (
  "id" text PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "policy_type" text NOT NULL DEFAULT 'standard',
  "config" jsonb NOT NULL DEFAULT '{}',
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "approval_policies_workspace_idx" ON "approval_policies" ("workspace_id");

-- Add rework status to approval_status enum
ALTER TYPE "approval_status" ADD VALUE IF NOT EXISTS 'rework';

-- Add policy_id to approval_requests
ALTER TABLE "approval_requests" ADD COLUMN IF NOT EXISTS "policy_id" text REFERENCES "approval_policies"("id") ON DELETE SET NULL;

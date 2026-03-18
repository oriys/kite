-- Add section_path and heading to document_chunks
ALTER TABLE "document_chunks"
ADD COLUMN "section_path" text;
--> statement-breakpoint
ALTER TABLE "document_chunks"
ADD COLUMN "heading" text;
--> statement-breakpoint

-- Create knowledge_sources table
DO $$ BEGIN
  CREATE TYPE "knowledge_source_type" AS ENUM('document', 'pdf', 'url', 'markdown', 'faq');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "knowledge_source_status" AS ENUM('pending', 'processing', 'ready', 'error', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_sources" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "source_type" "knowledge_source_type" NOT NULL,
  "status" "knowledge_source_status" NOT NULL DEFAULT 'pending',
  "title" text NOT NULL,
  "source_url" text,
  "raw_content" text NOT NULL DEFAULT '',
  "content_hash" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "error_message" text,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "processed_at" timestamp,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_sources_workspace_id_idx" ON "knowledge_sources" ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_sources_status_idx" ON "knowledge_sources" ("workspace_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_sources_type_idx" ON "knowledge_sources" ("workspace_id", "source_type");
--> statement-breakpoint

-- Add knowledge_source_id FK to document_chunks
ALTER TABLE "document_chunks"
ADD COLUMN "knowledge_source_id" text REFERENCES "knowledge_sources"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- Make document_id nullable for knowledge source chunks
ALTER TABLE "document_chunks"
ALTER COLUMN "document_id" DROP NOT NULL;

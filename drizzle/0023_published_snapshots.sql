-- Published snapshots table
CREATE TABLE IF NOT EXISTS "published_snapshots" (
  "id" text PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "slug" text,
  "published_slug" text,
  "content" text NOT NULL,
  "summary" text NOT NULL DEFAULT '',
  "category" text NOT NULL DEFAULT '',
  "tags" text[] NOT NULL DEFAULT '{}'::text[],
  "locale" text NOT NULL DEFAULT 'en',
  "nav_section" text,
  "publish_order" integer DEFAULT 0,
  "visibility" "visibility_level" NOT NULL DEFAULT 'public',
  "published_at" timestamp NOT NULL DEFAULT now(),
  "published_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "rollout_percentage" integer NOT NULL DEFAULT 100,
  "rollout_channels" jsonb DEFAULT '[]',
  "rollback_of" integer,
  "metadata" jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS "published_snapshots_workspace_idx" ON "published_snapshots" ("workspace_id");
CREATE INDEX IF NOT EXISTS "published_snapshots_document_idx" ON "published_snapshots" ("document_id");
CREATE INDEX IF NOT EXISTS "published_snapshots_document_version_idx" ON "published_snapshots" ("document_id", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "published_snapshots_active_idx" ON "published_snapshots" ("document_id") WHERE "is_active" = true;

-- Seed snapshots for existing published documents
INSERT INTO "published_snapshots" (
  "workspace_id", "document_id", "version", "title", "slug", "published_slug",
  "content", "summary", "category", "tags", "locale", "nav_section",
  "publish_order", "visibility", "published_at", "is_active"
)
SELECT
  d."workspace_id", d."id", 1, d."title", d."slug", d."published_slug",
  d."content", d."summary", d."category", d."tags", d."locale", d."nav_section",
  d."publish_order", d."visibility", d."updated_at", true
FROM "documents" d
WHERE d."status" = 'published' AND d."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "published_snapshots" ps WHERE ps."document_id" = d."id"
  );

-- Published translation snapshots
CREATE TABLE IF NOT EXISTS "published_translation_snapshots" (
  "id" text PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "locale" text NOT NULL,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "published_at" timestamp NOT NULL DEFAULT now(),
  "published_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "metadata" jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS "pub_translation_snapshots_workspace_idx" ON "published_translation_snapshots" ("workspace_id");
CREATE INDEX IF NOT EXISTS "pub_translation_snapshots_document_idx" ON "published_translation_snapshots" ("document_id");
CREATE UNIQUE INDEX IF NOT EXISTS "pub_translation_snapshots_active_idx" ON "published_translation_snapshots" ("document_id", "locale") WHERE "is_active" = true;

-- Scheduled publications
CREATE TABLE IF NOT EXISTS "scheduled_publications" (
  "id" text PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "scheduled_at" timestamp NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "scheduled_publications_workspace_idx" ON "scheduled_publications" ("workspace_id");
CREATE INDEX IF NOT EXISTS "scheduled_publications_document_idx" ON "scheduled_publications" ("document_id");
CREATE INDEX IF NOT EXISTS "scheduled_publications_status_scheduled_idx" ON "scheduled_publications" ("status", "scheduled_at");

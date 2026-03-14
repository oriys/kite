ALTER TABLE "documents"
ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "documents_category_idx"
ON "documents" ("category");

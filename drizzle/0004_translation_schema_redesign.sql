-- Migration: Redesign document translations schema
-- Old: document_translations linked two separate documents (source → translated)
-- New: document_translations stores one record per (document, locale)
--       document_translation_versions stores content history

-- Drop old indexes and columns
DROP INDEX IF EXISTS "doc_translations_source_target_idx";
DROP INDEX IF EXISTS "doc_translations_translated_idx";

-- Recreate document_translations with new structure
-- First drop old table and recreate (dev environment, no production data to migrate)
DROP TABLE IF EXISTS "document_translations" CASCADE;

CREATE TABLE "document_translations" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" text NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "locale" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE UNIQUE INDEX "doc_translations_doc_locale_idx"
  ON "document_translations" ("document_id", "locale")
  WHERE "deleted_at" IS NULL;

-- Create document_translation_versions table
CREATE TABLE "document_translation_versions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "translation_id" text NOT NULL REFERENCES "document_translations"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "translated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "doc_translation_versions_translation_idx"
  ON "document_translation_versions" ("translation_id");
CREATE INDEX "doc_translation_versions_created_idx"
  ON "document_translation_versions" ("translation_id", "created_at");

-- Migration: Redesign document translations schema
-- Old: document_translations linked two separate documents (source -> translated)
-- New: document_translations stores one record per (document, locale)
--      document_translation_versions stores the translated title/content history
--
-- This migration preserves existing translation links and materializes the
-- current translated document content into the new version table.

ALTER TABLE "document_translations" RENAME TO "document_translations_legacy";

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

INSERT INTO "document_translations" (
  "id",
  "document_id",
  "locale",
  "status",
  "created_at",
  "updated_at",
  "deleted_at"
)
SELECT
  legacy."id",
  legacy."source_document_id",
  legacy."target_locale",
  legacy."translation_status",
  legacy."created_at",
  COALESCE(translated_doc."updated_at", legacy."created_at", now()),
  legacy."deleted_at"
FROM "document_translations_legacy" AS legacy
LEFT JOIN "documents" AS translated_doc
  ON translated_doc."id" = legacy."translated_document_id";

INSERT INTO "document_translation_versions" (
  "translation_id",
  "title",
  "content",
  "translated_by",
  "created_at"
)
SELECT
  legacy."id",
  COALESCE(translated_doc."title", 'Untitled'),
  COALESCE(translated_doc."content", ''),
  translated_doc."created_by",
  COALESCE(translated_doc."updated_at", legacy."created_at", now())
FROM "document_translations_legacy" AS legacy
LEFT JOIN "documents" AS translated_doc
  ON translated_doc."id" = legacy."translated_document_id";

DROP TABLE "document_translations_legacy";

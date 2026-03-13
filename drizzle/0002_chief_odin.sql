DROP INDEX "api_versions_workspace_slug_idx";--> statement-breakpoint
DROP INDEX "doc_translations_source_target_idx";--> statement-breakpoint
ALTER TABLE "api_auth_configs" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_environments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_request_history" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_versions" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "doc_snippets" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "document_templates" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "document_translations" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "inline_comments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "openapi_sources" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "partner_group_members" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "partner_groups" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "api_versions_workspace_slug_idx" ON "api_versions" USING btree ("workspace_id","slug") WHERE "api_versions"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "doc_translations_source_target_idx" ON "document_translations" USING btree ("source_document_id","target_locale") WHERE "document_translations"."deleted_at" is null;
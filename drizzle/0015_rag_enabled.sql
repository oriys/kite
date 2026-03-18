ALTER TABLE "ai_workspace_settings" ADD COLUMN "rag_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "documents" ADD COLUMN "rag_enabled" boolean NOT NULL DEFAULT true;
ALTER TABLE "user_feature_preferences" ADD COLUMN "nav_order" jsonb;

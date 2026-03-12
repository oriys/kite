DO $$
BEGIN
	CREATE TYPE "public"."api_version_status" AS ENUM('active', 'beta', 'deprecated', 'retired');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."doc_snippet_category" AS ENUM('Structure', 'Writing', 'Data', 'API');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."doc_status" AS ENUM('draft', 'review', 'published', 'archived');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."member_role" AS ENUM('owner', 'editor', 'viewer');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."openapi_source_type" AS ENUM('upload', 'url');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	CREATE TYPE "public"."visibility_level" AS ENUM('public', 'partner', 'private');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id"),
	CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_members" (
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"role" "member_role" DEFAULT 'editor' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_user_id_workspace_id_pk" PRIMARY KEY("user_id","workspace_id"),
	CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"status" "doc_status" DEFAULT 'draft' NOT NULL,
	"visibility" "visibility_level" DEFAULT 'public' NOT NULL,
	"api_version_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
ALTER TABLE "documents"
	ADD COLUMN IF NOT EXISTS "summary" text DEFAULT '' NOT NULL,
	ADD COLUMN IF NOT EXISTS "visibility" "visibility_level" DEFAULT 'public' NOT NULL,
	ADD COLUMN IF NOT EXISTS "api_version_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doc_snippets" (
	"workspace_id" text NOT NULL,
	"id" text NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"category" "doc_snippet_category" NOT NULL,
	"keywords" text[] NOT NULL,
	"template" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "doc_snippets_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "doc_snippets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"content" text NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"base_url" text,
	"status" "api_version_status" DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"source_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "openapi_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"source_type" "openapi_source_type" NOT NULL,
	"source_url" text,
	"raw_content" text NOT NULL,
	"parsed_version" text,
	"openapi_version" text,
	"checksum" text NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "openapi_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "openapi_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"raw_content" text NOT NULL,
	"parsed_version" text,
	"checksum" text NOT NULL,
	"snapshot_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "openapi_snapshots_source_id_openapi_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."openapi_sources"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"path" text NOT NULL,
	"method" text NOT NULL,
	"operation_id" text,
	"summary" text,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"parameters" jsonb DEFAULT '[]'::jsonb,
	"request_body" jsonb,
	"responses" jsonb DEFAULT '{}'::jsonb,
	"deprecated" boolean DEFAULT false NOT NULL,
	"visibility" "visibility_level" DEFAULT 'public' NOT NULL,
	"document_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_endpoints_source_id_openapi_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."openapi_sources"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inline_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"author_id" text NOT NULL,
	"anchor_type" text NOT NULL,
	"anchor_from" integer,
	"anchor_to" integer,
	"anchor_block_id" text,
	"quoted_text" text,
	"body" text NOT NULL,
	"parent_id" text,
	"thread_resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inline_comments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "inline_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text,
	"is_helpful" boolean NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_feedback_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "link_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"document_id" text NOT NULL,
	"url" text NOT NULL,
	"status_code" integer,
	"is_alive" boolean,
	"error_message" text,
	"last_checked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "link_checks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_groups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_group_members" (
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "partner_group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id"),
	CONSTRAINT "partner_group_members_group_id_partner_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."partner_groups"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "partner_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "search_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text,
	"query" text NOT NULL,
	"result_count" integer NOT NULL,
	"clicked_document_id" text,
	"searched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_unique" ON "workspaces" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_workspace_id_idx" ON "documents" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_status_idx" ON "documents" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_created_by_idx" ON "documents" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_api_version_id_idx" ON "documents" USING btree ("api_version_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_snippets_workspace_id_idx" ON "doc_snippets" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_snippets_category_idx" ON "doc_snippets" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_versions_document_id_idx" ON "document_versions" USING btree ("document_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_versions_workspace_slug_idx" ON "api_versions" USING btree ("workspace_id","slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_versions_workspace_id_idx" ON "api_versions" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "openapi_sources_workspace_id_idx" ON "openapi_sources" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "openapi_snapshots_source_id_idx" ON "openapi_snapshots" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_endpoints_source_id_idx" ON "api_endpoints" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_endpoints_method_path_idx" ON "api_endpoints" USING btree ("method","path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inline_comments_document_id_idx" ON "inline_comments" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inline_comments_parent_id_idx" ON "inline_comments" USING btree ("parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_feedback_document_id_idx" ON "document_feedback" USING btree ("document_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "link_checks_document_url_idx" ON "link_checks" USING btree ("document_id","url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "link_checks_workspace_id_idx" ON "link_checks" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_groups_workspace_id_idx" ON "partner_groups" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_logs_workspace_id_idx" ON "search_logs" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_logs_searched_at_idx" ON "search_logs" USING btree ("searched_at");

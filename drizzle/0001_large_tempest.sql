CREATE TYPE "public"."api_auth_type" AS ENUM('none', 'bearer', 'api_key', 'basic', 'oauth2');--> statement-breakpoint
CREATE TYPE "public"."approval_decision" AS ENUM('approved', 'rejected', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'publish', 'archive', 'approve', 'reject', 'status_change', 'visibility_change', 'login', 'export');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('comment', 'mention', 'approval_request', 'approval_decision', 'status_change', 'webhook_failure', 'system');--> statement-breakpoint
CREATE TYPE "public"."template_category" AS ENUM('getting-started', 'api-reference', 'changelog', 'migration-guide', 'tutorial', 'troubleshooting', 'custom');--> statement-breakpoint
CREATE TYPE "public"."webhook_event" AS ENUM('document.created', 'document.updated', 'document.published', 'document.archived', 'document.deleted', 'comment.created', 'comment.resolved', 'approval.requested', 'approval.approved', 'approval.rejected', 'api_version.created', 'api_version.deprecated');--> statement-breakpoint
CREATE TABLE "active_editors" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"cursor_position" integer,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_auth_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"auth_type" "api_auth_type" NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_environments" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_request_history" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text,
	"method" text NOT NULL,
	"url" text NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"body" text,
	"response_status" integer,
	"response_headers" jsonb DEFAULT '{}'::jsonb,
	"response_body" text,
	"duration_ms" integer,
	"environment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"document_id" text NOT NULL,
	"requester_id" text NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"required_approvals" integer DEFAULT 1 NOT NULL,
	"deadline" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_reviewers" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" "approval_decision",
	"comment" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"actor_id" text,
	"action" "audit_action" NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"resource_title" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "template_category" DEFAULT 'custom' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"thumbnail" text,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"source_document_id" text NOT NULL,
	"translated_document_id" text NOT NULL,
	"source_locale" text NOT NULL,
	"target_locale" text NOT NULL,
	"translation_status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"comment_enabled" boolean DEFAULT true NOT NULL,
	"mention_enabled" boolean DEFAULT true NOT NULL,
	"approval_enabled" boolean DEFAULT true NOT NULL,
	"status_change_enabled" boolean DEFAULT true NOT NULL,
	"webhook_failure_enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "notification_preferences_user_id_workspace_id_pk" PRIMARY KEY("user_id","workspace_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link_url" text,
	"resource_type" text,
	"resource_id" text,
	"actor_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"status_code" integer,
	"response_body" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_branding" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"logo_url" text,
	"favicon_url" text,
	"primary_color" text,
	"accent_color" text,
	"custom_domain" text,
	"custom_css" text,
	"meta_title" text,
	"meta_description" text,
	"og_image_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "active_editors" ADD CONSTRAINT "active_editors_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_editors" ADD CONSTRAINT "active_editors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_auth_configs" ADD CONSTRAINT "api_auth_configs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_environments" ADD CONSTRAINT "api_environments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_request_history" ADD CONSTRAINT "api_request_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_request_history" ADD CONSTRAINT "api_request_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_reviewers" ADD CONSTRAINT "approval_reviewers_request_id_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_reviewers" ADD CONSTRAINT "approval_reviewers_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_translations" ADD CONSTRAINT "document_translations_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_translations" ADD CONSTRAINT "document_translations_translated_document_id_documents_id_fk" FOREIGN KEY ("translated_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_branding" ADD CONSTRAINT "workspace_branding_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "active_editors_doc_user_idx" ON "active_editors" USING btree ("document_id","user_id");--> statement-breakpoint
CREATE INDEX "active_editors_document_id_idx" ON "active_editors" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "active_editors_last_seen_at_idx" ON "active_editors" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "api_auth_configs_workspace_id_idx" ON "api_auth_configs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "api_environments_workspace_id_idx" ON "api_environments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "api_request_history_workspace_id_idx" ON "api_request_history" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "api_request_history_user_id_idx" ON "api_request_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_request_history_created_at_idx" ON "api_request_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "approval_requests_workspace_id_idx" ON "approval_requests" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "approval_requests_document_id_idx" ON "approval_requests" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "approval_requests_requester_id_idx" ON "approval_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "approval_requests_status_idx" ON "approval_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "approval_reviewers_request_id_idx" ON "approval_reviewers" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "approval_reviewers_reviewer_id_idx" ON "approval_reviewers" USING btree ("reviewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_reviewers_request_reviewer_idx" ON "approval_reviewers" USING btree ("request_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "audit_logs_workspace_id_idx" ON "audit_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "document_templates_workspace_id_idx" ON "document_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "document_templates_category_idx" ON "document_templates" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_translations_source_target_idx" ON "document_translations" USING btree ("source_document_id","target_locale");--> statement-breakpoint
CREATE INDEX "doc_translations_translated_idx" ON "document_translations" USING btree ("translated_document_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_id_idx" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "notifications_workspace_id_idx" ON "notifications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "notifications_is_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_created_at_idx" ON "webhook_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhooks_workspace_id_idx" ON "webhooks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "documents_locale_idx" ON "documents" USING btree ("locale");
DO $$ BEGIN
  CREATE TYPE "public"."error_level" AS ENUM('warn', 'error', 'fatal');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."error_source" AS ENUM('api-route', 'server-action', 'server-component', 'client', 'middleware', 'cron', 'webhook', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "error_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  "level" "error_level" DEFAULT 'error' NOT NULL,
  "source" "error_source" DEFAULT 'unknown' NOT NULL,
  "error_name" text,
  "error_message" text,
  "error_stack" text,
  "error_cause" text,
  "error_digest" text,
  "fingerprint" text,
  "http_method" text,
  "http_url" text,
  "http_status" integer,
  "http_headers" jsonb,
  "http_body" text,
  "user_id" text,
  "workspace_id" text,
  "session_id" text,
  "request_id" text,
  "user_agent" text,
  "ip_address" text,
  "context" jsonb,
  "resolved" boolean DEFAULT false NOT NULL,
  "resolved_at" timestamp,
  "resolved_by" text,
  "resolved_note" text
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_logs_occurred_at_idx" ON "error_logs" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_logs_fingerprint_idx" ON "error_logs" USING btree ("fingerprint", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_logs_source_level_idx" ON "error_logs" USING btree ("source", "level", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_logs_resolved_idx" ON "error_logs" USING btree ("resolved", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_logs_user_idx" ON "error_logs" USING btree ("user_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_logs_request_id_idx" ON "error_logs" USING btree ("request_id");

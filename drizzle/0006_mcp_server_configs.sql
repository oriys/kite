DO $$ BEGIN
  CREATE TYPE "public"."mcp_transport_type" AS ENUM('stdio', 'sse', 'streamable_http');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "mcp_server_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "name" text NOT NULL,
  "transport_type" "mcp_transport_type" NOT NULL,
  "command" text,
  "args" jsonb DEFAULT '[]'::jsonb,
  "env" jsonb DEFAULT '{}'::jsonb,
  "url" text,
  "headers" jsonb DEFAULT '{}'::jsonb,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

DO $$ BEGIN
  ALTER TABLE "mcp_server_configs"
    ADD CONSTRAINT "mcp_server_configs_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "mcp_server_configs_workspace_id_idx"
  ON "mcp_server_configs" USING btree ("workspace_id");
